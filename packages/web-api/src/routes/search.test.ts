import { describe, expect, it } from 'vitest';
import { z } from 'zod';

/** Schema for searchTodos validation. */
const searchTodosSchema = z.object({
  query: z.string().min(1).max(500),
  limit: z.number().int().min(1).max(100).default(20),
  includeCompleted: z.boolean().default(true),
  context: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

/** Schema for audit search validation. */
const searchAuditSchema = z.object({
  query: z.string().optional(),
  action: z
    .enum([
      'create',
      'update',
      'delete',
      'complete',
      'uncomplete',
      'time_tracking_start',
      'time_tracking_stop',
    ])
    .optional(),
  source: z.enum(['web', 'mcp', 'telegram', 'github-sync', 'rss-sync', 'email-sync']).optional(),
  entityId: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(50),
});

/** Schema for suggest endpoint validation. */
const suggestSchema = z.object({
  prefix: z.string().min(1).max(100),
  field: z.enum(['title', 'context', 'tags']).default('title'),
  limit: z.number().int().min(1).max(20).default(10),
});

/** Escapes special characters in ES|QL string literals. */
const escapeEsqlString = (str: string): string => {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
};

describe('search routes', () => {
  describe('escapeEsqlString', () => {
    it('should escape backslashes', () => {
      expect(escapeEsqlString('path\\to\\file')).toBe('path\\\\to\\\\file');
    });

    it('should escape double quotes', () => {
      expect(escapeEsqlString('say "hello"')).toBe('say \\"hello\\"');
    });

    it('should handle mixed escapes', () => {
      expect(escapeEsqlString('path\\to\\"file"')).toBe('path\\\\to\\\\\\"file\\"');
    });

    it('should leave normal strings unchanged', () => {
      expect(escapeEsqlString('normal search query')).toBe('normal search query');
    });
  });

  describe('searchTodosSchema validation', () => {
    it('should accept valid search params', () => {
      const result = searchTodosSchema.parse({
        query: 'test search',
        limit: 10,
      });
      expect(result.query).toBe('test search');
      expect(result.limit).toBe(10);
      expect(result.includeCompleted).toBe(true);
    });

    it('should apply defaults', () => {
      const result = searchTodosSchema.parse({
        query: 'test',
      });
      expect(result.limit).toBe(20);
      expect(result.includeCompleted).toBe(true);
    });

    it('should reject empty query', () => {
      expect(() => searchTodosSchema.parse({ query: '' })).toThrow();
    });

    it('should reject query over 500 chars', () => {
      expect(() => searchTodosSchema.parse({ query: 'a'.repeat(501) })).toThrow();
    });

    it('should accept tags array', () => {
      const result = searchTodosSchema.parse({
        query: 'test',
        tags: ['gtd:next', 'urgent'],
      });
      expect(result.tags).toEqual(['gtd:next', 'urgent']);
    });
  });

  describe('searchAuditSchema validation', () => {
    it('should accept valid audit search params', () => {
      const result = searchAuditSchema.parse({
        action: 'create',
        source: 'web',
        limit: 25,
      });
      expect(result.action).toBe('create');
      expect(result.source).toBe('web');
      expect(result.limit).toBe(25);
    });

    it('should apply default limit', () => {
      const result = searchAuditSchema.parse({});
      expect(result.limit).toBe(50);
    });

    it('should accept date range', () => {
      const result = searchAuditSchema.parse({
        fromDate: '2026-01-01T00:00:00Z',
        toDate: '2026-01-31T23:59:59Z',
      });
      expect(result.fromDate).toBe('2026-01-01T00:00:00Z');
      expect(result.toDate).toBe('2026-01-31T23:59:59Z');
    });

    it('should reject invalid action', () => {
      expect(() => searchAuditSchema.parse({ action: 'invalid' })).toThrow();
    });

    it('should reject invalid source', () => {
      expect(() => searchAuditSchema.parse({ source: 'unknown' })).toThrow();
    });
  });

  describe('suggestSchema validation', () => {
    it('should accept valid suggest params', () => {
      const result = suggestSchema.parse({
        prefix: 'ela',
        field: 'context',
      });
      expect(result.prefix).toBe('ela');
      expect(result.field).toBe('context');
      expect(result.limit).toBe(10);
    });

    it('should apply defaults', () => {
      const result = suggestSchema.parse({
        prefix: 'test',
      });
      expect(result.field).toBe('title');
      expect(result.limit).toBe(10);
    });

    it('should reject empty prefix', () => {
      expect(() => suggestSchema.parse({ prefix: '' })).toThrow();
    });
  });
});
