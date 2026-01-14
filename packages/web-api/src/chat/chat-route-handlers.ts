/**
 * Route handlers for chat API endpoints.
 */

import type { Context } from 'hono';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';

import type { RpcEvent } from '../docker';
import { logger, withSpan } from '../utils/logger';
import type { ChatService } from './chat-service';

/** Create session request schema */
export const createSessionSchema = z.object({
  name: z.string().optional(),
  repository: z
    .object({
      slug: z.string(),
      gitUrl: z.string().url(),
      defaultBranch: z.string().default('main'),
      ref: z.string().optional(),
    })
    .optional(),
});

/** Prompt request schema */
export const promptSchema = z.object({
  message: z.string().min(1),
});

/** Get username from JWT payload */
export function getUsername(c: Context): string | null {
  return c.get('jwtPayload')?.username ?? null;
}

/** Handle list sessions */
export async function handleListSessions(c: Context, chatService: ChatService) {
  return withSpan('chat_list_sessions', {}, async (span) => {
    const username = getUsername(c);
    if (!username) return c.json({ error: 'Authentication required' }, 401);

    span.setAttribute('user.name', username);

    try {
      const sessions = await chatService.listSessions(username);
      return c.json({ sessions });
    } catch (error) {
      logger.error({ error }, 'Failed to list sessions');
      return c.json({ error: 'Failed to list sessions' }, 500);
    }
  });
}

/** Handle create session */
export async function handleCreateSession(c: Context, chatService: ChatService) {
  return withSpan('chat_create_session', {}, async (span) => {
    const username = getUsername(c);
    if (!username) return c.json({ error: 'Authentication required' }, 401);

    span.setAttribute('user.name', username);

    try {
      const body = await c.req.json();
      const parsed = createSessionSchema.parse(body);

      const session = await chatService.createSession(username, {
        name: parsed.name,
        repository: parsed.repository,
      });
      span.setAttribute('session.id', session._id);

      return c.json({ session }, 201);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json({ error: 'Invalid request', details: error.errors }, 400);
      }
      logger.error({ error }, 'Failed to create session');
      return c.json({ error: 'Failed to create session' }, 500);
    }
  });
}

/** Handle get session */
export async function handleGetSession(c: Context, chatService: ChatService) {
  return withSpan('chat_get_session', {}, async (span) => {
    const username = getUsername(c);
    if (!username) return c.json({ error: 'Authentication required' }, 401);

    const sessionId = c.req.param('id');
    span.setAttribute('user.name', username);
    span.setAttribute('session.id', sessionId);

    try {
      const session = await chatService.getSession(username, sessionId);
      if (!session) return c.json({ error: 'Session not found' }, 404);

      const entries = await chatService.getSessionEntries(username, sessionId);
      return c.json({ session, entries });
    } catch (error) {
      logger.error({ error, sessionId }, 'Failed to get session');
      return c.json({ error: 'Failed to get session' }, 500);
    }
  });
}

/** Handle delete session */
export async function handleDeleteSession(c: Context, chatService: ChatService) {
  return withSpan('chat_delete_session', {}, async (span) => {
    const username = getUsername(c);
    if (!username) return c.json({ error: 'Authentication required' }, 401);

    const sessionId = c.req.param('id');
    span.setAttribute('user.name', username);
    span.setAttribute('session.id', sessionId);

    try {
      const result = await chatService.deleteSession(username, sessionId);
      if (!result.success) return c.json({ error: result.error }, 400);
      return c.json({ success: true });
    } catch (error) {
      logger.error({ error, sessionId }, 'Failed to delete session');
      return c.json({ error: 'Failed to delete session' }, 500);
    }
  });
}

/** Handle session lifecycle (start/stop/abort) */
export async function handleSessionLifecycle(
  c: Context,
  chatService: ChatService,
  action: 'start' | 'stop' | 'abort',
) {
  const spanName = `chat_${action}_session`;
  return withSpan(spanName, {}, async (span) => {
    const username = getUsername(c);
    if (!username) return c.json({ error: 'Authentication required' }, 401);

    const sessionId = c.req.param('id');
    span.setAttribute('user.name', username);
    span.setAttribute('session.id', sessionId);

    try {
      let result: { success: boolean; error?: string };
      switch (action) {
        case 'start':
          result = await chatService.startSession(username, sessionId);
          break;
        case 'stop':
          result = await chatService.stopSession(username, sessionId);
          break;
        case 'abort':
          result = await chatService.abortSession(username, sessionId);
          break;
      }
      if (!result.success) {
        logger.warn({ sessionId, action, error: result.error }, `Session ${action} failed`);
        return c.json({ error: result.error }, 400);
      }
      return c.json({ success: true });
    } catch (error) {
      logger.error({ error, sessionId }, `Failed to ${action} session`);
      return c.json({ error: `Failed to ${action} session` }, 500);
    }
  });
}

/** Handle prompt with SSE streaming */
export async function handlePrompt(c: Context, chatService: ChatService) {
  const username = getUsername(c);
  if (!username) return c.json({ error: 'Authentication required' }, 401);

  const sessionId = c.req.param('id');

  let body: { message: string };
  try {
    body = promptSchema.parse(await c.req.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid request', details: error.errors }, 400);
    }
    return c.json({ error: 'Invalid request body' }, 400);
  }

  return streamSSE(c, async (stream) => {
    const containerManager = chatService.getContainerManager();

    // Stream all events to client, persist on message_end
    const unsubscribe = containerManager.onRpcEvent(sessionId, (event: RpcEvent) => {
      stream.writeSSE({ data: JSON.stringify(event), event: event.type });

      // Persist each message as it completes
      if (event.type === 'message_end') {
        persistMessageEnd(chatService, username, sessionId, event);
      }

      // Log agent_end for debugging
      if (event.type === 'agent_end') {
        const agentEndEvent = event as { messages?: unknown[] };
        logger.info({ messageCount: agentEndEvent.messages?.length ?? 0 }, 'agent_end received');
      }
    });

    try {
      const result = await chatService.sendPrompt(username, sessionId, body.message);
      if (!result.success) {
        await stream.writeSSE({ data: JSON.stringify({ error: result.error }), event: 'error' });
        return;
      }

      // Wait for completion
      await waitForAgentEnd(containerManager, sessionId);
    } finally {
      unsubscribe();
    }
  });
}

/** Wait for agent_end event */
async function waitForAgentEnd(
  containerManager: ReturnType<ChatService['getContainerManager']>,
  sessionId: string,
): Promise<void> {
  return new Promise((resolve) => {
    const checkEnd = (event: RpcEvent) => {
      if (event.type === 'agent_end') resolve();
    };
    containerManager.onRpcEvent(sessionId, checkEnd);
    setTimeout(() => resolve(), 5 * 60 * 1000); // 5 minute timeout
  });
}

/** Message from pi-coding-agent */
interface AgentMessage {
  role: 'user' | 'assistant';
  content: unknown[];
  timestamp?: number;
  [key: string]: unknown;
}

/** Persist a message from message_end event */
function persistMessageEnd(
  chatService: ChatService,
  username: string,
  sessionId: string,
  event: RpcEvent,
): void {
  const messageEvent = event as { message?: AgentMessage };
  if (!messageEvent.message) {
    logger.warn({ event }, 'message_end has no message');
    return;
  }

  const message = messageEvent.message;
  const entry = {
    type: 'message' as const,
    parentId: null,
    message,
  };

  // Use original timestamp if available
  const timestamp = message.timestamp ? new Date(message.timestamp).toISOString() : undefined;

  chatService
    .appendEntryWithTimestamp(username, sessionId, entry, timestamp)
    .catch((err) => logger.error({ err, sessionId }, 'Failed to persist message'));
}
