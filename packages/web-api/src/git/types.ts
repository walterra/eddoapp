/**
 * Types for Git repository and worktree management.
 */

/** Repository information */
export interface RepoInfo {
  /** Repository slug (e.g., "elastic/kibana") */
  slug: string;
  /** Git URL for cloning */
  gitUrl: string;
  /** Path to the main clone */
  mainPath: string;
  /** Default branch name */
  defaultBranch: string;
  /** Whether the repo is cloned */
  isCloned: boolean;
  /** Last fetch timestamp */
  lastFetch?: string;
}

/** Worktree information */
export interface WorktreeInfo {
  /** Path to the worktree */
  path: string;
  /** Branch name */
  branch: string;
  /** HEAD commit hash */
  head: string;
  /** Whether there are uncommitted changes */
  isDirty: boolean;
  /** Number of uncommitted files */
  uncommittedCount: number;
  /** Associated session ID */
  sessionId?: string;
}

/** Git status result */
export interface GitStatus {
  /** Whether there are uncommitted changes */
  isDirty: boolean;
  /** Number of staged files */
  staged: number;
  /** Number of modified files */
  modified: number;
  /** Number of untracked files */
  untracked: number;
  /** Current branch */
  branch: string;
  /** Current HEAD commit */
  head: string;
}

/** Clone progress callback */
export type CloneProgressCallback = (progress: CloneProgress) => void;

/** Clone progress information */
export interface CloneProgress {
  /** Current phase (cloning, resolving, etc.) */
  phase: string;
  /** Progress percentage (0-100) */
  percent: number;
  /** Human-readable message */
  message: string;
}

/** Result of a git operation */
export interface GitOperationResult {
  success: boolean;
  message: string;
  error?: string;
}

/** Worktree creation options */
export interface CreateWorktreeOptions {
  /** Session ID to associate with worktree */
  sessionId: string;
  /** Base branch to create worktree from */
  baseBranch?: string;
  /** Specific commit to checkout */
  commit?: string;
}

/** Repository manager configuration */
export interface RepoManagerConfig {
  /** Base directory for cloned repos (default: ~/.eddo/repos) */
  baseDir: string;
  /** Whether to auto-fetch on worktree creation */
  autoFetch: boolean;
  /** Fetch interval in minutes */
  fetchIntervalMinutes: number;
}
