import {
  type ChatMessageDoc,
  type ChatSession,
  type ChatSessionOperations,
  type CreateChatSessionRequest,
  type SessionEntry,
  type SessionMessageEntry,
  type UpdateChatSessionRequest,
  createDefaultSessionStats,
  getRandomHex,
} from '@eddo/core-shared';
import nano from 'nano';

import { type Env } from '../config/env';
import { getChatDatabaseName } from '../utils/database-names';
import { setupChatDesignDocuments } from './chat-design-docs';
import { applyStatsDelta, calculateMessageStatsDelta } from './chat-stats';

interface ChatDatabaseContext {
  db: nano.DocumentScope<ChatSession | ChatMessageDoc>;
  couchConnection: nano.ServerScope;
  env: Env;
  username: string;
}

interface ChatDatabaseExtendedOperations {
  ensureDatabase: () => Promise<void>;
  setupDesignDocuments: () => Promise<void>;
}

interface ChatDatabaseInstance extends ChatSessionOperations, ChatDatabaseExtendedOperations {}

const isNotFoundError = (err: unknown): boolean =>
  Boolean(err && typeof err === 'object' && 'statusCode' in err && err.statusCode === 404);

const generateSessionId = (): string => `session_${new Date().toISOString()}_${getRandomHex(4)}`;

const generateEntryId = (): string => getRandomHex(4);

/** Create a chat database instance for a user */
export function createChatDatabase(
  couchUrl: string,
  env: Env,
  username: string,
): ChatDatabaseInstance {
  const couchConnection = nano(couchUrl);
  const dbName = getChatDatabaseName(env, username);
  const db = couchConnection.db.use<ChatSession | ChatMessageDoc>(dbName);

  const context: ChatDatabaseContext = {
    db,
    couchConnection,
    env,
    username,
  };

  return {
    create: (request: CreateChatSessionRequest) => createSession(context, request),
    get: (sessionId: string) => getSession(context, sessionId),
    list: () => listSessions(context),
    update: (sessionId: string, updates: UpdateChatSessionRequest) =>
      updateSession(context, sessionId, updates),
    delete: (sessionId: string) => deleteSession(context, sessionId),
    appendEntry: (sessionId: string, entry: Omit<SessionEntry, 'id' | 'timestamp'>) =>
      appendEntry(context, sessionId, entry),
    getEntries: (sessionId: string) => getEntries(context, sessionId),
    getBranch: (sessionId: string, fromEntryId?: string) =>
      getBranch(context, sessionId, fromEntryId),
    ensureDatabase: () => ensureDatabase(context),
    setupDesignDocuments: () =>
      setupChatDesignDocuments(
        context.couchConnection,
        getChatDatabaseName(context.env, context.username),
      ),
  };
}

async function ensureDatabase(context: ChatDatabaseContext): Promise<void> {
  const dbName = getChatDatabaseName(context.env, context.username);
  try {
    await context.couchConnection.db.get(dbName);
  } catch (error: unknown) {
    if (!isNotFoundError(error)) throw error;
    await context.couchConnection.db.create(dbName);
    console.log(`Created chat database: ${dbName}`);
  }
}

async function createSession(
  context: ChatDatabaseContext,
  request: CreateChatSessionRequest,
): Promise<ChatSession> {
  const now = new Date().toISOString();
  const session: ChatSession = {
    _id: generateSessionId(),
    version: 'alpha1',
    username: context.username,
    name: request.name,
    createdAt: now,
    updatedAt: now,
    repository: request.repository,
    containerState: 'pending',
    worktreeState: 'pending',
    stats: createDefaultSessionStats(),
    parentSessionId: request.parentSessionId,
  };
  const result = await context.db.insert(session as ChatSession | ChatMessageDoc);
  return { ...session, _rev: result.rev };
}

async function getSession(ctx: ChatDatabaseContext, id: string): Promise<ChatSession | null> {
  try {
    const doc = await ctx.db.get(id);
    return 'version' in doc && doc.version === 'alpha1' ? (doc as ChatSession) : null;
  } catch (error: unknown) {
    if (isNotFoundError(error)) return null;
    throw error;
  }
}

/** List all sessions (newest first) */
async function listSessions(context: ChatDatabaseContext): Promise<ChatSession[]> {
  try {
    const result = await (context.db as nano.DocumentScope<ChatSession>).view(
      'sessions',
      'by_created',
      {
        include_docs: true,
        descending: true,
      },
    );
    return result.rows.filter((row) => row.doc).map((row) => row.doc as ChatSession);
  } catch (error: unknown) {
    if (isNotFoundError(error)) {
      // Design doc not set up yet, fall back to all_docs
      const result = await context.db.list({ include_docs: true });
      return result.rows
        .filter((row) => row.doc && !row.id.startsWith('_design/'))
        .filter((row) => 'version' in (row.doc as object))
        .map((row) => row.doc as ChatSession)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    throw error;
  }
}

/** Update a session */
async function updateSession(
  context: ChatDatabaseContext,
  sessionId: string,
  updates: UpdateChatSessionRequest,
): Promise<ChatSession> {
  const existing = await context.db.get(sessionId);
  if (!('version' in existing) || existing.version !== 'alpha1') {
    throw new Error(`Session not found: ${sessionId}`);
  }

  const now = new Date().toISOString();
  const session = existing as ChatSession;

  const updated: ChatSession = {
    ...session,
    ...updates,
    stats: updates.stats ? { ...session.stats, ...updates.stats } : session.stats,
    updatedAt: now,
  };

  const result = await context.db.insert(updated as ChatSession | ChatMessageDoc);
  return { ...updated, _rev: result.rev };
}

/** Delete a session and all its entries */
async function deleteSession(context: ChatDatabaseContext, sessionId: string): Promise<void> {
  // Delete all entries for this session first
  const entries = await getEntries(context, sessionId);
  for (const entry of entries) {
    const entryDocId = `entry_${sessionId}_${entry.id}`;
    try {
      const doc = await context.db.get(entryDocId);
      await context.db.destroy(entryDocId, doc._rev!);
    } catch (error: unknown) {
      if (!isNotFoundError(error)) {
        throw error;
      }
    }
  }

  // Delete the session itself
  const session = await context.db.get(sessionId);
  await context.db.destroy(sessionId, session._rev!);
}

/** Append an entry to a session */
async function appendEntry(
  context: ChatDatabaseContext,
  sessionId: string,
  entry: Omit<SessionEntry, 'id' | 'timestamp'>,
): Promise<string> {
  const entryId = generateEntryId();
  const timestamp = new Date().toISOString();

  const fullEntry: SessionEntry = {
    ...entry,
    id: entryId,
    timestamp,
  } as SessionEntry;

  const doc: ChatMessageDoc = {
    _id: `entry_${sessionId}_${entryId}`,
    sessionId,
    entry: fullEntry,
  };

  await context.db.insert(doc as ChatSession | ChatMessageDoc);

  // Update session stats if it's a message entry
  if (entry.type === 'message') {
    await updateSessionStatsForMessage(context, sessionId, fullEntry);
  }

  return entryId;
}

/** Update session stats when a message is added */
async function updateSessionStatsForMessage(
  context: ChatDatabaseContext,
  sessionId: string,
  entry: SessionEntry,
): Promise<void> {
  if (entry.type !== 'message') return;

  const delta = calculateMessageStatsDelta(entry as SessionMessageEntry);

  try {
    const session = await getSession(context, sessionId);
    if (session) {
      await updateSession(context, sessionId, {
        stats: applyStatsDelta(session.stats, delta),
      });
    }
  } catch {
    // Stats update failed, not critical
  }
}

/** Get all entries for a session */
async function getEntries(
  context: ChatDatabaseContext,
  sessionId: string,
): Promise<SessionEntry[]> {
  try {
    const result = await (context.db as nano.DocumentScope<ChatMessageDoc>).view(
      'entries',
      'by_session',
      {
        startkey: [sessionId, ''],
        endkey: [sessionId, '\ufff0'],
        include_docs: true,
      },
    );
    return result.rows.filter((row) => row.doc).map((row) => (row.doc as ChatMessageDoc).entry);
  } catch (error: unknown) {
    if (isNotFoundError(error)) {
      // Fall back to all_docs with prefix filter
      const result = await context.db.list({
        include_docs: true,
        startkey: `entry_${sessionId}_`,
        endkey: `entry_${sessionId}_\ufff0`,
      });
      return result.rows
        .filter((row) => row.doc && 'entry' in (row.doc as object))
        .map((row) => (row.doc as ChatMessageDoc).entry);
    }
    throw error;
  }
}

/** Get entries from a specific point (for branch queries) */
async function getBranch(
  context: ChatDatabaseContext,
  sessionId: string,
  fromEntryId?: string,
): Promise<SessionEntry[]> {
  const allEntries = await getEntries(context, sessionId);

  if (!fromEntryId) {
    return allEntries;
  }

  // Build path from the specified entry to root
  const entriesById = new Map(allEntries.map((e) => [e.id, e]));
  const branch: SessionEntry[] = [];
  let currentId: string | null = fromEntryId;

  while (currentId) {
    const entry = entriesById.get(currentId);
    if (!entry) break;
    branch.unshift(entry);
    currentId = 'parentId' in entry ? entry.parentId : null;
  }

  return branch;
}
