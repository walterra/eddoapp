/**
 * Query syntax parser for smart search.
 *
 * Supported syntax:
 * - `tag:value` or `tags:value` - Filter by tag (supports multiple)
 * - `context:value` - Filter by context
 * - `completed:true/false` or `done:true/false` - Filter by completion status
 * - `due:today/week/overdue` - Filter by due date
 * - `"exact phrase"` - Exact phrase match (uses wildcards for substring)
 * - Remaining text is used for full-text search
 *
 * Examples:
 * - "tag:gtd:next meeting" → tag filter + search "meeting"
 * - "context:elastic bug fix" → context filter + search "bug fix"
 * - "completed:false urgent" → only pending + search "urgent"
 * - "tag:github tag:review PR" → multiple tags + search "PR"
 * - "due:overdue" → overdue todos
 * - `"lens ui"` → exact phrase match for "lens ui"
 */

/** Parsed search query result */
export interface ParsedQuery {
  /** Full-text search terms (remaining after extracting filters) */
  searchText: string;
  /** Exact phrases to match (from quoted strings) */
  exactPhrases: string[];
  /** Tags to filter by (OR logic) */
  tags: string[];
  /** Context to filter by (exact match) */
  context: string | null;
  /** Completion status filter */
  completed: boolean | null;
  /** Due date filter */
  dueFilter: 'today' | 'week' | 'overdue' | null;
}

/**
 * Parses a search query string into structured filters and search text.
 * @param query - Raw query string from user
 * @returns Parsed query with filters and remaining search text
 */
export function parseSearchQuery(query: string): ParsedQuery {
  const result: ParsedQuery = {
    searchText: query,
    exactPhrases: [],
    tags: [],
    context: null,
    completed: null,
    dueFilter: null,
  };

  // Extract exact phrases (quoted strings) first
  const phrasePattern = /"([^"]+)"/g;
  let phraseMatch;
  while ((phraseMatch = phrasePattern.exec(query)) !== null) {
    result.exactPhrases.push(phraseMatch[1]);
    result.searchText = result.searchText.replace(phraseMatch[0], '');
  }

  // Extract tags (tag:value or tags:value)
  const tagPattern = /\b(?:tag|tags):(\S+)/gi;
  const tagMatches = [...result.searchText.matchAll(tagPattern)];
  for (const tagMatch of tagMatches) {
    result.tags.push(tagMatch[1]);
  }
  result.searchText = result.searchText.replace(tagPattern, '');

  // Extract context (context:value)
  const contextPattern = /\bcontext:(\S+)/i;
  const contextMatch = result.searchText.match(contextPattern);
  if (contextMatch) {
    result.context = contextMatch[1];
    result.searchText = result.searchText.replace(contextMatch[0], '');
  }

  // Extract completion status (completed:true/false or done:yes/no)
  const completedPattern = /\b(?:completed|done):(true|false|yes|no)/i;
  const completedMatch = result.searchText.match(completedPattern);
  if (completedMatch) {
    const value = completedMatch[1].toLowerCase();
    result.completed = value === 'true' || value === 'yes';
    result.searchText = result.searchText.replace(completedMatch[0], '');
  }

  // Extract due filter (due:today/week/overdue)
  const duePattern = /\bdue:(today|week|overdue)/i;
  const dueMatch = result.searchText.match(duePattern);
  if (dueMatch) {
    result.dueFilter = dueMatch[1].toLowerCase() as 'today' | 'week' | 'overdue';
    result.searchText = result.searchText.replace(dueMatch[0], '');
  }

  // Clean up remaining search text
  result.searchText = result.searchText.trim().replace(/\s+/g, ' ');

  return result;
}

/** Generate full-text search condition */
function generateFullTextCondition(
  searchText: string,
  escapeString: (s: string) => string,
): string {
  const escaped = escapeString(searchText);
  return `(MATCH(title, "${escaped}") OR MATCH(description, "${escaped}") OR MATCH(notesContent, "${escaped}"))`;
}

/** Generate exact phrase condition using LIKE (* = any chars in ES|QL) */
function generatePhraseCondition(phrase: string, escapeString: (s: string) => string): string {
  const escaped = escapeString(phrase.toLowerCase());
  // Use COALESCE to handle null fields - null LIKE pattern returns null, not false
  // ES|QL uses * for wildcard (not % like standard SQL)
  return `(COALESCE(TO_LOWER(title), "") LIKE "*${escaped}*" OR COALESCE(TO_LOWER(description), "") LIKE "*${escaped}*" OR COALESCE(TO_LOWER(notesContent), "") LIKE "*${escaped}*")`;
}

/** Generate due date filter condition */
function generateDueDateCondition(dueFilter: 'today' | 'week' | 'overdue'): string {
  const now = new Date().toISOString();
  const today = now.split('T')[0];

  if (dueFilter === 'today') {
    return `due >= "${today}T00:00:00.000Z" AND due < "${today}T23:59:59.999Z"`;
  }
  if (dueFilter === 'week') {
    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() + 7);
    return `due >= "${now}" AND due <= "${weekEnd.toISOString()}"`;
  }
  return `due < "${now}" AND completed IS NULL`; // overdue
}

/**
 * Generates ES|QL WHERE conditions from a parsed query.
 * @param parsed - Parsed query
 * @param escapeString - Function to escape strings for ES|QL
 * @returns Array of WHERE condition strings
 */
export function generateWhereConditions(
  parsed: ParsedQuery,
  escapeString: (s: string) => string,
): string[] {
  const conditions: string[] = [];

  if (parsed.searchText.length > 0) {
    conditions.push(generateFullTextCondition(parsed.searchText, escapeString));
  }

  for (const phrase of parsed.exactPhrases) {
    conditions.push(generatePhraseCondition(phrase, escapeString));
  }

  if (parsed.tags.length > 0) {
    const tagConditions = parsed.tags.map((tag) => `tags : "${escapeString(tag)}"`).join(' OR ');
    conditions.push(`(${tagConditions})`);
  }

  if (parsed.context) {
    conditions.push(`context == "${escapeString(parsed.context)}"`);
  }

  if (parsed.completed !== null) {
    conditions.push(parsed.completed ? 'completed IS NOT NULL' : 'completed IS NULL');
  }

  if (parsed.dueFilter) {
    conditions.push(generateDueDateCondition(parsed.dueFilter));
  }

  return conditions;
}

/**
 * Formats a help message showing supported query syntax.
 */
export function getQuerySyntaxHelp(): string {
  return `
Search syntax:
  tag:value       Filter by tag (e.g., tag:gtd:next)
  context:value   Filter by context (e.g., context:elastic)
  completed:bool  Filter by status (completed:false or done:no)
  due:filter      Filter by due date (due:today, due:week, due:overdue)
  "exact phrase"  Exact phrase match (case-insensitive)
  
Examples:
  tag:gtd:next meeting     → todos tagged gtd:next containing "meeting"
  context:elastic bug      → elastic context todos containing "bug"
  completed:false urgent   → pending todos containing "urgent"
  due:overdue              → overdue todos
  "lens ui"                → todos containing exact phrase "lens ui"
  "lens ui" context:elastic → elastic todos with exact phrase "lens ui"
`.trim();
}
