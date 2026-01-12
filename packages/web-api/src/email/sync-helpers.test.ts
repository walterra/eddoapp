import { describe, expect, it } from 'vitest';

import { createSyncStats, incrementStat, type ProcessEmailResult } from './sync-helpers.js';

describe('sync-helpers', () => {
  describe('createSyncStats', () => {
    it('creates empty stats object', () => {
      const stats = createSyncStats();

      expect(stats.fetched).toBe(0);
      expect(stats.created).toBe(0);
      expect(stats.skipped).toBe(0);
      expect(stats.errors).toBe(0);
    });
  });

  describe('incrementStat', () => {
    it('increments created count for created result', () => {
      const stats = createSyncStats();
      const result: ProcessEmailResult = { status: 'created', uid: 1, todoId: 'test-id' };

      incrementStat(stats, result);

      expect(stats.created).toBe(1);
      expect(stats.skipped).toBe(0);
      expect(stats.errors).toBe(0);
    });

    it('increments skipped count for skipped result', () => {
      const stats = createSyncStats();
      const result: ProcessEmailResult = { status: 'skipped', uid: 1 };

      incrementStat(stats, result);

      expect(stats.skipped).toBe(1);
      expect(stats.created).toBe(0);
      expect(stats.errors).toBe(0);
    });

    it('increments skipped count for needs_move result', () => {
      const stats = createSyncStats();
      const result: ProcessEmailResult = { status: 'needs_move', uid: 1, todoId: 'test-id' };

      incrementStat(stats, result);

      expect(stats.skipped).toBe(1);
      expect(stats.created).toBe(0);
      expect(stats.errors).toBe(0);
    });

    it('increments errors count for error result', () => {
      const stats = createSyncStats();

      incrementStat(stats, { status: 'error' });

      expect(stats.errors).toBe(1);
      expect(stats.created).toBe(0);
      expect(stats.skipped).toBe(0);
    });

    it('accumulates counts correctly', () => {
      const stats = createSyncStats();

      incrementStat(stats, { status: 'created', uid: 1, todoId: 'id1' });
      incrementStat(stats, { status: 'created', uid: 2, todoId: 'id2' });
      incrementStat(stats, { status: 'skipped', uid: 3 });
      incrementStat(stats, { status: 'needs_move', uid: 4, todoId: 'id4' });
      incrementStat(stats, { status: 'error' });

      expect(stats.created).toBe(2);
      expect(stats.skipped).toBe(2); // skipped + needs_move
      expect(stats.errors).toBe(1);
    });
  });
});
