/**
 * Parses and validates GitHub issue external ID
 *
 * Format: "github:owner/repo/issues/number"
 * Example: "github:walterra/eddoapp/issues/1234"
 *
 * @param externalId - External ID string to parse
 * @returns Parsed components or null if invalid
 */
export interface GitHubIssueId {
  owner: string;
  repo: string;
  number: number;
}

export function parseGitHubIssueId(externalId: string): GitHubIssueId | null {
  if (!externalId || typeof externalId !== 'string') {
    return null;
  }

  const parts = externalId.split(':');
  if (parts.length !== 2 || parts[0] !== 'github') {
    return null;
  }

  const pathParts = parts[1].split('/');
  if (pathParts.length !== 4 || pathParts[2] !== 'issues') {
    return null;
  }

  const [owner, repo, , numberStr] = pathParts;
  const number = parseInt(numberStr, 10);

  if (!owner || !repo || isNaN(number) || number <= 0) {
    return null;
  }

  return { owner, repo, number };
}

/**
 * Formats GitHub issue components into external ID string
 *
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param number - Issue number
 * @returns Formatted external ID
 */
export function formatGitHubIssueId(owner: string, repo: string, number: number): string {
  if (!owner || !repo || !number || number <= 0) {
    throw new Error('Invalid GitHub issue components');
  }
  return `github:${owner}/${repo}/issues/${number}`;
}

/**
 * Validates if external ID is a GitHub issue reference
 *
 * @param externalId - External ID to validate
 * @returns True if valid GitHub issue ID
 */
export function isGitHubIssueId(externalId: string | null | undefined): boolean {
  if (!externalId) return false;
  return parseGitHubIssueId(externalId) !== null;
}
