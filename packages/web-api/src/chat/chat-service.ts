/**
 * Chat service orchestrating sessions, git worktrees, and containers.
 */

import type { Env } from '@eddo/core-server';
import type { ChatSession, CreateChatSessionRequest, SessionEntry } from '@eddo/core-shared';

import {
  createContainerManager,
  createSearxngManager,
  type ContainerManager,
  type RpcEventCallback,
  type SearxngManager,
} from '../docker';
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
import { prepareAndSpawnContainer, type ContainerContext } from './container-operations';
import { clearSetupLogs, logStepCompleted, logStepFailed, logStepStarted } from './setup-logging';

/** Chat service configuration */
export interface ChatServiceConfig {
  env: Env;
  couchUrl: string;
}

/** Chat service context */
interface ChatServiceContext extends ContainerContext {
  env: Env;
  couchUrl: string;
  repoManager: RepoManager;
  containerManager: ContainerManager;
  searxngManager: SearxngManager;
}

/** Create a chat service instance */
export function createChatService(config: ChatServiceConfig) {
  const ctx: ChatServiceContext = {
    env: config.env,
    couchUrl: config.couchUrl,
    repoManager: createRepoManager(),
    containerManager: createContainerManager(),
    searxngManager: createSearxngManager(),
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

  await logStepStarted(chatDb, sessionId, 'worktree', `Creating worktree...`);
  await chatDb.update(sessionId, { worktreeState: 'creating' });

  const worktreeResult = await ctx.repoManager.createWorktree(session.repository.slug, {
    sessionId,
    baseBranch: session.repository.ref ?? session.repository.defaultBranch,
  });

  if (!worktreeResult.success) {
    const errorMsg = worktreeResult.error ?? 'Unknown error creating worktree';
    await logStepFailed({
      chatDb,
      sessionId,
      step: 'worktree',
      message: 'Failed to create worktree',
      error: errorMsg,
    });
    await chatDb.update(sessionId, { worktreeState: 'error' });
    return { success: false, error: errorMsg };
  }

  const worktreeInfo = await ctx.repoManager.getWorktreeInfo(session.repository.slug, sessionId);
  await chatDb.update(sessionId, { worktreeState: 'ready', worktreePath: worktreeInfo?.path });
  await logStepCompleted(chatDb, sessionId, 'worktree', `Worktree created`);

  return { success: true };
}

/** Ensure repository is cloned and up-to-date */
async function ensureRepoReady(
  ctx: ChatServiceContext,
  chatDb: ReturnType<typeof getChatDb>,
  session: ChatSession,
  sessionId: string,
): Promise<{ success: boolean; error?: string }> {
  if (!session.repository) return { success: true };

  const { slug, gitUrl } = session.repository;
  const repoInfo = await ctx.repoManager.getRepoInfo(slug);

  if (!repoInfo) {
    await logStepStarted(chatDb, sessionId, 'clone', `Cloning ${slug}...`);
    const cloneResult = await ctx.repoManager.ensureRepoCloned(slug, gitUrl);
    if (!cloneResult.success) {
      const errorMsg = cloneResult.error ?? 'Unknown error cloning repository';
      await logStepFailed({
        chatDb,
        sessionId,
        step: 'clone',
        message: 'Failed to clone repository',
        error: errorMsg,
      });
      return { success: false, error: errorMsg };
    }
    await logStepCompleted(chatDb, sessionId, 'clone', 'Repository cloned successfully');
  }

  await logStepStarted(chatDb, sessionId, 'fetch', 'Fetching latest changes...');
  const fetchResult = await ctx.repoManager.fetchRepo(slug);
  const fetchMsg = fetchResult.success
    ? 'Fetched latest changes'
    : 'Fetch skipped (may be offline)';
  await logStepCompleted(chatDb, sessionId, 'fetch', fetchMsg);

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

  await clearSetupLogs(chatDb, sessionId);

  const dockerAvailable = await ctx.containerManager.isDockerAvailable();
  if (!dockerAvailable) {
    const errorMsg = 'Docker is not available. Please ensure Docker is running.';
    await logStepFailed({
      chatDb,
      sessionId,
      step: 'container',
      message: 'Docker check failed',
      error: errorMsg,
    });
    return { success: false, error: errorMsg };
  }

  const repoResult = await ensureRepoReady(ctx, chatDb, session, sessionId);
  if (!repoResult.success) return repoResult;

  const worktreeResult = await ensureWorktree(ctx, chatDb, session, sessionId);
  if (!worktreeResult.success) return worktreeResult;

  const updatedSession = await chatDb.get(sessionId);
  if (!updatedSession) return { success: false, error: 'Session disappeared' };

  return prepareAndSpawnContainer({
    ctx,
    chatDb,
    session: updatedSession,
    sessionId,
    username,
    onEvent,
  });
}

/** Stop a session (stop and remove container) */
async function stopSession(
  ctx: ChatServiceContext,
  username: string,
  sessionId: string,
): Promise<{ success: boolean; error?: string }> {
  const chatDb = getChatDb(ctx, username);
  const session = await chatDb.get(sessionId);
  if (!session) return { success: false, error: 'Session not found' };

  // Remove container (this also stops it if running)
  const result = await ctx.containerManager.removeContainer(sessionId, username);
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
