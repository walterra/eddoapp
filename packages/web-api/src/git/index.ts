/**
 * Git repository and worktree management module.
 */

export {
  execGit,
  getCurrentBranch,
  getDefaultBranch,
  getHeadCommit,
  isGitAvailable,
  isGitRepo,
} from './git-executor';
export { createRepoManager, type RepoManager } from './repo-manager';
export type {
  CloneProgress,
  CloneProgressCallback,
  CreateWorktreeOptions,
  GitOperationResult,
  GitStatus,
  RepoInfo,
  RepoManagerConfig,
  WorktreeInfo,
} from './types';
