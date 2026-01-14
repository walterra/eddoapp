/**
 * Low-level git command executor.
 * Wraps child_process.exec with proper error handling.
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/** Git command execution result */
export interface GitExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/** Execute a git command in a directory */
export async function execGit(cwd: string, args: string[]): Promise<GitExecResult> {
  const command = `git ${args.join(' ')}`;

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd,
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large outputs
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: '0', // Disable prompts
        GIT_SSH_COMMAND: 'ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new',
      },
    });
    return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode: 0 };
  } catch (error: unknown) {
    const execError = error as { stdout?: string; stderr?: string; code?: number };
    return {
      stdout: execError.stdout?.trim() ?? '',
      stderr: execError.stderr?.trim() ?? '',
      exitCode: execError.code ?? 1,
    };
  }
}

/** Check if git is available */
export async function isGitAvailable(): Promise<boolean> {
  try {
    const result = await execGit('.', ['--version']);
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

/** Get the current branch name */
export async function getCurrentBranch(cwd: string): Promise<string | null> {
  const result = await execGit(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']);
  return result.exitCode === 0 ? result.stdout : null;
}

/** Get the current HEAD commit hash */
export async function getHeadCommit(cwd: string): Promise<string | null> {
  const result = await execGit(cwd, ['rev-parse', 'HEAD']);
  return result.exitCode === 0 ? result.stdout : null;
}

/** Check if a directory is a git repository */
export async function isGitRepo(cwd: string): Promise<boolean> {
  const result = await execGit(cwd, ['rev-parse', '--git-dir']);
  return result.exitCode === 0;
}

/** Get the default branch from remote */
export async function getDefaultBranch(cwd: string): Promise<string> {
  // Try to get from remote HEAD
  const result = await execGit(cwd, ['symbolic-ref', 'refs/remotes/origin/HEAD', '--short']);
  if (result.exitCode === 0) {
    // Returns "origin/main" or "origin/master", strip the "origin/" prefix
    return result.stdout.replace('origin/', '');
  }
  // Fall back to common defaults
  const checkMain = await execGit(cwd, ['show-ref', '--verify', 'refs/heads/main']);
  return checkMain.exitCode === 0 ? 'main' : 'master';
}
