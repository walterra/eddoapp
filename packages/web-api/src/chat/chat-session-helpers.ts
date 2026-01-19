/**
 * Chat session helper functions for CRUD operations.
 */

import { createChatDatabase, getAttachmentsDatabaseName, type Env } from '@eddo/core-server';
import type {
  ChatAttachmentDoc,
  ChatSession,
  ContainerState,
  ContentBlock,
  CreateChatSessionRequest,
  SessionEntry,
  SessionMessageEntry,
} from '@eddo/core-shared';
import nano from 'nano';

import type { ContainerManager } from '../docker';
import type { RepoManager } from '../git';
import { logger } from '../utils/logger';
import { migrateContentImages, processContentImages } from './chat-image-service';

/** Chat service context for helpers */
export interface ChatHelperContext {
  env: Env;
  couchUrl: string;
  repoManager: RepoManager;
}

/** Extended context with container manager for reconciliation */
export interface ChatHelperContextWithContainers extends ChatHelperContext {
  containerManager: ContainerManager;
}

/** Get chat database for a user */
export function getChatDb(
  ctx: ChatHelperContext,
  username: string,
): ReturnType<typeof createChatDatabase> {
  return createChatDatabase(ctx.couchUrl, ctx.env, username);
}

/** Get attachments database for a user */
function getAttachmentsDb(
  ctx: ChatHelperContext,
  username: string,
): nano.DocumentScope<ChatAttachmentDoc> {
  const couchConnection = nano(ctx.couchUrl);
  const dbName = getAttachmentsDatabaseName(ctx.env, username);
  return couchConnection.db.use<ChatAttachmentDoc>(dbName);
}

/**
 * Reconcile session container state with actual Docker container status.
 * Updates the database if the container is no longer running.
 * @param session Session to reconcile
 * @param containerManager Container manager to check actual status
 * @param chatDb Chat database for updates
 * @returns Reconciled session (state may be updated)
 */
async function reconcileContainerState(
  session: ChatSession,
  containerManager: ContainerManager,
  chatDb: ReturnType<typeof createChatDatabase>,
): Promise<ChatSession> {
  // Only reconcile sessions that claim to be running
  if (session.containerState !== 'running') {
    return session;
  }

  try {
    const containerInfo = await containerManager.getContainerInfo(session._id, session.username);

    // Map container info state to actual state, default to stopped if container gone
    let actualState: ContainerState = 'stopped';
    if (containerInfo) {
      actualState = containerInfo.state;
    }

    // If state mismatch, update database and return corrected session
    if (actualState !== session.containerState) {
      logger.info(
        { sessionId: session._id, expected: session.containerState, actual: actualState },
        'Reconciling container state mismatch',
      );
      const updated = await chatDb.update(session._id, { containerState: actualState });
      return updated;
    }
  } catch (error) {
    // If we can't check container status, assume it's stopped
    logger.warn(
      { sessionId: session._id, error },
      'Failed to check container status, marking as stopped',
    );
    const updated = await chatDb.update(session._id, { containerState: 'stopped' });
    return updated;
  }

  return session;
}

/**
 * Reconcile all sessions' container states.
 * @param sessions Sessions to reconcile
 * @param ctx Context with container manager
 * @param username User who owns the sessions
 * @returns Reconciled sessions
 */
async function reconcileAllContainerStates(
  sessions: ChatSession[],
  ctx: ChatHelperContextWithContainers,
  username: string,
): Promise<ChatSession[]> {
  const chatDb = getChatDb(ctx, username);
  const reconciled: ChatSession[] = [];

  for (const session of sessions) {
    const reconciledSession = await reconcileContainerState(session, ctx.containerManager, chatDb);
    reconciled.push(reconciledSession);
  }

  return reconciled;
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

/** Get a session by ID (with optional container state reconciliation) */
export async function getSession(
  ctx: ChatHelperContext | ChatHelperContextWithContainers,
  username: string,
  sessionId: string,
): Promise<ChatSession | null> {
  const chatDb = getChatDb(ctx, username);
  const session = await chatDb.get(sessionId);

  if (!session) return null;

  // Reconcile container state if container manager is available
  if ('containerManager' in ctx) {
    return reconcileContainerState(session, ctx.containerManager, chatDb);
  }

  return session;
}

/** List all sessions for a user (with optional container state reconciliation) */
export async function listSessions(
  ctx: ChatHelperContext | ChatHelperContextWithContainers,
  username: string,
): Promise<ChatSession[]> {
  const chatDb = getChatDb(ctx, username);
  try {
    const sessions = await chatDb.list();

    // Reconcile container states if container manager is available
    if ('containerManager' in ctx) {
      return reconcileAllContainerStates(sessions, ctx, username);
    }

    return sessions;
  } catch {
    return [];
  }
}

/** Get content blocks from a chat message (if it has image-capable content) */
function getMessageContentBlocks(message: SessionMessageEntry['message']): ContentBlock[] | null {
  // BashExecutionMessage doesn't have content property
  if (message.role === 'bashExecution') return null;

  const content = message.content;
  // UserMessage can have string content
  if (typeof content === 'string') return null;

  return content as ContentBlock[];
}

/** Check if content has base64 images */
function hasBase64Images(content: ContentBlock[]): boolean {
  return content.some(
    (block) =>
      block.type === 'image' &&
      'source' in block &&
      (block as { source?: { type?: string; data?: string } }).source?.type === 'base64' &&
      typeof (block as { source?: { type?: string; data?: string } }).source?.data === 'string',
  );
}

/** Check if an entry needs image migration */
function needsImageMigration(entry: SessionEntry): boolean {
  if (entry.type !== 'message') return false;
  const msgEntry = entry as SessionMessageEntry;
  const content = getMessageContentBlocks(msgEntry.message);
  if (!content) return false;

  return hasBase64Images(content);
}

/** Migrate images in entries lazily (on read) */
async function migrateEntriesImages(
  ctx: ChatHelperContext,
  username: string,
  _sessionId: string,
  entries: SessionEntry[],
): Promise<SessionEntry[]> {
  const attachmentsDb = getAttachmentsDb(ctx, username);
  const results: SessionEntry[] = [];

  for (const entry of entries) {
    if (!needsImageMigration(entry)) {
      results.push(entry);
      continue;
    }

    const msgEntry = entry as SessionMessageEntry;
    const content = getMessageContentBlocks(msgEntry.message);
    if (!content) {
      results.push(entry);
      continue;
    }

    try {
      const migrationResult = await migrateContentImages(content, attachmentsDb);
      if (migrationResult.migrated) {
        // Update the entry in the database with migrated content
        const updatedEntry: SessionEntry = {
          ...entry,
          message: {
            ...msgEntry.message,
            content: migrationResult.content,
          },
        } as SessionEntry;

        // Note: We're updating the entry in place. The chatDb doesn't have
        // an updateEntry method, so we'll just return the migrated version
        // for display. The next save will use the new format.
        logger.info({ entryId: entry.id }, 'Lazily migrated images in chat entry');
        results.push(updatedEntry);
      } else {
        results.push(entry);
      }
    } catch (error) {
      logger.error({ error, entryId: entry.id }, 'Failed to migrate images in chat entry');
      results.push(entry);
    }
  }

  return results;
}

/** Get all entries for a session (with lazy image migration) */
export async function getSessionEntries(
  ctx: ChatHelperContext,
  username: string,
  sessionId: string,
): Promise<SessionEntry[]> {
  const chatDb = getChatDb(ctx, username);
  const entries = await chatDb.getEntries(sessionId);

  // Lazily migrate any entries with base64 images
  return migrateEntriesImages(ctx, username, sessionId, entries);
}

/** Options for appending an entry */
export interface AppendEntryOptions {
  ctx: ChatHelperContext;
  username: string;
  sessionId: string;
  entry: Omit<SessionEntry, 'id' | 'timestamp'>;
  timestamp?: string;
}

/** Check if entry has content that may contain images */
function hasImageContent(entry: Omit<SessionEntry, 'id' | 'timestamp'>): boolean {
  if (entry.type !== 'message') return false;
  const msgEntry = entry as Omit<SessionMessageEntry, 'id' | 'timestamp'>;
  const content = getMessageContentBlocks(msgEntry.message);
  return content !== null && content.some((block) => block.type === 'image');
}

/** Process images in message entry and return updated entry */
async function processEntryImages(
  ctx: ChatHelperContext,
  username: string,
  entry: Omit<SessionEntry, 'id' | 'timestamp'>,
): Promise<Omit<SessionEntry, 'id' | 'timestamp'>> {
  if (!hasImageContent(entry)) return entry;

  const attachmentsDb = getAttachmentsDb(ctx, username);
  const msgEntry = entry as Omit<SessionMessageEntry, 'id' | 'timestamp'>;
  const content = getMessageContentBlocks(msgEntry.message);
  if (!content) return entry;

  try {
    const result = await processContentImages(content, attachmentsDb);
    if (result.extractedCount > 0) {
      logger.info(
        { extracted: result.extractedCount, deduplicated: result.deduplicatedCount },
        'Processed images in chat entry',
      );
      return {
        ...entry,
        message: {
          ...msgEntry.message,
          content: result.content,
        },
      } as Omit<SessionEntry, 'id' | 'timestamp'>;
    }
  } catch (error) {
    logger.error({ error }, 'Failed to process images in chat entry, storing inline');
  }

  return entry;
}

/** Append an entry to a session (optionally with a specific timestamp) */
export async function appendEntry(opts: AppendEntryOptions): Promise<string> {
  const chatDb = getChatDb(opts.ctx, opts.username);

  // Process images before saving (extract to attachments, replace with URLs)
  const processedEntry = await processEntryImages(opts.ctx, opts.username, opts.entry);

  return chatDb.appendEntryWithTimestamp(opts.sessionId, processedEntry, opts.timestamp);
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
