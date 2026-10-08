import type { TodoAlpha4 } from '@eddo/core-shared';
import { generateCalibrated } from './day_paging_calibration';
import type { ReferenceStatistics } from './reference_types';

export type SyntheticTodo = Omit<TodoAlpha4, '_rev'>;

export interface DayPagingProfile {
  name: string;
  seed: number;
  referenceDate: string;
  totalTodos: number;
  days: number;
  contexts: number;
  descriptionBytes: number;
  activityEntries: number;
  calibration?: ReferenceStatistics;
}

/** Defines a provisional workload, not measured walterra account statistics. */
export const defaultProfile: DayPagingProfile = {
  name: 'provisional-large',
  seed: 647,
  referenceDate: '2026-10-05',
  totalTodos: 10000,
  days: 365,
  contexts: 12,
  descriptionBytes: 512,
  activityEntries: 8,
};

/** Returns a UTC date offset from the fixed reference date. */
export function offsetDate(referenceDate: string, offset: number): string {
  const date = new Date(`${referenceDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

/** Rejects invalid workload sizes before allocating documents. */
export function validateProfile(profile: DayPagingProfile): void {
  for (const key of [
    'seed',
    'totalTodos',
    'days',
    'contexts',
    'descriptionBytes',
    'activityEntries',
  ] as const) {
    if (!Number.isSafeInteger(profile[key]) || profile[key] < 0) {
      throw new Error(`Invalid profile field: ${key}`);
    }
  }
  if (!profile.days || !profile.contexts || profile.totalTodos < profile.days) {
    throw new Error('Profile requires positive days/contexts and at least one todo per day');
  }
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(profile.referenceDate) ||
    offsetDate(profile.referenceDate, 0) !== profile.referenceDate
  ) {
    throw new Error('Invalid reference date');
  }
}

/** Generates repeatable synthetic documents without real account contents. */
export function generateFixture(profile: DayPagingProfile): SyntheticTodo[] {
  validateProfile(profile);
  if (profile.calibration) return generateCalibrated(profile);
  return Array.from({ length: profile.totalTodos }, (_, index) => {
    const day = index % profile.days;
    const due = offsetDate(profile.referenceDate, day);
    const active: Record<string, string | null> = {};
    for (let entry = 0; entry < profile.activityEntries; entry++) {
      const date = offsetDate(profile.referenceDate, -entry - 1);
      active[`${date}T09:00:00.000Z`] = `${date}T09:15:00.000Z`;
    }
    return {
      _id: new Date(Date.UTC(2020, 0, 1) + index * 1000 + profile.seed).toISOString(),
      version: 'alpha4',
      title: `Benchmark ${due} item ${index}`,
      description: 'Synthetic workload. '
        .repeat(Math.ceil(profile.descriptionBytes / 20))
        .slice(0, profile.descriptionBytes),
      due,
      context: `context-${(index + profile.seed) % profile.contexts}`,
      tags: [`tag-${index % 8}`],
      active,
      completed: index % 4 === 0 ? `${due}T18:00:00.000Z` : null,
      repeat: null,
      link: null,
      scheduledTime: null,
      scheduledTimeZone: null,
    };
  });
}
