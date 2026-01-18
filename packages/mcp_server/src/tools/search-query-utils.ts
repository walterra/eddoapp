/**
 * Query parsing utilities for todo search.
 */

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

/** Generates ES|QL condition for due date filter. */
export function generateDueCondition(dueFilter: 'today' | 'week' | 'overdue'): string {
  const now = new Date().toISOString();
  const today = now.split('T')[0];

  switch (dueFilter) {
    case 'today':
      return `due >= "${today}T00:00:00.000Z" AND due < "${today}T23:59:59.999Z"`;
    case 'week': {
      const weekEnd = new Date();
      weekEnd.setDate(weekEnd.getDate() + 7);
      return `due >= "${now}" AND due <= "${weekEnd.toISOString()}"`;
    }
    case 'overdue':
      return `due < "${now}" AND completed IS NULL`;
  }
}

/** Generates ES|QL WHERE conditions from a parsed query. */
export function generateWhereConditions(parsed: ParsedQuery, includeCompleted: boolean): string[] {
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
    conditions.push(generateDueCondition(parsed.dueFilter));
  }

  return conditions;
}

/** Builds ES|QL query from parsed search parameters. */
export function buildEsqlQuery(indexName: string, parsed: ParsedQuery, limit: number): string {
  const conditions = generateWhereConditions(parsed, true);
  let query = `FROM ${indexName} METADATA _score`;

  if (conditions.length > 0) {
    query += ` | WHERE ${conditions.join(' AND ')}`;
  }

  query += parsed.searchText.length > 0 ? ` | SORT _score DESC` : ` | SORT due ASC`;
  query += ` | LIMIT ${limit} | KEEP todoId, _score`;
  return query;
}
