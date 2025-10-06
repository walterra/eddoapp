/**
 * Constants for daily briefing functionality
 */

/**
 * Unique marker that must be included in the actual briefing content
 * Used to distinguish the briefing from intro messages
 */
export const BRIEFING_CONTENT_MARKER = '---BRIEFING-START---';

export const DAILY_BRIEFING_REQUEST_MESSAGE =
  'Generate an ACTIONABLE daily briefing with SPECIFIC todo examples. Call these tools: 1) listTodos for today, 2) listTodos for overdue items, 3) listTodos with tags gtd:next, 4) listTodos with tags gtd:waiting, 5) getActiveTimeTracking for active time tracking. Then create a briefing that includes: ACTUAL TITLES of 3-5 specific todos I can work on right now, not just counts. For each section, show the top 2-3 SPECIFIC items with clean titles like "• Fix authentication bug" or "• Review project proposal" - DO NOT include IDs or technical identifiers in the display. Prioritize work tasks Mon-Fri, personal tasks weekends. Make it mobile-friendly with clear, readable action items. IMPORTANT: Start your briefing response with exactly this marker on its own line: ---BRIEFING-START---';
