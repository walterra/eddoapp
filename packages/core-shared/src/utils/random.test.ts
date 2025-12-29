import { describe, expect, it } from 'vitest';

import { getRandomHex, getRandomInt } from './random';

describe('random utilities', () => {
  describe('getRandomInt', () => {
    it('returns values within range [0, max)', () => {
      for (let i = 0; i < 100; i++) {
        const value = getRandomInt(10);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(10);
      }
    });

    it('returns integer values', () => {
      for (let i = 0; i < 100; i++) {
        const value = getRandomInt(1000);
        expect(Number.isInteger(value)).toBe(true);
      }
    });
  });

  describe('getRandomHex', () => {
    it('returns hex string of correct length', () => {
      expect(getRandomHex(4)).toHaveLength(8);
      expect(getRandomHex(8)).toHaveLength(16);
      expect(getRandomHex(16)).toHaveLength(32);
    });

    it('returns valid hex characters only', () => {
      const hex = getRandomHex(16);
      expect(hex).toMatch(/^[0-9a-f]+$/);
    });

    it('generates unique values', () => {
      const values = new Set<string>();
      for (let i = 0; i < 100; i++) {
        values.add(getRandomHex(8));
      }
      expect(values.size).toBe(100);
    });
  });
});
