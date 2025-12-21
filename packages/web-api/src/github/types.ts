/**
 * GitHub API types for issue synchronization
 */

export interface GithubIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  html_url: string;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  labels: Array<{
    name: string;
    color: string;
  }>;
  repository: {
    full_name: string;
    owner: {
      login: string;
    };
    name: string;
  };
  user: {
    login: string;
  };
}

export interface GithubIssueListParams {
  state?: 'open' | 'closed' | 'all';
  filter?: 'assigned' | 'created' | 'mentioned' | 'subscribed' | 'all';
  sort?: 'created' | 'updated' | 'comments';
  direction?: 'asc' | 'desc';
  since?: string; // ISO 8601 timestamp
  per_page?: number;
  page?: number;
}

export interface GithubApiError extends Error {
  status?: number;
  response?: {
    status: number;
    data: {
      message: string;
      documentation_url?: string;
    };
  };
}
