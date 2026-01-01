/**
 * GitHub issue fetcher with pagination support
 */

import type { Octokit } from '@octokit/rest';

import type { RateLimitManager, RateLimitManagerConfig } from './rate-limit-manager.js';
import { extractRateLimitHeaders, formatResetTime } from './rate-limit.js';
import type { GithubApiError, GithubIssue, GithubIssueListParams } from './types.js';

interface FetchConfig {
  octokit: Octokit;
  logger: RateLimitManagerConfig['logger'];
  rateLimitManager: RateLimitManager;
}

/**
 * Transform Search API result to GithubIssue format
 * Search API returns repository_url string, we need repository object
 */
export function transformSearchResult(item: {
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
 * Fetch a single page of results
 */
async function fetchPage(
  config: FetchConfig,
  searchQuery: string,
  page: number,
  perPage: number,
  sortField: 'created' | 'updated',
  sortOrder: 'asc' | 'desc',
): Promise<{ items: GithubIssue[]; totalCount: number }> {
  config.logger.info('Fetching GitHub issues via Search API', {
    page,
    perPage,
    query: searchQuery,
    sort: sortField,
    order: sortOrder,
  });

  const response = await config.rateLimitManager.executeWithRateLimit(() =>
    config.octokit.search.issuesAndPullRequests({
      q: searchQuery,
      sort: sortField,
      order: sortOrder,
      per_page: perPage,
      page,
    }),
  );

  // Extract and log rate limit info
  const rateLimitInfo = extractRateLimitHeaders(
    response.headers as Record<string, string | number | undefined>,
  );

  // Transform to GithubIssue format (includes both issues and PRs)
  const items = response.data.items.map((item) => transformSearchResult(item));

  config.logger.info('Received GitHub items page', {
    page,
    totalCount: response.data.total_count,
    itemsCount: items.length,
    rateLimit: rateLimitInfo?.remaining ?? 'unknown',
    rateLimitReset: rateLimitInfo?.resetDate ? formatResetTime(rateLimitInfo.resetDate) : 'unknown',
  });

  return { items, totalCount: response.data.total_count };
}

/**
 * Fetches all items matching a search query with pagination support using Search API
 * Note: GitHub Search API has a maximum of 1000 results (10 pages of 100)
 */
export async function fetchAllPagesForQuery(
  config: FetchConfig,
  searchQuery: string,
  params: GithubIssueListParams,
): Promise<GithubIssue[]> {
  const allItems: GithubIssue[] = [];
  let page = 1;
  const perPage = params.per_page || 100;

  // Determine sort field based on params
  const sortField = params.sort === 'created' ? 'created' : 'updated';
  const sortOrder = params.direction === 'asc' ? 'asc' : 'desc';

  while (true) {
    try {
      const { items, totalCount } = await fetchPage(
        config,
        searchQuery,
        page,
        perPage,
        sortField,
        sortOrder,
      );

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
        config.logger.warn('Reached GitHub Search API limit (1000 results max)', {
          totalItems: allItems.length,
        });
        break;
      }

      // Check if we've fetched all available results
      if (allItems.length >= totalCount) {
        break;
      }
    } catch (error) {
      const apiError = error as GithubApiError;
      config.logger.error('Failed to fetch items page', {
        page,
        error: apiError.message,
        status: apiError.response?.status,
      });
      throw error;
    }
  }

  return allItems;
}
