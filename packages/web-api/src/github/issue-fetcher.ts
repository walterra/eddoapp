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

interface FetchPageParams {
  searchQuery: string;
  page: number;
  perPage: number;
  sortField: 'created' | 'updated';
  sortOrder: 'asc' | 'desc';
}

/**
 * Fetch a single page of results
 */
async function fetchPage(
  config: FetchConfig,
  params: FetchPageParams,
): Promise<{ items: GithubIssue[]; totalCount: number }> {
  const { searchQuery, page, perPage, sortField, sortOrder } = params;

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

interface PaginationState {
  itemsCount: number;
  allItemsCount: number;
  perPage: number;
  page: number;
  totalCount: number;
}

/** Determines if pagination should stop based on current state */
function shouldStopPagination(state: PaginationState): {
  stop: boolean;
  reason?: 'empty' | 'partial' | 'limit' | 'complete';
} {
  if (state.itemsCount === 0) return { stop: true, reason: 'empty' };
  if (state.itemsCount < state.perPage) return { stop: true, reason: 'partial' };
  if (state.page > 10) return { stop: true, reason: 'limit' };
  if (state.allItemsCount >= state.totalCount) return { stop: true, reason: 'complete' };
  return { stop: false };
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
      const { items, totalCount } = await fetchPage(config, {
        searchQuery,
        page,
        perPage,
        sortField,
        sortOrder,
      });

      allItems.push(...items);
      page++;

      const { stop, reason } = shouldStopPagination({
        itemsCount: items.length,
        allItemsCount: allItems.length,
        perPage,
        page,
        totalCount,
      });

      if (stop && reason === 'limit') {
        config.logger.warn('Reached GitHub Search API limit (1000 results max)', {
          totalItems: allItems.length,
        });
      }

      if (stop) break;
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
