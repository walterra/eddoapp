import isNil from 'lodash-es/isNil';

import { type TodoAlpha3 } from './todo_alpha3';

type UnknownObject = Record<string, unknown> | { [key: string]: unknown };

export interface TodoAlpha4 extends Omit<TodoAlpha3, 'version'> {
  /** Optional scheduled local time in HH:mm format. */
  scheduledTime?: string | null;
  /** Optional IANA timezone for scheduled time interpretation. */
  scheduledTimeZone?: string | null;
  version: 'alpha4';
}

export interface TitleTimeExtractionResult {
  title: string;
  scheduledTime: string | null;
}

const TITLE_TIME_PREFIX_PATTERN = /^([01]?\d|2[0-3]):([0-5]\d)\s+(.+)$/;
const DATE_PREFIX_LENGTH = 10;

export function isTodoAlpha4(arg: unknown): arg is TodoAlpha4 {
  return (
    typeof arg === 'object' &&
    !isNil(arg) &&
    'version' in arg &&
    (arg as UnknownObject).version === 'alpha4'
  );
}

/**
 * Extracts strict HH:mm or H:mm title prefixes.
 *
 * @param title Todo title.
 * @return Title without time prefix and extracted scheduled time.
 */
export function extractScheduledTimeFromTitle(title: string): TitleTimeExtractionResult {
  const match = TITLE_TIME_PREFIX_PATTERN.exec(title.trim());

  if (!match) {
    return { title, scheduledTime: null };
  }

  const hour = match[1].padStart(2, '0');
  const minute = match[2];
  const extractedTitle = match[3].trim();

  return { title: extractedTitle, scheduledTime: `${hour}:${minute}` };
}

/**
 * Normalizes legacy due timestamps to date-only strings.
 *
 * @param due Legacy due value.
 * @return Date-only due value.
 */
export function normalizeDueDate(due: string): string {
  return due.slice(0, DATE_PREFIX_LENGTH);
}

export function migrateToAlpha4(arg: TodoAlpha3): TodoAlpha4 {
  const extraction = extractScheduledTimeFromTitle(arg.title);

  return {
    ...arg,
    due: normalizeDueDate(arg.due),
    title: extraction.title,
    scheduledTime: extraction.scheduledTime,
    scheduledTimeZone: null,
    version: 'alpha4',
  };
}
