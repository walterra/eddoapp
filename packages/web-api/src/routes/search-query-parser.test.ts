import { describe, expect, it } from 'vitest';

import { generateWhereConditions, parseSearchQuery } from './search-query-parser';

describe('search-query-parser', () => {
  describe('parseSearchQuery', () => {
    it('should parse plain text query', () => {
      const result = parseSearchQuery('meeting notes');

      expect(result.searchText).toBe('meeting notes');
      expect(result.tags).toEqual([]);
      expect(result.context).toBeNull();
      expect(result.completed).toBeNull();
      expect(result.dueFilter).toBeNull();
    });

    it('should parse single tag filter', () => {
      const result = parseSearchQuery('tag:gtd:next meeting');

      expect(result.searchText).toBe('meeting');
      expect(result.tags).toEqual(['gtd:next']);
    });

    it('should parse multiple tag filters', () => {
      const result = parseSearchQuery('tag:github tag:review PR fix');

      expect(result.searchText).toBe('PR fix');
      expect(result.tags).toEqual(['github', 'review']);
    });

    it('should parse tags: alias', () => {
      const result = parseSearchQuery('tags:urgent task');

      expect(result.searchText).toBe('task');
      expect(result.tags).toEqual(['urgent']);
    });

    it('should parse context filter', () => {
      const result = parseSearchQuery('context:elastic bug fix');

      expect(result.searchText).toBe('bug fix');
      expect(result.context).toBe('elastic');
    });

    it('should parse completed:true', () => {
      const result = parseSearchQuery('completed:true old tasks');

      expect(result.searchText).toBe('old tasks');
      expect(result.completed).toBe(true);
    });

    it('should parse completed:false', () => {
      const result = parseSearchQuery('completed:false urgent');

      expect(result.searchText).toBe('urgent');
      expect(result.completed).toBe(false);
    });

    it('should parse done: alias', () => {
      const result = parseSearchQuery('done:yes finished');

      expect(result.searchText).toBe('finished');
      expect(result.completed).toBe(true);
    });

    it('should parse done:no', () => {
      const result = parseSearchQuery('done:no pending');

      expect(result.searchText).toBe('pending');
      expect(result.completed).toBe(false);
    });

    it('should parse due:today', () => {
      const result = parseSearchQuery('due:today tasks');

      expect(result.searchText).toBe('tasks');
      expect(result.dueFilter).toBe('today');
    });

    it('should parse due:week', () => {
      const result = parseSearchQuery('due:week planning');

      expect(result.searchText).toBe('planning');
      expect(result.dueFilter).toBe('week');
    });

    it('should parse due:overdue', () => {
      const result = parseSearchQuery('due:overdue');

      expect(result.searchText).toBe('');
      expect(result.dueFilter).toBe('overdue');
    });

    it('should parse complex query with multiple filters', () => {
      const result = parseSearchQuery('tag:gtd:next context:elastic completed:false bug');

      expect(result.searchText).toBe('bug');
      expect(result.tags).toEqual(['gtd:next']);
      expect(result.context).toBe('elastic');
      expect(result.completed).toBe(false);
    });

    it('should handle empty query', () => {
      const result = parseSearchQuery('');

      expect(result.searchText).toBe('');
      expect(result.tags).toEqual([]);
    });

    it('should handle filter-only query', () => {
      const result = parseSearchQuery('tag:urgent');

      expect(result.searchText).toBe('');
      expect(result.tags).toEqual(['urgent']);
    });

    it('should clean up extra whitespace', () => {
      const result = parseSearchQuery('tag:test    multiple   spaces');

      expect(result.searchText).toBe('multiple spaces');
    });
  });

  describe('generateWhereConditions', () => {
    const escapeString = (s: string) => s.replace(/"/g, '\\"');

    it('should generate MATCH condition for search text', () => {
      const parsed = parseSearchQuery('meeting');
      const conditions = generateWhereConditions(parsed, escapeString);

      expect(conditions).toHaveLength(1);
      expect(conditions[0]).toContain('MATCH(title');
      expect(conditions[0]).toContain('MATCH(description');
      expect(conditions[0]).toContain('meeting');
    });

    it('should generate tag conditions', () => {
      const parsed = parseSearchQuery('tag:gtd:next tag:urgent');
      const conditions = generateWhereConditions(parsed, escapeString);

      expect(conditions.some((c) => c.includes('tags :'))).toBe(true);
      expect(conditions.some((c) => c.includes('gtd:next'))).toBe(true);
      expect(conditions.some((c) => c.includes('urgent'))).toBe(true);
    });

    it('should generate context condition', () => {
      const parsed = parseSearchQuery('context:elastic');
      const conditions = generateWhereConditions(parsed, escapeString);

      expect(conditions.some((c) => c.includes('context =='))).toBe(true);
      expect(conditions.some((c) => c.includes('elastic'))).toBe(true);
    });

    it('should generate completed IS NULL for completed:false', () => {
      const parsed = parseSearchQuery('completed:false');
      const conditions = generateWhereConditions(parsed, escapeString);

      expect(conditions).toContain('completed IS NULL');
    });

    it('should generate completed IS NOT NULL for completed:true', () => {
      const parsed = parseSearchQuery('completed:true');
      const conditions = generateWhereConditions(parsed, escapeString);

      expect(conditions).toContain('completed IS NOT NULL');
    });

    it('should generate due filter for overdue', () => {
      const parsed = parseSearchQuery('due:overdue');
      const conditions = generateWhereConditions(parsed, escapeString);

      expect(conditions.some((c) => c.includes('due <'))).toBe(true);
      expect(conditions.some((c) => c.includes('completed IS NULL'))).toBe(true);
    });

    it('should return empty array for empty query', () => {
      const parsed = parseSearchQuery('');
      const conditions = generateWhereConditions(parsed, escapeString);

      expect(conditions).toHaveLength(0);
    });
  });
});
