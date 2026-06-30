import { formatDateInTimeZone, formatTimeInTimeZone } from '@eddo/core-server';

import { logger } from '../utils/logger.js';

export interface SentTrackerState {
  currentDatesByTimeZone: Map<string, string>;
  sentBriefingsToday: Set<string>;
  sentRecapsToday: Set<string>;
}

/**
 * Builds a per-user per-local-day sent key.
 *
 * @param userId User ID.
 * @param now Reference instant.
 * @param timeZone User timezone.
 * @return Sent tracker key.
 */
export function createSentKey(userId: string, now: Date, timeZone: string): string {
  return `${userId}:${formatDateInTimeZone(now, timeZone)}`;
}

/**
 * Checks whether an instant falls within a local schedule window.
 *
 * @param timeStr Scheduled HH:mm.
 * @param now Reference instant.
 * @param timeZone User timezone.
 * @return True during the five-minute send window.
 */
export function isWithinTimeWindow(timeStr: string, now: Date, timeZone: string): boolean {
  const [userHour, userMinute] = timeStr.split(':').map(Number);
  const [currentHour, currentMinute] = formatTimeInTimeZone(now, timeZone).split(':').map(Number);
  const isRightHour = currentHour === userHour;
  const isWithinWindow = currentMinute >= userMinute && currentMinute < userMinute + 5;
  return isRightHour && isWithinWindow;
}

/**
 * Clears sent trackers when known timezone-local days change.
 *
 * @param state Sent tracker state.
 * @param now Reference instant.
 */
export function resetSentTrackersForNewTimeZoneDays(state: SentTrackerState, now: Date): void {
  const knownTimeZones = new Set(state.currentDatesByTimeZone.keys());
  knownTimeZones.add('UTC');

  for (const timeZone of knownTimeZones) {
    const todayDate = formatDateInTimeZone(now, timeZone);
    if (state.currentDatesByTimeZone.get(timeZone) === todayDate) continue;
    state.sentBriefingsToday.clear();
    state.sentRecapsToday.clear();
    state.currentDatesByTimeZone.set(timeZone, todayDate);
    logger.info('New timezone day detected, reset sent briefings/recaps tracker', {
      date: todayDate,
      timeZone,
    });
  }
}
