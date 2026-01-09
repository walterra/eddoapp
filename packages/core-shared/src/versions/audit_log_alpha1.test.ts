import { describe, expect, it } from 'vitest';

import {
  type AuditLogAlpha1,
  createAuditLogEntry,
  isAuditLogAlpha1,
  type NewAuditLogEntry,
} from './audit_log_alpha1';

describe('audit_log_alpha1', () => {
  describe('isAuditLogAlpha1', () => {
    it('returns true for valid AuditLogAlpha1 entry', () => {
      const entry: AuditLogAlpha1 = {
        _id: '2026-01-07T12:00:00.000Z',
        version: 'audit_alpha1',
        action: 'create',
        entityType: 'todo',
        entityId: '2026-01-07T11:00:00.000Z',
        timestamp: '2026-01-07T12:00:00.000Z',
        source: 'web',
      };
      expect(isAuditLogAlpha1(entry)).toBe(true);
    });

    it('returns false for null', () => {
      expect(isAuditLogAlpha1(null)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isAuditLogAlpha1(undefined)).toBe(false);
    });

    it('returns false for wrong version', () => {
      expect(isAuditLogAlpha1({ version: 'alpha1' })).toBe(false);
    });

    it('returns false for missing version', () => {
      expect(isAuditLogAlpha1({ action: 'create' })).toBe(false);
    });

    it('returns false for non-object', () => {
      expect(isAuditLogAlpha1('string')).toBe(false);
      expect(isAuditLogAlpha1(123)).toBe(false);
    });
  });

  describe('createAuditLogEntry', () => {
    it('creates entry with auto-generated ID and timestamp', () => {
      const input: NewAuditLogEntry = {
        action: 'create',
        entityType: 'todo',
        entityId: '2026-01-07T11:00:00.000Z',
        source: 'web',
        after: { title: 'New todo' },
      };

      const entry = createAuditLogEntry(input);

      expect(entry.version).toBe('audit_alpha1');
      expect(entry._id).toBeDefined();
      expect(entry.timestamp).toBe(entry._id);
      expect(entry.action).toBe('create');
      expect(entry.entityType).toBe('todo');
      expect(entry.entityId).toBe('2026-01-07T11:00:00.000Z');
      expect(entry.source).toBe('web');
      expect(entry.after).toEqual({ title: 'New todo' });
    });

    it('creates entry with before state for update', () => {
      const input: NewAuditLogEntry = {
        action: 'update',
        entityType: 'todo',
        entityId: '2026-01-07T11:00:00.000Z',
        source: 'mcp',
        before: { title: 'Old title' },
        after: { title: 'New title' },
      };

      const entry = createAuditLogEntry(input);

      expect(entry.action).toBe('update');
      expect(entry.before).toEqual({ title: 'Old title' });
      expect(entry.after).toEqual({ title: 'New title' });
    });

    it('creates entry with metadata', () => {
      const input: NewAuditLogEntry = {
        action: 'delete',
        entityType: 'todo',
        entityId: '2026-01-07T11:00:00.000Z',
        source: 'telegram',
        before: { title: 'Deleted todo' },
        metadata: { userId: 'user123', reason: 'cleanup' },
      };

      const entry = createAuditLogEntry(input);

      expect(entry.metadata).toEqual({ userId: 'user123', reason: 'cleanup' });
    });

    it('creates entry with message', () => {
      const input: NewAuditLogEntry = {
        action: 'update',
        entityType: 'todo',
        entityId: '2026-01-07T11:00:00.000Z',
        source: 'mcp',
        before: { title: 'My todo' },
        after: { title: 'My todo', due: '2026-01-14' },
        message: 'Added due date for next week',
      };

      const entry = createAuditLogEntry(input);

      expect(entry.message).toBe('Added due date for next week');
    });

    it('creates entry without message (backward compatible)', () => {
      const input: NewAuditLogEntry = {
        action: 'create',
        entityType: 'todo',
        entityId: '2026-01-07T11:00:00.000Z',
        source: 'web',
      };

      const entry = createAuditLogEntry(input);

      expect(entry.message).toBeUndefined();
    });

    it('creates entry for time tracking actions', () => {
      const startInput: NewAuditLogEntry = {
        action: 'time_tracking_start',
        entityType: 'todo',
        entityId: '2026-01-07T11:00:00.000Z',
        source: 'web',
      };

      const stopInput: NewAuditLogEntry = {
        action: 'time_tracking_stop',
        entityType: 'todo',
        entityId: '2026-01-07T11:00:00.000Z',
        source: 'web',
      };

      expect(createAuditLogEntry(startInput).action).toBe('time_tracking_start');
      expect(createAuditLogEntry(stopInput).action).toBe('time_tracking_stop');
    });

    it('creates entry for all source types', () => {
      const sources = ['web', 'mcp', 'telegram', 'github-sync', 'rss-sync', 'email-sync'] as const;

      for (const source of sources) {
        const input: NewAuditLogEntry = {
          action: 'create',
          entityType: 'todo',
          entityId: '2026-01-07T11:00:00.000Z',
          source,
        };
        expect(createAuditLogEntry(input).source).toBe(source);
      }
    });
  });
});
