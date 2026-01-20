/**
 * Query syntax parser for smart search.
 *
 * Supported syntax:
 * - `tag:value` or `tags:value` - Filter by tag (supports multiple)
 * - `context:value` - Filter by context
 * - `completed:true/false` or `done:true/false` - Filter by completion status
 * - `due:today/week/overdue` - Filter by due date
 * - Remaining text is used for full-text search
 *
 * Examples:
 * - "tag:gtd:next meeting" → tag filter + search "meeting"
 * - "context:elastic bug fix" → context filter + search "bug fix"
 * - "completed:false urgent" → only pending + search "urgent"
 * - "tag:github tag:review PR" → multiple tags + search "PR"
 * - "due:overdue" → overdue todos
 */

/** Parsed search query result */
export interface ParsedQuery {
  /** Full-text search terms (remaining after extracting filters) */
  searchText: string;
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
    tags: [],
    context: null,
    completed: null,
    dueFilter: null,
  };

  // Extract tags (tag:value or tags:value)
  const tagPattern = /\b(?:tag|tags):(\S+)/gi;
  let tagMatch;
  while ((tagMatch = tagPattern.exec(query)) !== null) {
    result.tags.push(tagMatch[1]);
    result.searchText = result.searchText.replace(tagMatch[0], '');
  }

  // Extract context (context:value)
  const contextPattern = /\bcontext:(\S+)/i;
  const contextMatch = query.match(contextPattern);
  if (contextMatch) {
    result.context = contextMatch[1];
    result.searchText = result.searchText.replace(contextMatch[0], '');
  }

  // Extract completion status (completed:true/false or done:yes/no)
  const completedPattern = /\b(?:completed|done):(true|false|yes|no)/i;
  const completedMatch = query.match(completedPattern);
  if (completedMatch) {
    const value = completedMatch[1].toLowerCase();
    result.completed = value === 'true' || value === 'yes';
    result.searchText = result.searchText.replace(completedMatch[0], '');
  }

  // Extract due filter (due:today/week/overdue)
  const duePattern = /\bdue:(today|week|overdue)/i;
  const dueMatch = query.match(duePattern);
  if (dueMatch) {
    result.dueFilter = dueMatch[1].toLowerCase() as 'today' | 'week' | 'overdue';
    result.searchText = result.searchText.replace(dueMatch[0], '');
  }

  // Clean up remaining search text
  result.searchText = result.searchText.trim().replace(/\s+/g, ' ');

  return result;
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

  // Full-text search on title, description, and notes content
  if (parsed.searchText.length > 0) {
    const escaped = escapeString(parsed.searchText);
    conditions.push(
      `(MATCH(title, "${escaped}") OR MATCH(description, "${escaped}") OR MATCH(notesContent, "${escaped}"))`,
    );
  }

  // Tag filters (OR logic - match any tag)
  if (parsed.tags.length > 0) {
    const tagConditions = parsed.tags.map((tag) => `tags : "${escapeString(tag)}"`).join(' OR ');
    conditions.push(`(${tagConditions})`);
  }

  // Context filter (exact match)
  if (parsed.context) {
    conditions.push(`context == "${escapeString(parsed.context)}"`);
  }

  // Completion status filter
  if (parsed.completed !== null) {
    if (parsed.completed) {
      conditions.push('completed IS NOT NULL');
    } else {
      conditions.push('completed IS NULL');
    }
  }

  // Due date filter
  if (parsed.dueFilter) {
    const now = new Date().toISOString();
    const today = now.split('T')[0];

    switch (parsed.dueFilter) {
      case 'today':
        conditions.push(`due >= "${today}T00:00:00.000Z" AND due < "${today}T23:59:59.999Z"`);
        break;
      case 'week': {
        const weekEnd = new Date();
        weekEnd.setDate(weekEnd.getDate() + 7);
        conditions.push(`due >= "${now}" AND due <= "${weekEnd.toISOString()}"`);
        break;
      }
      case 'overdue':
        conditions.push(`due < "${now}" AND completed IS NULL`);
        break;
    }
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
  
Examples:
  tag:gtd:next meeting     → todos tagged gtd:next containing "meeting"
  context:elastic bug      → elastic context todos containing "bug"
  completed:false urgent   → pending todos containing "urgent"
  due:overdue              → overdue todos
`.trim();
}
