import type { AISession } from '../types/ai-types.js';

const SESSION_TIMEOUT = 60 * 60 * 1000; // 1 hour

export class SessionManager {
  private sessions = new Map<string, AISession>();

  getOrCreateSession(userId: string): AISession {
    const existingSession = Array.from(this.sessions.values()).find(
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

    this.sessions.set(newSession.id, newSession);
    return newSession;
  }

  cleanupOldSessions(): void {
    const oneHourAgo = new Date(Date.now() - SESSION_TIMEOUT);

    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.lastActivity < oneHourAgo) {
        this.sessions.delete(sessionId);
      }
    }
  }

  getSessionStats(): { totalSessions: number; activeSessions: number } {
    const now = new Date();
    const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);

    const activeSessions = Array.from(this.sessions.values()).filter(
      (session) => session.lastActivity > fifteenMinutesAgo,
    ).length;

    return {
      totalSessions: this.sessions.size,
      activeSessions,
    };
  }

  clearSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  clearAllSessions(): void {
    this.sessions.clear();
  }
}