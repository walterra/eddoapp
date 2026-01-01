/**
 * GitHub API client for fetching user issues
 */
import type { TodoAlpha3 } from '@eddo/core-shared';
import { Octokit } from '@octokit/rest';

import { fetchAllPagesForQuery } from './issue-fetcher.js';
import {
  buildAssignedQuery,
  buildReviewedByQuery,
  buildReviewRequestedQuery,
} from './query-builder.js';
import {
  createRateLimitManager,
  type RateLimitManager,
  type RateLimitManagerConfig,
} from './rate-limit-manager.js';
import { formatResetTime } from './rate-limit.js';
import type { GithubApiError, GithubIssue, GithubIssueListParams } from './types.js';

export interface GithubClientConfig {
  token: string;
}

export interface GithubClient {
  fetchUserIssues(params?: GithubIssueListParams): Promise<GithubIssue[]>;
  mapIssueToTodo(issue: GithubIssue, context: string, tags: string[]): Omit<TodoAlpha3, '_rev'>;
  generateExternalId(issue: GithubIssue): string;
}

/**
 * Creates external ID for GitHub issue in format: github:owner/repo/issues/123
 */
export function generateExternalId(issue: GithubIssue): string {
  return `github:${issue.repository.full_name}/issues/${issue.number}`;
}

/**
 * Maps GitHub issue/PR to TodoAlpha3 structure
 * Adds type-specific tags: github:issue, github:pr, github:pr-review
 */
export function mapIssueToTodo(
  issue: GithubIssue,
  context: string,
  tags: string[],
): Omit<TodoAlpha3, '_rev'> {
  const now = new Date().toISOString();

  // Start with configured tags and GitHub labels
  const allTags = [...tags, ...issue.labels.map((label) => label.name)];

  // Add type-specific tags
  if (issue.pull_request) {
    // This is a PR
    if (issue.isReviewRequested) {
      allTags.push('github:pr-review');
    } else {
      allTags.push('github:pr');
    }
  } else {
    // This is an issue
    allTags.push('github:issue');
  }

  return {
    _id: now,
    active: {},
    completed: issue.state === 'closed' && issue.closed_at ? issue.closed_at : null,
    context,
    description: issue.body || '',
    due: issue.created_at, // Use GitHub issue creation date as initial due date
    externalId: generateExternalId(issue),
    link: issue.html_url,
    repeat: null,
    tags: allTags,
    title: issue.title,
    version: 'alpha3',
  };
}

interface FetchConfig {
  octokit: Octokit;
  logger: RateLimitManagerConfig['logger'];
  rateLimitManager: RateLimitManager;
}

/**
 * Deduplicate and merge items from multiple queries
 */
function deduplicateItems(
  assignedItems: GithubIssue[],
  reviewRequestedItems: GithubIssue[],
  reviewedByItems: GithubIssue[],
): GithubIssue[] {
  const itemsMap = new Map<number, GithubIssue>();

  // Add assigned items first
  for (const item of assignedItems) {
    itemsMap.set(item.id, item);
  }

  // Add review-requested items with flag
  for (const item of reviewRequestedItems) {
    const existing = itemsMap.get(item.id);
    if (existing) {
      itemsMap.set(item.id, { ...existing, isReviewRequested: true });
    } else {
      itemsMap.set(item.id, { ...item, isReviewRequested: true });
    }
  }

  // Add reviewed-by items
  for (const item of reviewedByItems) {
    const existing = itemsMap.get(item.id);
    if (existing) {
      if (!existing.isReviewRequested) {
        itemsMap.set(item.id, { ...existing, isReviewRequested: true });
      }
    } else {
      itemsMap.set(item.id, { ...item, isReviewRequested: true });
    }
  }

  return Array.from(itemsMap.values());
}

/**
 * Fetch all user items from GitHub
 */
async function fetchAllUserItems(
  config: FetchConfig,
  params: GithubIssueListParams,
): Promise<GithubIssue[]> {
  // Fetch assigned items (issues and PRs where user is assignee)
  const assignedQuery = buildAssignedQuery(params);
  const assignedItems = await fetchAllPagesForQuery(config, assignedQuery, params);

  // Fetch PR reviews (PRs where user is requested reviewer)
  const reviewRequestedQuery = buildReviewRequestedQuery(params);
  const reviewRequestedItems = await fetchAllPagesForQuery(config, reviewRequestedQuery, params);

  // Fetch PRs user has reviewed (persists after PR closure)
  const reviewedByQuery = buildReviewedByQuery(params);
  const reviewedByItems = await fetchAllPagesForQuery(config, reviewedByQuery, params);

  // Combine and deduplicate
  const allItems = deduplicateItems(assignedItems, reviewRequestedItems, reviewedByItems);

  config.logger.info('Successfully fetched GitHub items', {
    assignedCount: assignedItems.length,
    reviewRequestedCount: reviewRequestedItems.length,
    reviewedByCount: reviewedByItems.length,
    totalCount: allItems.length,
    deduplicatedCount:
      assignedItems.length + reviewRequestedItems.length + reviewedByItems.length - allItems.length,
  });

  return allItems;
}

/**
 * Handle GitHub API errors and throw appropriate messages
 */
function handleGithubError(
  error: GithubApiError,
  rateLimitManager: RateLimitManager,
  logger: RateLimitManagerConfig['logger'],
): never {
  // Handle specific error cases
  if (error.response?.status === 401) {
    throw new Error('GitHub token is invalid or expired');
  }

  if (error.response?.status === 403) {
    const rateLimitError = error.response.data.message.includes('rate limit');
    if (rateLimitError) {
      const lastRateLimitInfo = rateLimitManager.getLastRateLimitInfo();
      const resetTime = lastRateLimitInfo ? formatResetTime(lastRateLimitInfo.resetDate) : 'later';
      const errorMsg = `GitHub API rate limit exceeded. Please try again ${resetTime}.`;
      logger.error('GitHub API rate limit exceeded', {
        resetTime,
        rateLimitInfo: lastRateLimitInfo,
      });
      throw new Error(errorMsg);
    }
    throw new Error('Access forbidden. Check token permissions.');
  }

  if (error.response?.status === 404) {
    throw new Error('GitHub API endpoint not found. Check token scopes.');
  }

  logger.error('Failed to fetch GitHub issues', {
    error: error.message,
    status: error.response?.status,
  });

  throw new Error(`Failed to fetch GitHub issues: ${error.message}`);
}

/**
 * Creates GitHub API client
 */
export function createGithubClient(
  clientConfig: GithubClientConfig,
  logger: RateLimitManagerConfig['logger'] = {
    info: console.log,
    warn: console.warn,
    error: console.error,
    debug: console.debug,
  },
): GithubClient {
  // Mask token in logs (show first 7 and last 4 chars)
  const maskedToken = clientConfig.token
    ? `${clientConfig.token.substring(0, 7)}...${clientConfig.token.substring(clientConfig.token.length - 4)}`
    : 'none';

  logger.info('Creating GitHub client', { tokenMasked: maskedToken });

  const octokit = new Octokit({
    auth: clientConfig.token,
    userAgent: 'eddo-github-sync/1.0.0',
  });

  // Create rate limit manager
  const rateLimitManager = createRateLimitManager({
    maxRetries: 3,
    baseDelayMs: 1000,
    minRequestIntervalMs: 100,
    warningThresholdPercent: 20,
    logger,
  });

  const config: FetchConfig = { octokit, logger, rateLimitManager };

  return {
    /**
     * Fetches items (issues and PRs) for authenticated user via GitHub Search API
     */
    async fetchUserIssues(params: GithubIssueListParams = {}): Promise<GithubIssue[]> {
      const defaultParams: GithubIssueListParams = {
        state: 'all',
        sort: 'updated',
        direction: 'desc',
        per_page: 100,
        ...params,
      };

      logger.info('Fetching GitHub items (issues, PRs, reviews) via Search API', {
        params: defaultParams,
      });

      try {
        return await fetchAllUserItems(config, defaultParams);
      } catch (error) {
        handleGithubError(error as GithubApiError, rateLimitManager, logger);
      }
    },

    mapIssueToTodo,
    generateExternalId,
  };
}
