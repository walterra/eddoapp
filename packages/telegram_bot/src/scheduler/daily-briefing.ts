import type { ReportType } from '@eddo/assistant-server/state';
import {
  createEnv,
  createUserRegistry,
  formatDateInTimeZone,
  formatTimeInTimeZone,
  normalizeTimeZone,
} from '@eddo/core-server';
import { logger, withSpan } from '../utils/logger.js';
import type { TelegramUser } from '../utils/user-lookup.js';
import {
  createSentKey,
  isWithinTimeWindow,
  resetSentTrackersForNewTimeZoneDays,
  type SentTrackerState,
} from './daily-briefing-timezone.js';
import type {
  DailyBriefingSchedulerConfig,
  DailyBriefingSchedulerStatus,
} from './daily-briefing-types.js';
import { runScheduledReport } from './report_routing.js';

export interface DailyBriefingScheduler {
  start: () => void;
  stop: () => void;
  checkNow: () => Promise<void>;
  getStatus: () => DailyBriefingSchedulerStatus;
}
interface SchedulerState extends SentTrackerState {
  timer: ReturnType<typeof setInterval> | undefined;
  inFlight: Set<string>;
}
interface ReportCheck {
  user: TelegramUser;
  type: ReportType;
  now: Date;
}

/** Checks one local-time occurrence and durably admits it without owning delivery. */
async function checkReport(state: SchedulerState, check: ReportCheck): Promise<void> {
  const { user, type, now } = check;
  const timezone = normalizeTimeZone(user.preferences.timezone);
  const scheduled =
    type === 'briefing'
      ? user.preferences.briefingTime || '07:00'
      : user.preferences.recapTime || '18:00';
  const sentKey = createSentKey(user._id, now, timezone, scheduled);
  const sent = type === 'briefing' ? state.sentBriefingsToday : state.sentRecapsToday;
  const key = `${type}:${sentKey}`;
  if (sent.has(sentKey) || state.inFlight.has(key) || !isWithinTimeWindow(scheduled, now, timezone))
    return;
  state.currentDatesByTimeZone.set(timezone, formatDateInTimeZone(now, timezone));
  state.inFlight.add(key);
  logger.info('Admitting scheduled report at preferred time', {
    username: user.username,
    type,
    timezone,
    scheduled,
    currentTime: formatTimeInTimeZone(now, timezone),
  });
  try {
    const admitted = await withSpan(`scheduler_send_${type}`, { 'user.id': user._id }, () =>
      runScheduledReport({ user, type, sentKey }),
    );
    if (admitted) sent.add(sentKey);
    logger.info('Scheduled report occurrence handled', { username: user.username, type, admitted });
  } catch (error) {
    logger.error('Failed to admit scheduled report; next check can retry admission', {
      username: user.username,
      type,
      error,
    });
  } finally {
    state.inFlight.delete(key);
  }
}

/** Lists active linked users and checks enabled report schedules. */
async function checkScheduledReports(state: SchedulerState): Promise<void> {
  const now = new Date();
  resetSentTrackersForNewTimeZoneDays(state, now);
  try {
    const env = createEnv();
    const users = await createUserRegistry(env.COUCHDB_URL, env).list();
    for (const user of users.filter((item) => item.status === 'active' && item.telegram_id)) {
      if (user.preferences.dailyBriefing)
        await checkReport(state, { user: user as TelegramUser, type: 'briefing', now });
      if (user.preferences.dailyRecap)
        await checkReport(state, { user: user as TelegramUser, type: 'recap', now });
    }
  } catch (error) {
    logger.error('Failed to check scheduled reports', { error });
  }
}

/** Keeps timezone scheduling in the bot while Durable owns execution and recovery. */
export function createDailyBriefingScheduler(
  config: DailyBriefingSchedulerConfig,
): DailyBriefingScheduler {
  const state: SchedulerState = {
    timer: undefined,
    inFlight: new Set(),
    currentDatesByTimeZone: new Map(),
    sentBriefingsToday: new Set(),
    sentRecapsToday: new Set(),
  };
  const checkNow = (): Promise<void> => checkScheduledReports(state);
  logger.info('Daily briefing scheduler created', { checkIntervalMs: config.checkIntervalMs });
  return {
    checkNow,
    start: () => {
      if (state.timer) {
        logger.warn('Daily briefing scheduler is already running');
        return;
      }
      state.timer = setInterval(() => {
        void checkNow();
      }, config.checkIntervalMs);
      logger.info('Daily briefing scheduler started');
    },
    stop: () => {
      clearInterval(state.timer);
      state.timer = undefined;
      logger.info('Daily briefing scheduler stopped');
    },
    getStatus: () => ({
      isRunning: Boolean(state.timer),
      currentDatesByTimeZone: Object.fromEntries(state.currentDatesByTimeZone),
      sentBriefingsToday: state.sentBriefingsToday.size,
      sentRecapsToday: state.sentRecapsToday.size,
      checkIntervalMs: config.checkIntervalMs,
    }),
  };
}
