import { describe, expect, it } from 'vitest';
import { defaultProfile, generateFixture, offsetDate } from './day_paging_fixture';

describe('day paging fixture', () => {
  it('generates identical synthetic documents from a fixed profile', () => {
    const profile = { ...defaultProfile, totalTodos: 30, days: 10 };
    expect(generateFixture(profile)).toEqual(generateFixture(profile));
  });
  it('distributes documents across all configured days with unique IDs', () => {
    const docs = generateFixture({ ...defaultProfile, totalTodos: 30, days: 10 });
    expect(new Set(docs.map((doc) => doc._id)).size).toBe(30);
    expect(new Set(docs.map((doc) => doc.due)).size).toBe(10);
    expect(docs.filter((doc) => doc.due === defaultProfile.referenceDate)).toHaveLength(3);
    expect(
      docs.every((doc) => doc.version === 'alpha4' && Object.keys(doc.active).length === 8),
    ).toBe(true);
  });
  it('rejects invalid profiles', () => {
    expect(() => generateFixture({ ...defaultProfile, days: 0 })).toThrow();
    expect(() => generateFixture({ ...defaultProfile, referenceDate: '2026-02-30' })).toThrow();
    expect(() => generateFixture({ ...defaultProfile, totalTodos: -1 })).toThrow();
  });
  it('offsets dates across month boundaries', () => {
    expect(offsetDate('2026-10-31', 1)).toBe('2026-11-01');
  });
});
