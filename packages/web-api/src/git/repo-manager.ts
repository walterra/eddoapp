/**
 * Repository manager for git clone and worktree operations.
 * Implements clone-once strategy with instant worktree creation for sessions.
 */

import { mkdir, readdir, rm, stat } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';

import {
  execGit,
  getCurrentBranch,
  getDefaultBranch,
  getHeadCommit,
  isGitRepo,
} from './git-executor';
import type {
  CreateWorktreeOptions,
  GitOperationResult,
  GitStatus,
  RepoInfo,
  RepoManagerConfig,
  WorktreeInfo,
} from './types';

const DEFAULT_CONFIG: RepoManagerConfig = {
  baseDir: join(homedir(), '.eddo', 'repos'),
  autoFetch: true,
  fetchIntervalMinutes: 60,
};

interface RepoManagerContext {
  config: RepoManagerConfig;
}

/** Create a repository manager instance */
export function createRepoManager(config?: Partial<RepoManagerConfig>) {
  const ctx: RepoManagerContext = {
    config: { ...DEFAULT_CONFIG, ...config },
  };

  return {
    ensureRepoCloned: (slug: string, gitUrl: string) => ensureRepoCloned(ctx, slug, gitUrl),
    getRepoInfo: (slug: string) => getRepoInfo(ctx, slug),
    createWorktree: (slug: string, opts: CreateWorktreeOptions) => createWorktree(ctx, slug, opts),
    removeWorktree: (slug: string, sessionId: string) => removeWorktree(ctx, slug, sessionId),
    getWorktreeInfo: (slug: string, sessionId: string) => getWorktreeInfo(ctx, slug, sessionId),
    listWorktrees: (slug: string) => listWorktrees(ctx, slug),
    getWorktreeStatus: (path: string) => getWorktreeStatus(path),
    fetchRepo: (slug: string) => fetchRepo(ctx, slug),
    getConfig: () => ctx.config,
  };
}

/** Ensure base directory exists */
async function ensureBaseDir(ctx: RepoManagerContext): Promise<void> {
  await mkdir(ctx.config.baseDir, { recursive: true });
}

/** Get path to main clone for a repo */
function getMainPath(ctx: RepoManagerContext, slug: string): string {
  const safeSlug = slug.replace('/', '_');
  return join(ctx.config.baseDir, safeSlug, 'main');
}

/** Get path to worktrees directory for a repo */
function getWorktreesPath(ctx: RepoManagerContext, slug: string): string {
  const safeSlug = slug.replace('/', '_');
  return join(ctx.config.baseDir, safeSlug, 'worktrees');
}

/** Get path to a specific worktree */
function getWorktreePath(ctx: RepoManagerContext, slug: string, sessionId: string): string {
  return join(getWorktreesPath(ctx, slug), sessionId);
}

/** Ensure a repository is cloned */
async function ensureRepoCloned(
  ctx: RepoManagerContext,
  slug: string,
  gitUrl: string,
): Promise<GitOperationResult> {
  await ensureBaseDir(ctx);
  const mainPath = getMainPath(ctx, slug);

  // Check if already cloned
  try {
    const stats = await stat(mainPath);
    if (stats.isDirectory() && (await isGitRepo(mainPath))) {
      return { success: true, message: `Repository already cloned at ${mainPath}` };
    }
  } catch {
    // Directory doesn't exist, proceed with clone
  }

  // Create parent directory
  const parentDir = join(mainPath, '..');
  await mkdir(parentDir, { recursive: true });

  // Clone the repository
  const result = await execGit(parentDir, ['clone', '--bare', gitUrl, 'main.git']);
  if (result.exitCode !== 0) {
    return { success: false, message: 'Clone failed', error: result.stderr };
  }

  // Create a working directory from the bare clone
  const bareDir = join(parentDir, 'main.git');
  const worktreeResult = await execGit(bareDir, ['worktree', 'add', mainPath, 'HEAD']);
  if (worktreeResult.exitCode !== 0) {
    return {
      success: false,
      message: 'Failed to create main worktree',
      error: worktreeResult.stderr,
    };
  }

  return { success: true, message: `Cloned ${slug} to ${mainPath}` };
}

/** Get information about a cloned repository */
async function getRepoInfo(ctx: RepoManagerContext, slug: string): Promise<RepoInfo | null> {
  const mainPath = getMainPath(ctx, slug);

  try {
    const stats = await stat(mainPath);
    if (!stats.isDirectory()) return null;

    const isRepo = await isGitRepo(mainPath);
    if (!isRepo) return null;

    const defaultBranch = await getDefaultBranch(mainPath);

    return {
      slug,
      gitUrl: '', // Would need to read from config
      mainPath,
      defaultBranch,
      isCloned: true,
    };
  } catch {
    return null;
  }
}

/** Create a worktree for a session */
async function createWorktree(
  ctx: RepoManagerContext,
  slug: string,
  opts: CreateWorktreeOptions,
): Promise<GitOperationResult> {
  const mainPath = getMainPath(ctx, slug);
  const worktreePath = getWorktreePath(ctx, slug, opts.sessionId);
  const worktreesDir = getWorktreesPath(ctx, slug);

  // Ensure repo is cloned
  const repoInfo = await getRepoInfo(ctx, slug);
  if (!repoInfo) {
    return { success: false, message: `Repository ${slug} not cloned` };
  }

  // Fetch latest if configured
  if (ctx.config.autoFetch) {
    await fetchRepo(ctx, slug);
  }

  // Ensure worktrees directory exists
  await mkdir(worktreesDir, { recursive: true });

  // Determine base ref
  const baseBranch = opts.baseBranch ?? repoInfo.defaultBranch;
  const branchName = `session-${opts.sessionId}`;

  // Create worktree with a new branch
  const result = await execGit(mainPath, [
    'worktree',
    'add',
    '-b',
    branchName,
    worktreePath,
    opts.commit ?? `origin/${baseBranch}`,
  ]);

  if (result.exitCode !== 0) {
    return { success: false, message: 'Failed to create worktree', error: result.stderr };
  }

  return { success: true, message: `Created worktree at ${worktreePath}` };
}

/** Remove a worktree for a session */
async function removeWorktree(
  ctx: RepoManagerContext,
  slug: string,
  sessionId: string,
): Promise<GitOperationResult> {
  const mainPath = getMainPath(ctx, slug);
  const worktreePath = getWorktreePath(ctx, slug, sessionId);
  const branchName = `session-${sessionId}`;

  // Check if worktree exists
  try {
    await stat(worktreePath);
  } catch {
    return { success: true, message: 'Worktree does not exist' };
  }

  // Remove the worktree
  const result = await execGit(mainPath, ['worktree', 'remove', '--force', worktreePath]);
  if (result.exitCode !== 0) {
    // Try manual removal as fallback
    try {
      await rm(worktreePath, { recursive: true, force: true });
      await execGit(mainPath, ['worktree', 'prune']);
    } catch {
      return { success: false, message: 'Failed to remove worktree', error: result.stderr };
    }
  }

  // Delete the session branch
  await execGit(mainPath, ['branch', '-D', branchName]);

  return { success: true, message: `Removed worktree for session ${sessionId}` };
}

/** Get worktree information */
async function getWorktreeInfo(
  ctx: RepoManagerContext,
  slug: string,
  sessionId: string,
): Promise<WorktreeInfo | null> {
  const worktreePath = getWorktreePath(ctx, slug, sessionId);

  try {
    await stat(worktreePath);
  } catch {
    return null;
  }

  const branch = (await getCurrentBranch(worktreePath)) ?? 'unknown';
  const head = (await getHeadCommit(worktreePath)) ?? 'unknown';
  const status = await getWorktreeStatus(worktreePath);

  return {
    path: worktreePath,
    branch,
    head,
    isDirty: status.isDirty,
    uncommittedCount: status.staged + status.modified + status.untracked,
    sessionId,
  };
}

/** List all worktrees for a repository */
async function listWorktrees(ctx: RepoManagerContext, slug: string): Promise<WorktreeInfo[]> {
  const worktreesDir = getWorktreesPath(ctx, slug);

  let dirNames: string[];
  try {
    const entries = await readdir(worktreesDir, { withFileTypes: true });
    dirNames = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }

  const worktrees: WorktreeInfo[] = [];
  for (const name of dirNames) {
    const info = await getWorktreeInfo(ctx, slug, name);
    if (info) worktrees.push(info);
  }

  return worktrees;
}

/** Get git status for a worktree */
async function getWorktreeStatus(path: string): Promise<GitStatus> {
  const statusResult = await execGit(path, ['status', '--porcelain']);
  const branchResult = await getCurrentBranch(path);
  const headResult = await getHeadCommit(path);

  const lines = statusResult.stdout.split('\n').filter(Boolean);

  let staged = 0;
  let modified = 0;
  let untracked = 0;

  for (const line of lines) {
    const indexStatus = line[0];
    const workTreeStatus = line[1];

    if (indexStatus !== ' ' && indexStatus !== '?') staged++;
    if (workTreeStatus !== ' ' && workTreeStatus !== '?') modified++;
    if (indexStatus === '?' && workTreeStatus === '?') untracked++;
  }

  return {
    isDirty: lines.length > 0,
    staged,
    modified,
    untracked,
    branch: branchResult ?? 'unknown',
    head: headResult ?? 'unknown',
  };
}

/** Fetch latest changes from remote */
async function fetchRepo(ctx: RepoManagerContext, slug: string): Promise<GitOperationResult> {
  const mainPath = getMainPath(ctx, slug);

  const result = await execGit(mainPath, ['fetch', '--all', '--prune']);
  if (result.exitCode !== 0) {
    return { success: false, message: 'Fetch failed', error: result.stderr };
  }

  return { success: true, message: 'Fetched latest changes' };
}

export type RepoManager = ReturnType<typeof createRepoManager>;
