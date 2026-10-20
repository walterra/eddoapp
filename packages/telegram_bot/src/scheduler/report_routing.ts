import {
  formatDateInTimeZone,
  getUtcRangeForTimeZoneDate,
  normalizeTimeZone,
} from '@eddo/core-server';
import { DAILY_BRIEFING_REQUEST_MESSAGE, getRecapRequestMessage } from '../constants/briefing.js';
import { parseDurableConfig } from '../durable/config.js';
import { reportHeading } from '../durable/report_heading.js';
import type { ReportType } from '../durable/state.js';
import type { TelegramUser } from '../utils/user-lookup.js';
import { hasReportReservation, reserveReport, runReservedReport } from './report-reservation.js';

export interface ScheduledReportOptions {
  user: TelegramUser;
  type: ReportType;
  sentKey: string;
}

/** Uses discussion as context while requiring current database evidence for report facts. */
export function scheduledReportPrompt(type: ReportType, timezone?: string): string {
  const request =
    type === 'briefing' ? DAILY_BRIEFING_REQUEST_MESSAGE : getRecapRequestMessage(timezone);
  return [
    `Scheduled daily ${type}, not a new instruction from the user.`,
    'Use our conversation for priorities, constraints, and earlier decisions. Fetch current todo/time-tracking data for facts.',
    'Generate the report only. Do not create, update, delete, or start tracking tasks based on conversation history.',
    request,
    `The application renders this exact heading: ${reportHeading(type, formatDateInTimeZone(new Date(), normalizeTimeZone(timezone)))}. Return the report body without a date heading.`,
    'Include the content marker only in the final report, never before or alongside a tool call. Use tool metadata counts and selection flags; do not confuse returned items with totals.',
  ].join('\n\n');
}

/** Keeps queued reports within their scheduled local day, including DST transitions. */
function reportExpiry(user: TelegramUser): number {
  const timezone = normalizeTimeZone(user.preferences.timezone);
  const date = formatDateInTimeZone(new Date(), timezone);
  return Date.parse(getUtcRangeForTimeZoneDate(date, timezone).end);
}

/** Admits Durable reports into the active chat; legacy users retain their reservation flow. */
export async function runScheduledReport(
  options: ScheduledReportOptions,
  legacy: () => Promise<boolean>,
): Promise<boolean> {
  const { user, type, sentKey } = options;
  const key = `${type}:${sentKey}`;
  if (!parseDurableConfig(process.env).users.includes(user.username)) {
    return runReservedReport(user.database_name, key, legacy);
  }
  if (await hasReportReservation(user.database_name, key)) return false;
  const { enqueueDurableReport } = await import('../durable/host.js');
  await enqueueDurableReport({
    username: user.username,
    telegramId: user.telegram_id,
    type,
    occurrence: sentKey,
    text: scheduledReportPrompt(type, user.preferences.timezone),
    deadline: reportExpiry(user),
  });
  // Write compatibility evidence only after admission: legacy rollback must not resend this occurrence.
  await reserveReport(user.database_name, key);
  return true;
}
