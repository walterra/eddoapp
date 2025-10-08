/**
 * Constants for daily briefing and recap functionality
 */

/**
 * Unique marker that must be included in the actual briefing content
 * Used to distinguish the briefing from intro messages
 */
export const BRIEFING_CONTENT_MARKER = '---BRIEFING-START---';

export const DAILY_BRIEFING_REQUEST_MESSAGE =
  'Generate an ACTIONABLE daily briefing with SPECIFIC todo examples. Call these tools: 1) listTodos for today, 2) listTodos for overdue items, 3) listTodos with tags gtd:next, 4) listTodos with tags gtd:waiting, 5) listTodos with tags gtd:calendar for today\'s appointments, 6) getActiveTimeTracking for active time tracking. Then create a briefing that includes: ACTUAL TITLES of 3-5 specific todos I can work on right now, not just counts. For each section, show the top 2-3 SPECIFIC items with clean titles like "• Fix authentication bug" or "• Review project proposal" - DO NOT include IDs or technical identifiers in the display. For calendar appointments, show them with their time prefix (e.g., "• 15:00 Doctor appointment"). Prioritize work tasks Mon-Fri, personal tasks weekends. Make it mobile-friendly with clear, readable action items. IMPORTANT: Start your briefing response with exactly this marker on its own line: ---BRIEFING-START---';

/**
 * Unique marker that must be included in the actual recap content
 * Used to distinguish the recap from intro messages
 */
export const RECAP_CONTENT_MARKER = '---RECAP-START---';

export const DAILY_RECAP_REQUEST_MESSAGE =
  'You MUST send TWO separate messages:\n\n' +
  '**FIRST MESSAGE (NO MARKER):**\n' +
  '- Send ONLY a brief acknowledgment (under 10 words)\n' +
  '- Examples: "Generating your daily recap..." or "Let me check what you accomplished today..."\n' +
  '- DO NOT include the ---RECAP-START--- marker\n' +
  '- DO NOT include any recap content\n\n' +
  '**SECOND MESSAGE (WITH MARKER):**\n' +
  '- Start with EXACTLY this marker on its own line: ---RECAP-START---\n' +
  '- Then include the full recap content after the marker\n' +
  "- Calculate today's date range: start at 00:00:00.000Z, end at 23:59:59.999Z\n" +
  '- Call these tools: 1) listTodos with completedFrom/completedTo for today, 2) getActiveTimeTracking, 3) listTodos with tags gtd:next and completed false\n' +
  '- Generate an INSIGHTFUL daily recap with SPECIFIC completed tasks:\n' +
  '  • ACTUAL TITLES grouped by context (work/personal)\n' +
  '  • Clean titles like "✅ Fixed authentication bug" or "✅ Completed project proposal"\n' +
  '  • NO IDs or technical identifiers\n' +
  '  • Show 5-7 specific accomplishments if available\n' +
  '  • For time-tracked items, show duration if meaningful (e.g., "✅ Project X (2h 30m)")\n' +
  '  • Highlight productivity patterns and celebrate wins with encouraging tone\n' +
  '  • End with brief motivational outlook mentioning 2-3 SPECIFIC next actions for tomorrow\n' +
  '  • Make it mobile-friendly with clear, readable accomplishments\n\n' +
  'CRITICAL: The marker ---RECAP-START--- MUST be at the beginning of the SECOND message ONLY.';
