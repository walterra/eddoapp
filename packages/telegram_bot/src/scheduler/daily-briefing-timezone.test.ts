import { describe, expect, it } from 'vitest';

import { createSentKey } from './daily-briefing-timezone.js';

describe('createSentKey', () => {
  it('distinguishes schedule changes on the same local day', () => {
    const now = new Date('2026-10-05T19:30:00.000Z');

    const firstSchedule = createSentKey('user_walterra', now, 'Europe/Vienna', '21:13');
    const updatedSchedule = createSentKey('user_walterra', now, 'Europe/Vienna', '21:27');

    expect(firstSchedule).toBe('user_walterra:2026-10-05:21:13');
    expect(updatedSchedule).toBe('user_walterra:2026-10-05:21:27');
    expect(updatedSchedule).not.toBe(firstSchedule);
  });
});
