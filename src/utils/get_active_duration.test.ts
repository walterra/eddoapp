import { getActiveDuration } from './get_active_duration';
import { describe, expect, it } from 'vitest';

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
