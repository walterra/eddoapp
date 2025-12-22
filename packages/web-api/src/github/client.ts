/**
 * GitHub API client for fetching user issues
 */
import type { TodoAlpha3 } from '@eddo/core-shared';
import { Octokit } from '@octokit/rest';

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
      // This is a PR review request
      allTags.push('github:pr-review');
    } else {
      // This is an assigned PR
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

/**
 * Transform Search API result to GithubIssue format
 * Search API returns repository_url string, we need repository object
 */
function transformSearchResult(item: {
  repository_url: string;
  [key: string]: unknown;
}): GithubIssue {
  // Extract owner and repo from repository_url
  // Format: "https://api.github.com/repos/owner/repo"
  const repoUrlParts = item.repository_url.split('/');
  const owner = repoUrlParts[repoUrlParts.length - 2];
  const repo = repoUrlParts[repoUrlParts.length - 1];

  return {
    ...item,
    repository: {
      full_name: `${owner}/${repo}`,
      owner: {
        login: owner,
      },
      name: repo,
    },
  } as unknown as GithubIssue;
}

/**
 * Builds GitHub search query for assigned items (issues and PRs)
 */
function buildAssignedQuery(params: GithubIssueListParams): string {
  const queryParts: string[] = ['assignee:@me'];

  // Add state filter (open, closed, or both)
  if (params.state === 'open') {
    queryParts.push('state:open');
  } else if (params.state === 'closed') {
    queryParts.push('state:closed');
  }
  // For 'all', don't add state filter (includes both open and closed)

  // Add since filter if provided (items updated after this date)
  if (params.since) {
    // GitHub search expects format: >=YYYY-MM-DD
    const sinceDate = params.since.split('T')[0]; // Extract date part from ISO string
    queryParts.push(`updated:>=${sinceDate}`);
  }

  return queryParts.join(' ');
}

/**
 * Builds GitHub search query for PR reviews requested from user
 */
function buildReviewRequestedQuery(params: GithubIssueListParams): string {
  const queryParts: string[] = ['is:pr', 'review-requested:@me'];

  // Add state filter (open, closed, or both)
  if (params.state === 'open') {
    queryParts.push('state:open');
  } else if (params.state === 'closed') {
    queryParts.push('state:closed');
  }
  // For 'all', don't add state filter (includes both open and closed)

  // Add since filter if provided (PRs updated after this date)
  if (params.since) {
    // GitHub search expects format: >=YYYY-MM-DD
    const sinceDate = params.since.split('T')[0]; // Extract date part from ISO string
    queryParts.push(`updated:>=${sinceDate}`);
  }

  return queryParts.join(' ');
}

/**
 * Fetches all items matching a search query with pagination support using Search API
 * Note: GitHub Search API has a maximum of 1000 results (10 pages of 100)
 */
async function fetchAllPagesForQuery(
  octokit: Octokit,
  searchQuery: string,
  params: GithubIssueListParams,
  logger: {
    info: (msg: string, meta?: unknown) => void;
    warn: (msg: string, meta?: unknown) => void;
    error: (msg: string, meta?: unknown) => void;
  },
): Promise<GithubIssue[]> {
  const allItems: GithubIssue[] = [];
  let page = 1;
  const perPage = params.per_page || 100;

  // Determine sort field based on params
  const sortField = params.sort === 'created' ? 'created' : 'updated';
  const sortOrder = params.direction === 'asc' ? 'asc' : 'desc';

  while (true) {
    try {
      logger.info('Fetching GitHub issues via Search API', {
        page,
        perPage,
        query: searchQuery,
        sort: sortField,
        order: sortOrder,
      });

      const response = await octokit.search.issuesAndPullRequests({
        q: searchQuery,
        sort: sortField,
        order: sortOrder,
        per_page: perPage,
        page,
      });

      // Transform to GithubIssue format (includes both issues and PRs)
      const items = response.data.items.map((item) => transformSearchResult(item));

      logger.info('Received GitHub items page', {
        page,
        totalCount: response.data.total_count,
        itemsCount: items.length,
        rateLimit: response.headers['x-ratelimit-remaining'],
        rateLimitReset: response.headers['x-ratelimit-reset'],
      });

      if (items.length === 0) {
        break;
      }

      allItems.push(...items);

      // If we got fewer results than requested, we're on the last page
      if (items.length < perPage) {
        break;
      }

      page++;

      // GitHub Search API has a maximum of 1000 results (10 pages of 100)
      if (page > 10) {
        logger.warn('Reached GitHub Search API limit (1000 results max)', {
          totalItems: allItems.length,
        });
        break;
      }

      // Check if we've fetched all available results
      if (allItems.length >= response.data.total_count) {
        break;
      }
    } catch (error) {
      const apiError = error as GithubApiError;
      logger.error('Failed to fetch items page', {
        page,
        error: apiError.message,
        status: apiError.response?.status,
      });
      throw error;
    }
  }

  return allItems;
}

/**
 * Creates GitHub API client
 */
export function createGithubClient(
  config: GithubClientConfig,
  logger: {
    info: (msg: string, meta?: unknown) => void;
    warn: (msg: string, meta?: unknown) => void;
    error: (msg: string, meta?: unknown) => void;
  } = console,
): GithubClient {
  // Mask token in logs (show first 7 and last 4 chars)
  const maskedToken = config.token
    ? `${config.token.substring(0, 7)}...${config.token.substring(config.token.length - 4)}`
    : 'none';

  logger.info('Creating GitHub client', { tokenMasked: maskedToken });

  const octokit = new Octokit({
    auth: config.token,
    userAgent: 'eddo-github-sync/1.0.0',
  });

  return {
    /**
     * Fetches items (issues and PRs) for authenticated user via GitHub Search API
     * Includes: assigned issues, assigned PRs, and PR reviews requested from user
     * Supports all repositories (personal, org, public, private) with proper SSO authorization
     * Rate limit: 30 requests/minute for Search API (5000/hour for authenticated users)
     * Maximum: 1000 results per query (GitHub Search API limit)
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
        // Fetch assigned items (issues and PRs where user is assignee)
        const assignedQuery = buildAssignedQuery(defaultParams);
        const assignedItems = await fetchAllPagesForQuery(
          octokit,
          assignedQuery,
          defaultParams,
          logger,
        );

        // Fetch PR reviews (PRs where user is requested reviewer)
        const reviewQuery = buildReviewRequestedQuery(defaultParams);
        const reviewItems = await fetchAllPagesForQuery(
          octokit,
          reviewQuery,
          defaultParams,
          logger,
        );

        // Mark review items with a flag so we can add 'pr-review' tag later
        const reviewItemsMarked = reviewItems.map((item) => ({
          ...item,
          isReviewRequested: true,
        }));

        // Combine and deduplicate by ID (a PR can be both assigned and review-requested)
        const itemsMap = new Map<number, GithubIssue>();

        // Add assigned items first
        for (const item of assignedItems) {
          itemsMap.set(item.id, item);
        }

        // Add review items, merging with existing if needed
        for (const item of reviewItemsMarked) {
          const existing = itemsMap.get(item.id);
          if (existing) {
            // Merge: keep existing but mark as review-requested too
            itemsMap.set(item.id, { ...existing, isReviewRequested: true });
          } else {
            itemsMap.set(item.id, item);
          }
        }

        const allItems = Array.from(itemsMap.values());

        logger.info('Successfully fetched GitHub items', {
          assignedCount: assignedItems.length,
          reviewCount: reviewItems.length,
          totalCount: allItems.length,
          deduplicatedCount: assignedItems.length + reviewItems.length - allItems.length,
        });

        return allItems;
      } catch (error) {
        const apiError = error as GithubApiError;

        // Handle specific error cases
        if (apiError.response?.status === 401) {
          throw new Error('GitHub token is invalid or expired');
        } else if (apiError.response?.status === 403) {
          const rateLimitError = apiError.response.data.message.includes('rate limit');
          if (rateLimitError) {
            throw new Error('GitHub API rate limit exceeded. Please try again later.');
          }
          throw new Error('Access forbidden. Check token permissions.');
        } else if (apiError.response?.status === 404) {
          throw new Error('GitHub API endpoint not found. Check token scopes.');
        }

        logger.error('Failed to fetch GitHub issues', {
          error: apiError.message,
          status: apiError.response?.status,
        });

        throw new Error(`Failed to fetch GitHub issues: ${apiError.message}`);
      }
    },

    mapIssueToTodo,
    generateExternalId,
  };
}
