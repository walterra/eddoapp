/**
 * GitHub Search API query builders
 */

import type { GithubIssueListParams } from './types.js';

/**
 * Add date filter to query parts
 */
function addDateFilter(queryParts: string[], since?: string): void {
  if (since) {
    // GitHub search expects format: >=YYYY-MM-DD
    const sinceDate = since.split('T')[0]; // Extract date part from ISO string
    queryParts.push(`updated:>=${sinceDate}`);
  }
}

/**
 * Add state filter to query parts
 */
function addStateFilter(queryParts: string[], state?: string): void {
  if (state === 'open') {
    queryParts.push('state:open');
  } else if (state === 'closed') {
    queryParts.push('state:closed');
  }
  // For 'all', don't add state filter (includes both open and closed)
}

/**
 * Builds GitHub search query for assigned items (issues and PRs)
 */
export function buildAssignedQuery(params: GithubIssueListParams): string {
  const queryParts: string[] = ['assignee:@me'];
  addStateFilter(queryParts, params.state);
  addDateFilter(queryParts, params.since);
  return queryParts.join(' ');
}

/**
 * Builds GitHub search query for PR reviews requested from user
 * Note: Only returns PRs where user is CURRENTLY a requested reviewer.
 * Once merged/closed, review requests are cleared and PRs won't match.
 */
export function buildReviewRequestedQuery(params: GithubIssueListParams): string {
  const queryParts: string[] = ['is:pr', 'review-requested:@me'];
  addStateFilter(queryParts, params.state);
  addDateFilter(queryParts, params.since);
  return queryParts.join(' ');
}

/**
 * Builds GitHub search query for PRs user has reviewed.
 * Unlike review-requested:@me, this persists after PR closure.
 * Used to detect merged/closed PRs that need completion in Eddo.
 */
export function buildReviewedByQuery(params: GithubIssueListParams): string {
  const queryParts: string[] = ['is:pr', 'reviewed-by:@me'];
  addStateFilter(queryParts, params.state);
  addDateFilter(queryParts, params.since);
  return queryParts.join(' ');
}
