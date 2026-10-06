import { describe, expect, it } from 'vitest';
import { checkCalibration } from './day_paging_calibration_check';
import { defaultProfile, generateFixture, type DayPagingProfile } from './day_paging_fixture';
import { analyzeReference } from './reference_statistics';

function referenceProfile(): DayPagingProfile {
  const base = {
    ...defaultProfile,
    totalTodos: 12,
    days: 4,
    contexts: 3,
    descriptionBytes: 128,
    activityEntries: 2,
  };
  const docs = generateFixture(base);
  docs[4].parentId = docs[0]._id;
  docs[1].parentId = docs[0]._id;
  docs[0].title = 'private source title';
  docs[0].description = 'private source description';
  return { ...base, calibration: analyzeReference(docs) };
}

describe('reference-calibrated synthetic fixture', () => {
  it('matches empirical distributions and cross-day parent-child placements', () => {
    const profile = referenceProfile();
    const docs = generateFixture(profile);
    expect(checkCalibration(profile, docs)?.matched).toContain('relationships');
    expect(docs.filter((doc) => doc.parentId)).toHaveLength(2);
    expect(generateFixture(profile)).toEqual(docs);
  });
  it('does not retain source IDs or private content in the aggregate profile', () => {
    const profile = referenceProfile();
    expect(JSON.stringify(profile)).not.toContain('private source');
    expect(JSON.stringify(profile.calibration!.relationships)).not.toContain('2020-01-01T');
    expect(JSON.stringify(generateFixture(profile))).not.toContain('private source');
  });
  it('rejects drift in calibrated relationships', () => {
    const profile = referenceProfile();
    const docs = generateFixture(profile).map((doc) => ({ ...doc, parentId: null }));
    expect(() => checkCalibration(profile, docs)).toThrow('parent-child');
  });
  it('preserves skewed context populations and historical activity spans', () => {
    const docs = generateFixture({ ...defaultProfile, totalTodos: 12, days: 4, contexts: 2 });
    docs.forEach((doc, index) => {
      doc.context = index < 9 ? 'private-work' : 'private-home';
    });
    docs[0].active = {
      '2017-10-02T12:34:56.000Z': '2017-10-04T13:45:00.000Z',
      '2026-10-05T14:32:10.000Z': null,
    };
    const calibration = analyzeReference(docs);
    const profile = { ...defaultProfile, calibration };
    const synthetic = analyzeReference(generateFixture(profile));
    expect(synthetic.activityWindows).toEqual(calibration.activityWindows);
    expect(synthetic.contextSizes).toEqual(calibration.contextSizes);
    expect(JSON.stringify(calibration)).not.toContain('private-work');
    expect(JSON.stringify(calibration)).not.toContain('12:34:56');
  });
  it('rejects drift in activity timeline even when entry counts match', () => {
    const profile = referenceProfile();
    const docs = generateFixture(profile);
    const entries = Object.entries(docs[0].active);
    entries[0] = ['2040-01-01T00:00:00.000Z', '2040-01-01T00:01:00.000Z'];
    docs[0].active = Object.fromEntries(entries);
    expect(() => checkCalibration(profile, docs)).toThrow('timeline mismatch');
  });
  it('separates undated todos from daily workload density', () => {
    const docs = generateFixture({ ...defaultProfile, totalTodos: 4, days: 4 });
    docs[0].due = '';
    const stats = analyzeReference(docs);
    expect(stats.undatedTodos).toBe(1);
    expect(stats.todosPerPopulatedDay.count).toBe(3);
  });
});
