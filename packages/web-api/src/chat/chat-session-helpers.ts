/**
 * Chat session helper functions for CRUD operations.
 */

import { createChatDatabase, type Env } from '@eddo/core-server';
import type { ChatSession, CreateChatSessionRequest, SessionEntry } from '@eddo/core-shared';

import type { RepoManager } from '../git';

/** Chat service context for helpers */
export interface ChatHelperContext {
  env: Env;
  couchUrl: string;
  repoManager: RepoManager;
}

/** Get chat database for a user */
export function getChatDb(
  ctx: ChatHelperContext,
  username: string,
): ReturnType<typeof createChatDatabase> {
  return createChatDatabase(ctx.couchUrl, ctx.env, username);
}

/** Create a new chat session */
export async function createSession(
  ctx: ChatHelperContext,
  username: string,
  request: CreateChatSessionRequest,
): Promise<ChatSession> {
  const chatDb = getChatDb(ctx, username);
  await chatDb.ensureDatabase();
  await chatDb.setupDesignDocuments();

  const session = await chatDb.create(request);

  if (request.repository) {
    const cloneResult = await ctx.repoManager.ensureRepoCloned(
      request.repository.slug,
      request.repository.gitUrl,
    );
    if (!cloneResult.success) {
      await chatDb.update(session._id, { worktreeState: 'error' });
    }
  }

  return session;
}

/** Get a session by ID */
export async function getSession(
  ctx: ChatHelperContext,
  username: string,
  sessionId: string,
): Promise<ChatSession | null> {
  const chatDb = getChatDb(ctx, username);
  return chatDb.get(sessionId);
}

/** List all sessions for a user */
export async function listSessions(
  ctx: ChatHelperContext,
  username: string,
): Promise<ChatSession[]> {
  const chatDb = getChatDb(ctx, username);
  try {
    return await chatDb.list();
  } catch {
    return [];
  }
}

/** Get all entries for a session */
export async function getSessionEntries(
  ctx: ChatHelperContext,
  username: string,
  sessionId: string,
): Promise<SessionEntry[]> {
  const chatDb = getChatDb(ctx, username);
  return chatDb.getEntries(sessionId);
}

/** Options for appending an entry */
export interface AppendEntryOptions {
  ctx: ChatHelperContext;
  username: string;
  sessionId: string;
  entry: Omit<SessionEntry, 'id' | 'timestamp'>;
  timestamp?: string;
}

/** Append an entry to a session (optionally with a specific timestamp) */
export async function appendEntry(opts: AppendEntryOptions): Promise<string> {
  const chatDb = getChatDb(opts.ctx, opts.username);
  return chatDb.appendEntryWithTimestamp(opts.sessionId, opts.entry, opts.timestamp);
}

/** Delete session options */
export interface DeleteSessionContext extends ChatHelperContext {
  removeContainer: (sessionId: string, username: string) => Promise<unknown>;
  removeWorktree: (slug: string, sessionId: string) => Promise<{ success: boolean }>;
}

/** Delete a session and clean up resources */
export async function deleteSession(
  ctx: DeleteSessionContext,
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
    await ctx.removeContainer(sessionId, username);
  }

  // Remove worktree if exists
  if (session.repository && session.worktreePath) {
    await ctx.removeWorktree(session.repository.slug, sessionId);
  }

  // Delete session from database
  await chatDb.delete(sessionId);

  return { success: true };
}
