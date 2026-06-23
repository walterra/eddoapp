const DEFAULT_TIME_ZONE = 'UTC';

interface TimeZoneDateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/**
 * Returns the system IANA timezone or UTC fallback.
 *
 * @return Timezone identifier.
 */
export function getSystemTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIME_ZONE;
}

/**
 * Validates IANA timezone identifiers.
 *
 * @param timeZone Timezone identifier.
 * @return True when Intl accepts the timezone.
 */
export function isValidTimeZone(timeZone: string | null | undefined): boolean {
  if (!timeZone) return false;

  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
    return true;
  } catch (_error) {
    return false;
  }
}

/**
 * Returns a valid timezone or UTC fallback.
 *
 * @param timeZone Preferred timezone.
 * @return Valid timezone identifier.
 */
export function normalizeTimeZone(timeZone: string | null | undefined): string {
  return isValidTimeZone(timeZone) ? timeZone! : DEFAULT_TIME_ZONE;
}

const getTimeZoneParts = (date: Date, timeZone: string): TimeZoneDateParts => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: normalizeTimeZone(timeZone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  );

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
};

const pad = (value: number): string => value.toString().padStart(2, '0');

/**
 * Formats an instant as YYYY-MM-DD in a timezone.
 *
 * @param date Instant to format.
 * @param timeZone IANA timezone.
 * @return Date-only string.
 */
export function formatDateInTimeZone(date: Date, timeZone: string): string {
  const parts = getTimeZoneParts(date, timeZone);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

/**
 * Formats an instant as HH:mm in a timezone.
 *
 * @param date Instant to format.
 * @param timeZone IANA timezone.
 * @return Time string.
 */
export function formatTimeInTimeZone(date: Date, timeZone: string): string {
  const parts = getTimeZoneParts(date, timeZone);
  return `${pad(parts.hour)}:${pad(parts.minute)}`;
}

interface ZonedDateTimeInput {
  year: number;
  month: number;
  day: number;
  hour?: number;
  minute?: number;
  second?: number;
  millisecond?: number;
}

export interface ScheduledTimeDisplay {
  date: string;
  time: string;
  dayOffset: -1 | 0 | 1;
  timeZone: string;
}

/**
 * Converts timezone-local date parts to a UTC instant.
 *
 * @param input Local date parts.
 * @param timeZone IANA timezone.
 * @return UTC instant.
 */
export function zonedTimeToUtc(input: ZonedDateTimeInput, timeZone: string): Date {
  const utcGuess = Date.UTC(
    input.year,
    input.month - 1,
    input.day,
    input.hour ?? 0,
    input.minute ?? 0,
    input.second ?? 0,
    input.millisecond ?? 0,
  );
  const guessDate = new Date(utcGuess);
  const actualParts = getTimeZoneParts(guessDate, timeZone);
  const actualAsUtc = Date.UTC(
    actualParts.year,
    actualParts.month - 1,
    actualParts.day,
    actualParts.hour,
    actualParts.minute,
    actualParts.second,
    input.millisecond ?? 0,
  );
  const desiredAsUtc = Date.UTC(
    input.year,
    input.month - 1,
    input.day,
    input.hour ?? 0,
    input.minute ?? 0,
    input.second ?? 0,
    input.millisecond ?? 0,
  );

  return new Date(utcGuess + desiredAsUtc - actualAsUtc);
}

/**
 * Returns the UTC range for a timezone-local date.
 *
 * @param dateOnly Date in YYYY-MM-DD format.
 * @param timeZone IANA timezone.
 * @return Inclusive UTC range.
 */
export function getUtcRangeForTimeZoneDate(dateOnly: string, timeZone: string) {
  const [year = 1970, month = 1, day = 1] = dateOnly.split('-').map(Number);
  const start = zonedTimeToUtc({ year, month, day }, timeZone);
  const nextStart = zonedTimeToUtc({ year, month, day: day + 1 }, timeZone);

  return {
    start: start.toISOString(),
    end: new Date(nextStart.getTime() - 1).toISOString(),
  };
}

const getDayOffset = (sourceDate: string, targetDate: string): -1 | 0 | 1 => {
  if (targetDate < sourceDate) return -1;
  if (targetDate > sourceDate) return 1;
  return 0;
};

/**
 * Converts a scheduled local time into a display timezone.
 *
 * @param due Date-only value for the scheduled local time.
 * @param scheduledTime Scheduled HH:mm value.
 * @param scheduledTimeZone Timezone where scheduledTime was created.
 * @param displayTimeZone Timezone for rendering.
 * @return Converted display time metadata.
 */
export function formatScheduledTimeForTimeZone(
  due: string,
  scheduledTime: string,
  scheduledTimeZone: string | null | undefined,
  displayTimeZone: string,
): ScheduledTimeDisplay {
  const sourceTimeZone = normalizeTimeZone(scheduledTimeZone ?? displayTimeZone);
  const targetTimeZone = normalizeTimeZone(displayTimeZone);
  const [year = 1970, month = 1, day = 1] = due.split('-').map(Number);
  const [hour = 0, minute = 0] = scheduledTime.split(':').map(Number);
  const instant = zonedTimeToUtc({ year, month, day, hour, minute }, sourceTimeZone);
  const date = formatDateInTimeZone(instant, targetTimeZone);

  return {
    date,
    time: formatTimeInTimeZone(instant, targetTimeZone),
    dayOffset: getDayOffset(due, date),
    timeZone: targetTimeZone,
  };
}
