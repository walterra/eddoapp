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
 * Builds GitHub search query for issues
 */
function buildSearchQuery(params: GithubIssueListParams): string {
  const queryParts: string[] = ['is:issue', 'assignee:@me'];

  // Add state filter (open, closed, or both)
  if (params.state === 'open') {
    queryParts.push('state:open');
  } else if (params.state === 'closed') {
    queryParts.push('state:closed');
  }
  // For 'all', don't add state filter (includes both open and closed)

  // Add since filter if provided (issues updated after this date)
  if (params.since) {
    // GitHub search expects format: >=YYYY-MM-DD
    const sinceDate = params.since.split('T')[0]; // Extract date part from ISO string
    queryParts.push(`updated:>=${sinceDate}`);
  }

  return queryParts.join(' ');
}

/**
 * Fetches all user issues with pagination support using Search API
 * Note: GitHub Search API has a maximum of 1000 results (10 pages of 100)
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
  const searchQuery = buildSearchQuery(params);

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

      // Filter out pull requests and transform to GithubIssue format
      const issues = response.data.items
        .filter((item) => !item.pull_request)
        .map((item) => transformSearchResult(item));

      logger.info('Received GitHub issues page', {
        page,
        totalCount: response.data.total_count,
        issuesCount: issues.length,
        rateLimit: response.headers['x-ratelimit-remaining'],
        rateLimitReset: response.headers['x-ratelimit-reset'],
      });

      if (issues.length === 0) {
        break;
      }

      allIssues.push(...issues);

      // If we got fewer results than requested, we're on the last page
      if (issues.length < perPage) {
        break;
      }

      page++;

      // GitHub Search API has a maximum of 1000 results (10 pages of 100)
      if (page > 10) {
        logger.warn('Reached GitHub Search API limit (1000 results max)', {
          totalIssues: allIssues.length,
        });
        break;
      }

      // Check if we've fetched all available results
      if (allIssues.length >= response.data.total_count) {
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
     * Fetches issues assigned to authenticated user via GitHub Search API
     * Supports all repositories (personal, org, public, private) with proper SSO authorization
     * Rate limit: 30 requests/minute for Search API (5000/hour for authenticated users)
     * Maximum: 1000 results (GitHub Search API limit)
     */
    async fetchUserIssues(params: GithubIssueListParams = {}): Promise<GithubIssue[]> {
      const defaultParams: GithubIssueListParams = {
        state: 'all',
        sort: 'updated',
        direction: 'desc',
        per_page: 100,
        ...params,
      };

      logger.info('Fetching GitHub issues via Search API', { params: defaultParams });

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
