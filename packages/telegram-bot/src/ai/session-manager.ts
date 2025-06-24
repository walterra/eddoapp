import type { AISession } from '../types/ai-types.js';

const SESSION_TIMEOUT = 60 * 60 * 1000; // 1 hour

export interface SessionManager {
  getOrCreateSession: (userId: string) => AISession;
  cleanupOldSessions: () => void;
  getSessionStats: () => { totalSessions: number; activeSessions: number };
  clearSession: (sessionId: string) => void;
  clearAllSessions: () => void;
}

/**
 * Creates a session manager instance for managing AI chat sessions
 */
export function createSessionManager(): SessionManager {
  const sessions = new Map<string, AISession>();

  const getOrCreateSession = (userId: string): AISession => {
    const existingSession = Array.from(sessions.values()).find(
      (session) => session.userId === userId,
    );

    if (existingSession) {
      existingSession.lastActivity = new Date();
      return existingSession;
    }

    const newSession: AISession = {
      id: `session_${userId}_${Date.now()}`,
      userId,
      context: [],
      createdAt: new Date(),
      lastActivity: new Date(),
    };

    sessions.set(newSession.id, newSession);
    return newSession;
  };

  const cleanupOldSessions = (): void => {
    const oneHourAgo = new Date(Date.now() - SESSION_TIMEOUT);

    for (const [sessionId, session] of sessions.entries()) {
      if (session.lastActivity < oneHourAgo) {
        sessions.delete(sessionId);
      }
    }
  };

  const getSessionStats = (): { totalSessions: number; activeSessions: number } => {
    const now = new Date();
    const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);

    const activeSessions = Array.from(sessions.values()).filter(
      (session) => session.lastActivity > fifteenMinutesAgo,
    ).length;

    return {
      totalSessions: sessions.size,
      activeSessions,
    };
  };

  const clearSession = (sessionId: string): void => {
    sessions.delete(sessionId);
  };

  const clearAllSessions = (): void => {
    sessions.clear();
  };

  return {
    getOrCreateSession,
    cleanupOldSessions,
    getSessionStats,
    clearSession,
    clearAllSessions,
  };
}
