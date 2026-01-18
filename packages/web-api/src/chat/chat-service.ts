/**
 * Chat service orchestrating sessions, git worktrees, and containers.
 */

import { createChatDatabase, type Env } from '@eddo/core-server';
import type { ChatSession, CreateChatSessionRequest, SessionEntry } from '@eddo/core-shared';

import { createContainerManager, type ContainerManager, type RpcEventCallback } from '../docker';
import { createRepoManager, type RepoManager } from '../git';

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
      createSession(ctx, username, req),
    getSession: (username: string, sessionId: string) => getSession(ctx, username, sessionId),
    listSessions: (username: string) => listSessions(ctx, username),
    deleteSession: (username: string, sessionId: string) => deleteSession(ctx, username, sessionId),
    startSession: (username: string, sessionId: string, onEvent?: RpcEventCallback) =>
      startSession(ctx, username, sessionId, onEvent),
    stopSession: (username: string, sessionId: string) => stopSession(ctx, username, sessionId),
    sendPrompt: (username: string, sessionId: string, message: string) =>
      sendPrompt(ctx, username, sessionId, message),
    abortSession: (username: string, sessionId: string) => abortSession(ctx, username, sessionId),
    getSessionEntries: (username: string, sessionId: string) =>
      getSessionEntries(ctx, username, sessionId),
    appendEntry: (
      username: string,
      sessionId: string,
      entry: Omit<SessionEntry, 'id' | 'timestamp'>,
    ) => appendEntry(ctx, username, sessionId, entry),
    isDockerAvailable: () => ctx.containerManager.isDockerAvailable(),
    getRepoManager: () => ctx.repoManager,
    getContainerManager: () => ctx.containerManager,
  };
}

/** Get chat database for a user */
function getChatDb(ctx: ChatServiceContext, username: string) {
  return createChatDatabase(ctx.couchUrl, ctx.env, username);
}

/** Create a new chat session */
async function createSession(
  ctx: ChatServiceContext,
  username: string,
  request: CreateChatSessionRequest,
): Promise<ChatSession> {
  const chatDb = getChatDb(ctx, username);
  await chatDb.ensureDatabase();
  await chatDb.setupDesignDocuments();

  const session = await chatDb.create(request);

  // If repository specified, ensure it's cloned
  if (request.repository) {
    const cloneResult = await ctx.repoManager.ensureRepoCloned(
      request.repository.slug,
      request.repository.gitUrl,
    );
    if (!cloneResult.success) {
      // Update session with error state
      await chatDb.update(session._id, { worktreeState: 'error' });
    }
  }

  return session;
}

/** Get a session by ID */
async function getSession(
  ctx: ChatServiceContext,
  username: string,
  sessionId: string,
): Promise<ChatSession | null> {
  const chatDb = getChatDb(ctx, username);
  return chatDb.get(sessionId);
}

/** List all sessions for a user */
async function listSessions(ctx: ChatServiceContext, username: string): Promise<ChatSession[]> {
  const chatDb = getChatDb(ctx, username);
  try {
    return await chatDb.list();
  } catch {
    return [];
  }
}

/** Delete a session and clean up resources */
async function deleteSession(
  ctx: ChatServiceContext,
  username: string,
  sessionId: string,
): Promise<{ success: boolean; error?: string }> {
  const chatDb = getChatDb(ctx, username);
  const session = await chatDb.get(sessionId);

  if (!session) {
    return { success: false, error: 'Session not found' };
  }

  // Stop and remove container if exists
  if (session.containerId) {
    await ctx.containerManager.removeContainer(sessionId);
  }

  // Remove worktree if exists
  if (session.repository && session.worktreePath) {
    await ctx.repoManager.removeWorktree(session.repository.slug, sessionId);
  }

  // Delete session from database
  await chatDb.delete(sessionId);

  return { success: true };
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

  if (!session) {
    return { success: false, error: 'Session not found' };
  }

  const result = await ctx.containerManager.stopContainer(sessionId);

  if (result.success) {
    await chatDb.update(sessionId, { containerState: 'stopped' });
  }

  return result;
}

/** Send a prompt to the session */
async function sendPrompt(
  ctx: ChatServiceContext,
  username: string,
  sessionId: string,
  message: string,
): Promise<{ success: boolean; error?: string }> {
  const response = await ctx.containerManager.sendRpcCommand(sessionId, {
    type: 'prompt',
    message,
  });

  if (!response || !response.success) {
    return { success: false, error: response?.error ?? 'Failed to send prompt' };
  }

  return { success: true };
}

/** Abort current operation in session */
async function abortSession(
  ctx: ChatServiceContext,
  username: string,
  sessionId: string,
): Promise<{ success: boolean; error?: string }> {
  const response = await ctx.containerManager.sendRpcCommand(sessionId, {
    type: 'abort',
  });

  if (!response || !response.success) {
    return { success: false, error: response?.error ?? 'Failed to abort' };
  }

  return { success: true };
}

/** Get all entries for a session */
async function getSessionEntries(
  ctx: ChatServiceContext,
  username: string,
  sessionId: string,
): Promise<SessionEntry[]> {
  const chatDb = getChatDb(ctx, username);
  return chatDb.getEntries(sessionId);
}

/** Append an entry to a session */
async function appendEntry(
  ctx: ChatServiceContext,
  username: string,
  sessionId: string,
  entry: Omit<SessionEntry, 'id' | 'timestamp'>,
): Promise<string> {
  const chatDb = getChatDb(ctx, username);
  return chatDb.appendEntry(sessionId, entry);
}

export type ChatService = ReturnType<typeof createChatService>;
