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
 * Maps GitHub issue to TodoAlpha3 structure
 */
export function mapIssueToTodo(
  issue: GithubIssue,
  context: string,
  tags: string[],
): Omit<TodoAlpha3, '_rev'> {
  const now = new Date().toISOString();

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
    tags: [...tags, ...issue.labels.map((label) => label.name)],
    title: issue.title,
    version: 'alpha3',
  };
}

/**
 * Fetches all user issues with pagination support
 */
async function fetchAllPages(
  octokit: Octokit,
  params: GithubIssueListParams,
  logger: {
    info: (msg: string, meta?: unknown) => void;
    warn: (msg: string, meta?: unknown) => void;
    error: (msg: string, meta?: unknown) => void;
  },
): Promise<GithubIssue[]> {
  const allIssues: GithubIssue[] = [];
  let page = 1;
  const perPage = params.per_page || 100;

  while (true) {
    try {
      const response = await octokit.issues.listForAuthenticatedUser({
        ...params,
        per_page: perPage,
        page,
      });

      const issues = response.data as unknown as GithubIssue[];

      if (issues.length === 0) {
        break;
      }

      allIssues.push(...issues);

      // If we got fewer results than requested, we're on the last page
      if (issues.length < perPage) {
        break;
      }

      page++;

      // Safety limit to prevent infinite loops
      if (page > 100) {
        logger.warn('Reached maximum pagination limit (100 pages)', {
          totalIssues: allIssues.length,
        });
        break;
      }
    } catch (error) {
      const apiError = error as GithubApiError;
      logger.error('Failed to fetch issues page', {
        page,
        error: apiError.message,
        status: apiError.response?.status,
      });
      throw error;
    }
  }

  return allIssues;
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
  const octokit = new Octokit({
    auth: config.token,
    userAgent: 'eddo-github-sync/1.0.0',
  });

  return {
    /**
     * Fetches user issues from GitHub API with pagination support
     * Rate limit: 5000 requests/hour for authenticated users
     */
    async fetchUserIssues(params: GithubIssueListParams = {}): Promise<GithubIssue[]> {
      const defaultParams: GithubIssueListParams = {
        filter: 'all',
        state: 'all',
        sort: 'updated',
        direction: 'desc',
        per_page: 100,
        ...params,
      };

      logger.info('Fetching GitHub issues', { params: defaultParams });

      try {
        const issues = await fetchAllPages(octokit, defaultParams, logger);

        logger.info('Successfully fetched GitHub issues', {
          count: issues.length,
        });

        return issues;
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
