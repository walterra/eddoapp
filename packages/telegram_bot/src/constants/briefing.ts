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
  'You will send TWO separate messages. FIRST MESSAGE: Send ONLY a brief acknowledgment that you are generating the recap (e.g., "Generating your daily recap..." or "Let me check what you accomplished today..."). Keep this under 10 words. DO NOT include the ---RECAP-START--- marker in the first message. DO NOT include any recap content in the first message. SECOND MESSAGE: After sending the first message, calculate today\'s date range: set start to today at 00:00:00.000Z and end to today at 23:59:59.999Z. Call these tools: 1) listTodos with completedFrom and completedTo for today\'s date range to get completed tasks, 2) getActiveTimeTracking for any ongoing work, 3) listTodos with tags gtd:next and completed false to preview upcoming tasks. Then generate an INSIGHTFUL daily recap with SPECIFIC completed task examples that includes: ACTUAL TITLES of completed tasks grouped by context (work/personal) with clean titles like "✅ Fixed authentication bug" or "✅ Completed project proposal" - DO NOT include IDs or technical identifiers in the display. Show 5-7 specific accomplishments if available. For time-tracked items, show duration if meaningful (e.g., "✅ Project X (2h 30m)"). Highlight productivity patterns and celebrate wins with an encouraging tone. End with a brief motivational outlook mentioning 2-3 SPECIFIC next actions for tomorrow. Make it mobile-friendly with clear, readable accomplishments. IMPORTANT: The ---RECAP-START--- marker goes ONLY in your SECOND message, at the very beginning, on its own line before the recap content.';
