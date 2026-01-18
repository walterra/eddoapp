/**
 * Hook for interacting with the chat API.
 */

import type { ChatSession, CreateChatSessionRequest, SessionEntry } from '@eddo/core-shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';

const API_BASE = '/api/chat';

/** Get auth token from localStorage */
function getAuthToken(): string | null {
  return localStorage.getItem('token');
}

/** Fetch with auth header */
async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getAuthToken();
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

/** List sessions response */
interface ListSessionsResponse {
  sessions: ChatSession[];
}

/** Get session response */
interface GetSessionResponse {
  session: ChatSession;
  entries: SessionEntry[];
}

/** RPC event from SSE stream */
export interface RpcEvent {
  type: string;
  [key: string]: unknown;
}

/** Use chat sessions list */
export function useChatSessions() {
  return useQuery({
    queryKey: ['chat', 'sessions'],
    queryFn: async (): Promise<ChatSession[]> => {
      const response = await fetchWithAuth(`${API_BASE}/sessions`);
      if (!response.ok) throw new Error('Failed to fetch sessions');
      const data: ListSessionsResponse = await response.json();
      return data.sessions;
    },
  });
}

/** Use single chat session with entries */
export function useChatSession(sessionId: string | null) {
  return useQuery({
    queryKey: ['chat', 'session', sessionId],
    queryFn: async (): Promise<GetSessionResponse | null> => {
      if (!sessionId) return null;
      const response = await fetchWithAuth(`${API_BASE}/sessions/${sessionId}`);
      if (!response.ok) throw new Error('Failed to fetch session');
      return response.json();
    },
    enabled: !!sessionId,
  });
}

/** Create session mutation */
export function useCreateSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: CreateChatSessionRequest): Promise<ChatSession> => {
      const response = await fetchWithAuth(`${API_BASE}/sessions`, {
        method: 'POST',
        body: JSON.stringify(request),
      });
      if (!response.ok) throw new Error('Failed to create session');
      const data = await response.json();
      return data.session;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'sessions'] });
    },
  });
}

/** Delete session mutation */
export function useDeleteSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessionId: string): Promise<void> => {
      const response = await fetchWithAuth(`${API_BASE}/sessions/${sessionId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete session');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'sessions'] });
    },
  });
}

/** Start session mutation */
export function useStartSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessionId: string): Promise<void> => {
      const response = await fetchWithAuth(`${API_BASE}/sessions/${sessionId}/start`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to start session');
    },
    onSuccess: (_, sessionId) => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'session', sessionId] });
    },
  });
}

/** Stop session mutation */
export function useStopSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessionId: string): Promise<void> => {
      const response = await fetchWithAuth(`${API_BASE}/sessions/${sessionId}/stop`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to stop session');
    },
    onSuccess: (_, sessionId) => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'session', sessionId] });
    },
  });
}

/** Parse SSE lines from buffer */
function parseSSELines(buffer: string, onEvent: (event: RpcEvent) => void): string {
  const lines = buffer.split('\n');
  const remaining = lines.pop() ?? '';

  for (const line of lines) {
    if (!line.startsWith('data: ')) continue;
    try {
      const event: RpcEvent = JSON.parse(line.slice(6));
      onEvent(event);
    } catch {
      // Invalid JSON, skip
    }
  }

  return remaining;
}

/** Stream prompt response */
async function streamPrompt(
  sessionId: string,
  message: string,
  signal: AbortSignal,
  onEvent: (event: RpcEvent) => void,
): Promise<void> {
  const token = getAuthToken();
  const response = await fetch(`${API_BASE}/sessions/${sessionId}/prompt`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ message }),
    signal,
  });

  if (!response.ok) throw new Error('Failed to send prompt');
  if (!response.body) throw new Error('No response body');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    buffer = parseSSELines(buffer, onEvent);
  }
}

/** Hook for sending prompts with SSE streaming */
export function useSendPrompt(sessionId: string | null) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [events, setEvents] = useState<RpcEvent[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const queryClient = useQueryClient();

  const sendPrompt = useCallback(
    async (message: string, onEvent?: (event: RpcEvent) => void) => {
      if (!sessionId) return;

      setIsStreaming(true);
      setEvents([]);
      abortControllerRef.current = new AbortController();

      try {
        await streamPrompt(sessionId, message, abortControllerRef.current.signal, (event) => {
          setEvents((prev) => [...prev, event]);
          onEvent?.(event);
        });
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
        queryClient.invalidateQueries({ queryKey: ['chat', 'session', sessionId] });
      }
    },
    [sessionId, queryClient],
  );

  const abort = useCallback(async () => {
    abortControllerRef.current?.abort();
    if (sessionId) {
      await fetchWithAuth(`${API_BASE}/sessions/${sessionId}/abort`, { method: 'POST' });
    }
  }, [sessionId]);

  return { sendPrompt, abort, isStreaming, events };
}
