/**
 * Query parsing utilities for todo search.
 */
import { formatDateInTimeZone, normalizeTimeZone } from '@eddo/core-server';

/** Parsed search query result */
export interface ParsedQuery {
  searchText: string;
  tags: string[];
  context: string | null;
  completed: boolean | null;
  dueFilter: 'today' | 'week' | 'overdue' | null;
}

/** Extracts tags from query string. */
function extractTags(query: string, result: ParsedQuery): string {
  const tagPattern = /\b(?:tag|tags):(\S+)/gi;
  let cleaned = query;
  let tagMatch;
  while ((tagMatch = tagPattern.exec(query)) !== null) {
    result.tags.push(tagMatch[1]);
    cleaned = cleaned.replace(tagMatch[0], '');
  }
  return cleaned;
}

/** Extracts context from query string. */
function extractContext(query: string, result: ParsedQuery): string {
  const contextPattern = /\bcontext:(\S+)/i;
  const contextMatch = query.match(contextPattern);
  if (contextMatch) {
    result.context = contextMatch[1];
    return query.replace(contextMatch[0], '');
  }
  return query;
}

/** Extracts completion status from query string. */
function extractCompleted(query: string, result: ParsedQuery): string {
  const completedPattern = /\b(?:completed|done):(true|false|yes|no)/i;
  const completedMatch = query.match(completedPattern);
  if (completedMatch) {
    const value = completedMatch[1].toLowerCase();
    result.completed = value === 'true' || value === 'yes';
    return query.replace(completedMatch[0], '');
  }
  return query;
}

/** Extracts due filter from query string. */
function extractDueFilter(query: string, result: ParsedQuery): string {
  const duePattern = /\bdue:(today|week|overdue)/i;
  const dueMatch = query.match(duePattern);
  if (dueMatch) {
    result.dueFilter = dueMatch[1].toLowerCase() as 'today' | 'week' | 'overdue';
    return query.replace(dueMatch[0], '');
  }
  return query;
}

/** Parses a search query string into structured filters and search text. */
export function parseSearchQuery(query: string): ParsedQuery {
  const result: ParsedQuery = {
    completed: null,
    context: null,
    dueFilter: null,
    searchText: query,
    tags: [],
  };

  let cleaned = extractTags(query, result);
  cleaned = extractContext(cleaned, result);
  cleaned = extractCompleted(cleaned, result);
  cleaned = extractDueFilter(cleaned, result);

  result.searchText = cleaned.trim().replace(/\s+/g, ' ');
  return result;
}

/** Escapes special characters in ES|QL string literals. */
export function escapeEsqlString(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export interface SearchDateContext {
  now?: Date;
  timeZone?: string;
}

const addDaysToDateOnly = (dateOnly: string, days: number): string => {
  const [year = 1970, month = 1, day = 1] = dateOnly.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().split('T')[0] ?? '1970-01-01';
};

const getTodayDate = (context: SearchDateContext = {}): string => {
  return formatDateInTimeZone(context.now ?? new Date(), normalizeTimeZone(context.timeZone));
};

/** Generates ES|QL condition for due date filter. */
export function generateDueCondition(
  dueFilter: 'today' | 'week' | 'overdue',
  context: SearchDateContext = {},
): string {
  const today = getTodayDate(context);

  switch (dueFilter) {
    case 'today':
      return `due == "${today}"`;
    case 'week':
      return `due >= "${today}" AND due <= "${addDaysToDateOnly(today, 7)}"`;
    case 'overdue':
      return `due < "${today}" AND completed IS NULL`;
  }
}

/** Generates ES|QL WHERE conditions from a parsed query. */
export function generateWhereConditions(
  parsed: ParsedQuery,
  includeCompleted: boolean,
  context: SearchDateContext = {},
): string[] {
  const conditions: string[] = [];

  if (parsed.searchText.length > 0) {
    const escaped = escapeEsqlString(parsed.searchText);
    conditions.push(`(MATCH(title, "${escaped}") OR MATCH(description, "${escaped}"))`);
  }

  if (parsed.tags.length > 0) {
    const tagConditions = parsed.tags
      .map((tag) => `tags : "${escapeEsqlString(tag)}"`)
      .join(' OR ');
    conditions.push(`(${tagConditions})`);
  }

  if (parsed.context) {
    conditions.push(`context == "${escapeEsqlString(parsed.context)}"`);
  }

  if (parsed.completed !== null) {
    conditions.push(parsed.completed ? 'completed IS NOT NULL' : 'completed IS NULL');
  } else if (!includeCompleted) {
    conditions.push('completed IS NULL');
  }

  if (parsed.dueFilter) {
    conditions.push(generateDueCondition(parsed.dueFilter, context));
  }

  return conditions;
}

export interface BuildEsqlQueryOptions {
  indexName: string;
  parsed: ParsedQuery;
  limit: number;
  includeCompleted?: boolean;
  dateContext?: SearchDateContext;
}

/** Builds ES|QL query from parsed search parameters. */
export function buildEsqlQuery(options: BuildEsqlQueryOptions): string {
  const { indexName, parsed, limit, includeCompleted = true, dateContext = {} } = options;
  const conditions = generateWhereConditions(parsed, includeCompleted, dateContext);
  let query = `FROM ${indexName} METADATA _score`;

  if (conditions.length > 0) {
    query += ` | WHERE ${conditions.join(' AND ')}`;
  }

  query += parsed.searchText.length > 0 ? ` | SORT _score DESC` : ` | SORT due ASC`;
  query += ` | LIMIT ${limit} | KEEP todoId, _score`;
  return query;
}
