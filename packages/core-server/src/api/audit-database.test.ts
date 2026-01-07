import { createAuditLogEntry } from '@eddo/core-shared';
import { describe, expect, it } from 'vitest';

import { type Env } from '../config/env';
import { getAuditDatabaseName, isAuditDatabase } from '../utils/database-names';

// Mock environment for testing (minimal required fields)
const mockEnv = {
  NODE_ENV: 'test',
  LOG_LEVEL: 'info',
  DATABASE_PREFIX: 'eddo',
  DATABASE_TEST_PREFIX: 'eddo_test',
  COUCHDB_URL: 'http://localhost:5984',
  COUCHDB_DB_NAME: 'todos-dev',
  MCP_SERVER_URL: 'http://localhost:3001/mcp',
  MCP_SERVER_PORT: 3001,
  BOT_PERSONA_ID: 'butler',
  LLM_MODEL: 'claude-sonnet-4-20250514',
  CLAUDE_CODE_WORKING_DIR: './bot_workspace',
  CLAUDE_CODE_SESSION_TIMEOUT: 3600,
  PORT: 3000,
  CORS_ORIGIN: 'http://localhost:5173',
  GOOGLE_REDIRECT_URI: 'http://localhost:3000/api/email/oauth/callback',
} as Env;

describe('audit-database', () => {
  describe('getAuditDatabaseName', () => {
    it('returns correct database name for test environment', () => {
      const dbName = getAuditDatabaseName(mockEnv, 'testuser');
      expect(dbName).toBe('eddo_test_audit_testuser');
    });

    it('returns correct database name for production environment', () => {
      const prodEnv = { ...mockEnv, NODE_ENV: 'production' as const };
      const dbName = getAuditDatabaseName(prodEnv, 'testuser');
      expect(dbName).toBe('eddo_audit_testuser');
    });

    it('sanitizes username in database name', () => {
      const dbName = getAuditDatabaseName(mockEnv, 'Test.User@Email');
      expect(dbName).toBe('eddo_test_audit_test_user_email');
    });
  });

  describe('isAuditDatabase', () => {
    it('returns true for valid audit database names', () => {
      expect(isAuditDatabase('eddo_audit_testuser', mockEnv)).toBe(true);
      expect(isAuditDatabase('eddo_test_audit_testuser', mockEnv)).toBe(true);
    });

    it('returns false for non-audit database names', () => {
      expect(isAuditDatabase('eddo_user_testuser', mockEnv)).toBe(false);
      expect(isAuditDatabase('eddo_user_registry', mockEnv)).toBe(false);
      expect(isAuditDatabase('other_database', mockEnv)).toBe(false);
    });
  });

  describe('createAuditLogEntry integration', () => {
    it('creates valid audit entry for insert operation', () => {
      const entry = createAuditLogEntry({
        action: 'create',
        entityType: 'todo',
        entityId: '2026-01-07T10:00:00.000Z',
        source: 'web',
        after: { title: 'New todo', context: 'work' },
      });

      expect(entry.version).toBe('audit_alpha1');
      expect(entry.action).toBe('create');
      expect(entry.entityType).toBe('todo');
      expect(entry.source).toBe('web');
      expect(entry._id).toBeDefined();
      expect(entry.timestamp).toBe(entry._id);
    });
  });
});
