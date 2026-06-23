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

const DATE_PREFIX_LENGTH = 10;
const MAX_HOUR = 23;
const MAX_MINUTE = 59;
const SINGLE_DIGIT_HOUR_LENGTH = 1;
const DOUBLE_DIGIT_HOUR_LENGTH = 2;
const MINUTE_LENGTH = 2;

export function isTodoAlpha4(arg: unknown): arg is TodoAlpha4 {
  return (
    typeof arg === 'object' &&
    !isNil(arg) &&
    'version' in arg &&
    (arg as UnknownObject).version === 'alpha4'
  );
}

const isDigit = (value: string): boolean => value >= '0' && value <= '9';

const isWhitespace = (value: string): boolean => value !== '' && value.trim() === '';

const parseTimePart = (value: string, maxValue: number): string | null => {
  if (value === '' || [...value].some((character) => !isDigit(character))) {
    return null;
  }

  const parsedValue = Number(value);
  if (parsedValue > maxValue) {
    return null;
  }

  return value.padStart(2, '0');
};

const findTitleStartIndex = (title: string, searchStartIndex: number): number => {
  for (let index = searchStartIndex; index < title.length; index += 1) {
    if (!isWhitespace(title.charAt(index))) {
      return index;
    }
  }

  return -1;
};

interface ParsedTitlePrefixTime {
  scheduledTime: string;
  titleSearchStartIndex: number;
}

const parseTitlePrefixTime = (title: string): ParsedTitlePrefixTime | null => {
  const colonIndex = title.indexOf(':');
  if (colonIndex !== SINGLE_DIGIT_HOUR_LENGTH && colonIndex !== DOUBLE_DIGIT_HOUR_LENGTH) {
    return null;
  }

  const minuteStartIndex = colonIndex + 1;
  const minuteEndIndex = minuteStartIndex + MINUTE_LENGTH;
  const hour = parseTimePart(title.slice(0, colonIndex), MAX_HOUR);
  const minute = parseTimePart(title.slice(minuteStartIndex, minuteEndIndex), MAX_MINUTE);
  if (!hour || !minute || !isWhitespace(title.charAt(minuteEndIndex))) {
    return null;
  }

  return { scheduledTime: `${hour}:${minute}`, titleSearchStartIndex: minuteEndIndex };
};

/**
 * Extracts strict HH:mm or H:mm title prefixes.
 *
 * @param title Todo title.
 * @return Title without time prefix and extracted scheduled time.
 */
export function extractScheduledTimeFromTitle(title: string): TitleTimeExtractionResult {
  const trimmedTitle = title.trim();
  const parsedTime = parseTitlePrefixTime(trimmedTitle);

  if (!parsedTime) {
    return { title, scheduledTime: null };
  }

  const titleStartIndex = findTitleStartIndex(trimmedTitle, parsedTime.titleSearchStartIndex);
  if (titleStartIndex === -1) {
    return { title, scheduledTime: null };
  }

  return { title: trimmedTitle.slice(titleStartIndex), scheduledTime: parsedTime.scheduledTime };
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
