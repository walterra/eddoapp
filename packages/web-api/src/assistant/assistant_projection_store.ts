import { getChatDatabaseName, type Env } from '@eddo/core-server';
import type {
  AssistantConversation,
  AssistantConversationMessageDoc,
  AssistantHistoryPage,
} from '@eddo/core-shared';
import nano from 'nano';
import { changeCursor, historyCursor, readHistoryCursor } from './assistant_cursors';
import { AssistantApiError } from './assistant_errors';
import {
  AssistantCursorExpiredError,
  type AssistantChangesBatch,
  type AssistantHistoryQuery,
  type AssistantProjectionStore,
} from './assistant_types';
import { boundedJson } from './bounded_json';
import {
  changesSchema,
  conversationSchema,
  messageSchema,
  sequenceSchema,
} from './projection_schemas';

interface HistoryPageOptions {
  username: string;
  conversation: AssistantConversation;
  limit: number;
  checkpoint: string;
}

interface ConversationState {
  _id: string;
  activeConversationId?: string;
}
export interface ProjectionStoreOptions {
  env: Env;
  fetch?: typeof fetch;
}
const versions = [
  'assistant_conversation_alpha1',
  'assistant_conversation_state_alpha1',
  'assistant_conversation_message_alpha1',
];

function missing(error: unknown): boolean {
  return Boolean(
    error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 404,
  );
}

/** Reads only the authenticated account's existing projection; never initializes conversation state. */
async function active(
  database: nano.DocumentScope<ConversationState>,
  username: string,
): Promise<AssistantConversation | null> {
  let conversationId = 'assistant_conversation_default';
  try {
    conversationId =
      (await database.get('assistant_conversation_state')).activeConversationId ?? conversationId;
  } catch (error) {
    if (!missing(error)) throw error;
  }
  try {
    const result = conversationSchema.parse(await database.get(conversationId));
    if (result.username !== username) throw new AssistantApiError(503, 'unavailable');
    return result;
  } catch (error) {
    if (missing(error)) return null;
    throw error;
  }
}

async function history(
  options: ProjectionStoreOptions,
  username: string,
  query: AssistantHistoryQuery,
): Promise<AssistantHistoryPage> {
  const database = nano(options.env.COUCHDB_URL).db.use<ConversationState>(
    getChatDatabaseName(options.env, username),
  );
  const sequence = await watermark(options.env, username);
  const conversation = await active(database, username);
  const checkpoint = changeCursor(username, sequence);
  if (!conversation) {
    if (query.cursor) throw new AssistantApiError(400, 'invalid_request');
    return { conversation: null, messages: [], nextCursor: null, changeCursor: checkpoint };
  }
  const key = query.cursor ? readHistoryCursor(username, conversation._id, query.cursor) : null;
  const result = await database.view('assistant_conversations', 'messages_by_conversation', {
    descending: true,
    include_docs: true,
    limit: query.limit + 2,
    startkey: key ? [conversation._id, ...key] : [conversation._id, {}, '\ufff0', '\ufff0'],
    endkey: [conversation._id, 0, '', ''],
  });
  const available = result.rows
    .map((row) => messageSchema.parse(row.doc))
    .filter((message) => message.conversationId === conversation._id && message._id !== key?.[2]);
  return page({ username, conversation, limit: query.limit, checkpoint }, available);
}

function page(
  options: HistoryPageOptions,
  available: AssistantConversationMessageDoc[],
): AssistantHistoryPage {
  const { username, conversation, limit, checkpoint } = options;
  const selected = available.slice(0, limit);
  const oldest = selected.at(-1);
  const nextCursor =
    available.length > limit && oldest
      ? historyCursor(username, conversation._id, [oldest.sequence, oldest.createdAt, oldest._id])
      : null;
  return { conversation, messages: selected.reverse(), nextCursor, changeCursor: checkpoint };
}

async function watermark(env: Env, username: string): Promise<string> {
  try {
    const info = await nano(env.COUCHDB_URL).db.get(getChatDatabaseName(env, username));
    return sequenceSchema.parse(info.update_seq);
  } catch (error) {
    if (missing(error)) return '0';
    throw error;
  }
}

interface ChangeEndpoint {
  url: URL;
  authorization: string;
}

/** Resolves backend credentials separately from account-scoped client cursors. */
function changeEndpoint(env: Env, username: string, since: string): ChangeEndpoint {
  const url = new URL(env.COUCHDB_URL);
  const authorization = `Basic ${Buffer.from(`${decodeURIComponent(url.username)}:${decodeURIComponent(url.password)}`).toString('base64')}`;
  url.username = '';
  url.password = '';
  url.pathname = `${url.pathname.replace(/\/$/, '')}/${encodeURIComponent(getChatDatabaseName(env, username))}/_changes`;
  url.search = new URLSearchParams({
    feed: 'longpoll',
    since,
    timeout: '5000',
    limit: '100',
    filter: '_selector',
  }).toString();
  return { url, authorization };
}

/** Filters changes in CouchDB so sandbox entries and message bodies never enter the SSE transport. */
async function changes(
  options: ProjectionStoreOptions,
  username: string,
  since: string,
  signal: AbortSignal,
): Promise<AssistantChangesBatch> {
  const { url, authorization } = changeEndpoint(options.env, username, since);
  const response = await (options.fetch ?? fetch)(url, {
    method: 'POST',
    signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
    redirect: 'error',
    headers: { Authorization: authorization, 'Content-Type': 'application/json' },
    body: JSON.stringify({ selector: { version: { $in: versions } } }),
  });
  if (response.status === 404) {
    void response.body?.cancel();
    return { changes: [], lastSequence: since };
  }
  if (response.status === 400) {
    void response.body?.cancel();
    throw new AssistantCursorExpiredError();
  }
  if (!response.ok) {
    void response.body?.cancel();
    throw new AssistantApiError(503, 'unavailable');
  }
  const batch = changesSchema.parse(await boundedJson(response, 262_144));
  return {
    lastSequence: batch.last_seq,
    changes: batch.results
      .filter(
        (change) =>
          change.id.startsWith('assistant_message_') ||
          change.id.startsWith('assistant_conversation_'),
      )
      .map((change) => ({
        sequence: change.seq,
        change: {
          kind: change.id.startsWith('assistant_message_') ? 'message' : 'conversation',
          documentId: change.id,
        },
      })),
  };
}

/** Creates account-scoped projection reads without depending on the execution runtime package. */
export function createAssistantProjectionStore(
  options: ProjectionStoreOptions,
): AssistantProjectionStore {
  return {
    history: (username, query) => history(options, username, query),
    watermark: (username) => watermark(options.env, username),
    changes: (username, since, signal) => changes(options, username, since, signal),
  };
}
