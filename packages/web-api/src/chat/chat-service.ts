/**
 * Chat service orchestrating sessions, git worktrees, and containers.
 */

import { createChatDatabase, type Env } from '@eddo/core-server';
import type { ChatSession, CreateChatSessionRequest, SessionEntry } from '@eddo/core-shared';

import { createContainerManager, type ContainerManager, type RpcEventCallback } from '../docker';
import { createRepoManager, type RepoManager } from '../git';
import {
  appendEntry as appendEntryHelper,
  createSession as createSessionHelper,
  deleteSession as deleteSessionHelper,
  getChatDb,
  getSessionEntries as getSessionEntriesHelper,
  getSession as getSessionHelper,
  listSessions as listSessionsHelper,
} from './chat-session-helpers';

/** Chat service configuration */
export interface ChatServiceConfig {
  env: Env;
  couchUrl: string;
}

/** Chat service context */
interface ChatServiceContext {
  env: Env;
  couchUrl: string;
  repoManager: RepoManager;
  containerManager: ContainerManager;
}

/** Create a chat service instance */
export function createChatService(config: ChatServiceConfig) {
  const ctx: ChatServiceContext = {
    env: config.env,
    couchUrl: config.couchUrl,
    repoManager: createRepoManager(),
    containerManager: createContainerManager(),
  };

  return {
    createSession: (username: string, req: CreateChatSessionRequest) =>
      createSessionHelper(ctx, username, req),
    getSession: (username: string, sessionId: string) => getSessionHelper(ctx, username, sessionId),
    listSessions: (username: string) => listSessionsHelper(ctx, username),
    deleteSession: (username: string, sessionId: string) =>
      deleteSessionHelper(
        {
          ...ctx,
          removeContainer: (sid, uname) => ctx.containerManager.removeContainer(sid, uname),
          removeWorktree: (slug, sid) => ctx.repoManager.removeWorktree(slug, sid),
        },
        username,
        sessionId,
      ),
    startSession: (username: string, sessionId: string, onEvent?: RpcEventCallback) =>
      startSession(ctx, username, sessionId, onEvent),
    stopSession: (username: string, sessionId: string) => stopSession(ctx, username, sessionId),
    sendPrompt: (username: string, sessionId: string, message: string) =>
      sendPrompt(ctx, username, sessionId, message),
    abortSession: (username: string, sessionId: string) => abortSession(ctx, username, sessionId),
    getSessionEntries: (username: string, sessionId: string) =>
      getSessionEntriesHelper(ctx, username, sessionId),
    appendEntry: (
      username: string,
      sessionId: string,
      entry: Omit<SessionEntry, 'id' | 'timestamp'>,
    ) => appendEntryHelper({ ctx, username, sessionId, entry }),
    appendEntryWithTimestamp: (
      username: string,
      sessionId: string,
      entry: Omit<SessionEntry, 'id' | 'timestamp'>,
      timestamp?: string,
    ) => appendEntryHelper({ ctx, username, sessionId, entry, timestamp }),
    isDockerAvailable: () => ctx.containerManager.isDockerAvailable(),
    getRepoManager: () => ctx.repoManager,
    getContainerManager: () => ctx.containerManager,
  };
}


/** Ensure worktree is created for a session */
async function ensureWorktree(
  ctx: ChatServiceContext,
  chatDb: ReturnType<typeof getChatDb>,
  session: ChatSession,
  sessionId: string,
): Promise<{ success: boolean; error?: string }> {
  if (!session.repository || session.worktreeState === 'ready') {
    return { success: true };
  }

  await chatDb.update(sessionId, { worktreeState: 'creating' });

  const worktreeResult = await ctx.repoManager.createWorktree(session.repository.slug, {
    sessionId,
    baseBranch: session.repository.ref ?? session.repository.defaultBranch,
  });

  if (!worktreeResult.success) {
    await chatDb.update(sessionId, { worktreeState: 'error' });
    return { success: false, error: worktreeResult.error };
  }

  const worktreeInfo = await ctx.repoManager.getWorktreeInfo(session.repository.slug, sessionId);
  await chatDb.update(sessionId, { worktreeState: 'ready', worktreePath: worktreeInfo?.path });

  return { success: true };
}

/** Start a session (create worktree and spawn container) */
async function startSession(
  ctx: ChatServiceContext,
  username: string,
  sessionId: string,
  onEvent?: RpcEventCallback,
): Promise<{ success: boolean; error?: string }> {
  const chatDb = getChatDb(ctx, username);
  const session = await chatDb.get(sessionId);

  if (!session) return { success: false, error: 'Session not found' };
  if (session.containerState === 'running') return { success: true };

  // Create worktree if needed
  const worktreeResult = await ensureWorktree(ctx, chatDb, session, sessionId);
  if (!worktreeResult.success) return worktreeResult;

  // Get updated session
  const updatedSession = await chatDb.get(sessionId);
  if (!updatedSession) return { success: false, error: 'Session disappeared' };

  // Spawn container
  await chatDb.update(sessionId, { containerState: 'creating' });
  const workspacePath = updatedSession.worktreePath ?? '/tmp/eddo-workspace';
  const sessionDir = `/tmp/eddo-sessions/${sessionId}`;

  const spawnResult = await ctx.containerManager.spawnContainer({
    sessionId,
    config: {
      image: 'pi-coding-agent:latest',
      workspacePath,
      sessionDir,
    },
    onEvent,
  });

  if (!spawnResult.success) {
    await chatDb.update(sessionId, { containerState: 'error' });
    return { success: false, error: spawnResult.error };
  }

  await chatDb.update(sessionId, {
    containerState: 'running',
    containerId: spawnResult.containerId,
  });

  return { success: true };
}

/** Stop a session (stop container) */
async function stopSession(
  ctx: ChatServiceContext,
  username: string,
  sessionId: string,
): Promise<{ success: boolean; error?: string }> {
  const chatDb = getChatDb(ctx, username);
  const session = await chatDb.get(sessionId);
  if (!session) return { success: false, error: 'Session not found' };

  const result = await ctx.containerManager.stopContainer(sessionId, username);
  if (result.success) await chatDb.update(sessionId, { containerState: 'stopped' });
  return result;
}

/** Send a prompt to the session */
async function sendPrompt(
  ctx: ChatServiceContext,
  username: string,
  sessionId: string,
  message: string,
): Promise<{ success: boolean; error?: string }> {
  const resp = await ctx.containerManager.sendRpcCommand(sessionId, { type: 'prompt', message });
  return resp?.success
    ? { success: true }
    : { success: false, error: resp?.error ?? 'Failed to send' };
}

/** Abort current operation in session */
async function abortSession(
  ctx: ChatServiceContext,
  username: string,
  sessionId: string,
): Promise<{ success: boolean; error?: string }> {
  const resp = await ctx.containerManager.sendRpcCommand(sessionId, { type: 'abort' });
  return resp?.success
    ? { success: true }
    : { success: false, error: resp?.error ?? 'Failed to abort' };
}

export type ChatService = ReturnType<typeof createChatService>;
