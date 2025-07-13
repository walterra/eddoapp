/**
 * MCP User Context Management
 * Implements per-user database pattern for complete data isolation
 */
import type { TodoAlpha3 } from '@eddo/core';
import nano from 'nano';

export class UserContextManager {
  private currentUserId: string | null = null;
  private readonly baseDbName: string;
  private readonly couchConnection: nano.ServerScope;

  constructor(couchUrl: string, baseDbName: string) {
    this.couchConnection = nano(couchUrl);
    this.baseDbName = baseDbName;
  }

  /**
   * Set the current user context for database operations
   */
  setUserContext(userId: string | null): void {
    this.currentUserId = userId;
  }

  /**
   * Get the current user context
   */
  getUserContext(): string | null {
    return this.currentUserId;
  }

  /**
   * Get database name for current user context
   */
  getDatabaseName(): string {
    return this.currentUserId
      ? `${this.baseDbName}_user_${this.currentUserId}`
      : this.baseDbName;
  }

  /**
   * Get database instance for current user context
   */
  getUserDatabase(): nano.DocumentScope<TodoAlpha3> {
    const dbName = this.getDatabaseName();
    return this.couchConnection.db.use<TodoAlpha3>(dbName);
  }

  /**
   * Ensure database exists for current user
   */
  async ensureUserDatabase(): Promise<void> {
    const dbName = this.getDatabaseName();
    try {
      await this.couchConnection.db.get(dbName);
    } catch (error: unknown) {
      if (
        error &&
        typeof error === 'object' &&
        'statusCode' in error &&
        error.statusCode === 404
      ) {
        // Database doesn't exist, create it
        await this.couchConnection.db.create(dbName);
        console.log(`Created user database: ${dbName}`);
      } else {
        throw error;
      }
    }
  }
}
