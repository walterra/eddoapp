/**
 * Chat API routes for managing AI chat sessions.
 */

import { Hono } from 'hono';

import {
  handleCreateSession,
  handleDeleteSession,
  handleGetSession,
  handleListSessions,
  handlePrompt,
  handleSessionLifecycle,
} from './chat-route-handlers';
import type { ChatService } from './chat-service';

/** Create chat routes with injected service */
export function createChatRoutes(chatService: ChatService) {
  const app = new Hono();

  // List all sessions
  app.get('/sessions', (c) => handleListSessions(c, chatService));

  // Create new session
  app.post('/sessions', (c) => handleCreateSession(c, chatService));

  // Get session by ID
  app.get('/sessions/:id', (c) => handleGetSession(c, chatService));

  // Delete session
  app.delete('/sessions/:id', (c) => handleDeleteSession(c, chatService));

  // Start/resume session (spawn container)
  app.post('/sessions/:id/start', (c) => handleSessionLifecycle(c, chatService, 'start'));

  // Stop session (stop container)
  app.post('/sessions/:id/stop', (c) => handleSessionLifecycle(c, chatService, 'stop'));

  // Abort current operation
  app.post('/sessions/:id/abort', (c) => handleSessionLifecycle(c, chatService, 'abort'));

  // Send prompt with SSE streaming response
  app.post('/sessions/:id/prompt', (c) => handlePrompt(c, chatService));

  return app;
}
