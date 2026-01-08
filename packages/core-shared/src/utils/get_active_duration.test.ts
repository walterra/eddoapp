import { describe, expect, it } from 'vitest';

import { getActiveDuration, getActiveDurationInRange } from './get_active_duration';

describe('getActiveDuration', () => {
  it('gets 1m active duration of a single time logging entry', () => {
    expect(
      getActiveDuration({
        '2023-04-18T15:00:00.000Z': '2023-04-18T15:01:00.000Z',
      }),
    ).toBe(60000);
  });

  it('gets ~2m active duration of a single time logging entry', () => {
    expect(
      getActiveDuration({
        '2023-04-18T15:03:22.559Z': '2023-04-18T15:05:25.950Z',
      }),
    ).toBe(123391);
  });

  it('gets 1m:1s active duration of multiple time logging entries', () => {
    expect(
      getActiveDuration({
        '2023-04-18T15:00:00.000Z': '2023-04-18T15:00:01.000Z',
        '2023-04-19T15:00:00.000Z': '2023-04-19T15:01:00.000Z',
      }),
    ).toBe(61000);
  });
});

describe('getActiveDurationInRange', () => {
  it('returns total duration when all entries are within range', () => {
    expect(
      getActiveDurationInRange(
        {
          '2023-04-18T15:00:00.000Z': '2023-04-18T15:01:00.000Z',
          '2023-04-19T15:00:00.000Z': '2023-04-19T15:01:00.000Z',
        },
        '2023-04-18',
        '2023-04-19',
      ),
    ).toBe(120000); // 2 minutes
  });

  it('excludes entries before the start date', () => {
    expect(
      getActiveDurationInRange(
        {
          '2023-04-17T15:00:00.000Z': '2023-04-17T15:01:00.000Z', // Before range
          '2023-04-18T15:00:00.000Z': '2023-04-18T15:01:00.000Z', // In range
        },
        '2023-04-18',
        '2023-04-20',
      ),
    ).toBe(60000); // 1 minute
  });

  it('excludes entries after the end date', () => {
    expect(
      getActiveDurationInRange(
        {
          '2023-04-18T15:00:00.000Z': '2023-04-18T15:01:00.000Z', // In range
          '2023-04-21T15:00:00.000Z': '2023-04-21T15:01:00.000Z', // After range
        },
        '2023-04-18',
        '2023-04-20',
      ),
    ).toBe(60000); // 1 minute
  });

  it('returns 0 when no entries are within range', () => {
    expect(
      getActiveDurationInRange(
        {
          '2023-04-15T15:00:00.000Z': '2023-04-15T15:01:00.000Z',
          '2023-04-25T15:00:00.000Z': '2023-04-25T15:01:00.000Z',
        },
        '2023-04-18',
        '2023-04-20',
      ),
    ).toBe(0);
  });

  it('returns 0 for empty active record', () => {
    expect(getActiveDurationInRange({}, '2023-04-18', '2023-04-20')).toBe(0);
  });

  it('includes entries on the boundary dates', () => {
    expect(
      getActiveDurationInRange(
        {
          '2023-04-18T00:00:00.000Z': '2023-04-18T00:01:00.000Z', // Start boundary
          '2023-04-20T23:59:00.000Z': '2023-04-20T23:59:30.000Z', // End boundary
        },
        '2023-04-18',
        '2023-04-20',
      ),
    ).toBe(90000); // 1.5 minutes
  });
});
