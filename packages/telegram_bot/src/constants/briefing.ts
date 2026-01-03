/**
 * Constants for daily briefing and recap functionality
 */

/**
 * Unique marker that must be included in the actual briefing content
 * Used to distinguish the briefing from intro messages
 */
export const BRIEFING_CONTENT_MARKER = '---BRIEFING-START---';

export const DAILY_BRIEFING_REQUEST_MESSAGE = `Generate an ACTIONABLE daily briefing with SPECIFIC todo examples. Call the getBriefingData tool to get all briefing data in one call. This returns:
- todaysTodos: Todos due today
- overdueTodos: Past due items needing attention
- nextActions: Items tagged gtd:next ready to work on
- waitingFor: Items tagged gtd:waiting (blocked/delegated)
- calendarToday: Appointments tagged gtd:calendar for today
- activeTimeTracking: Currently tracked work

Create a briefing that includes: ACTUAL TITLES of 3-5 specific todos I can work on right now, not just counts. For each section, show the top 2-3 SPECIFIC items with clean titles like "- Fix authentication bug" or "- Review project proposal" - DO NOT include IDs or technical identifiers in the display. For calendar appointments, show them with their time prefix (e.g., "- 15:00 Doctor appointment"). Prioritize work tasks Mon-Fri, personal tasks weekends. Make it mobile-friendly with clear, readable action items.

FORMATTING RULES FOR THERMAL PRINTER: NO EMOJIS ANYWHERE - they will not print correctly. Use ONLY ASCII characters: letters, numbers, punctuation, basic symbols. Use - or * for bullets, [ ] for unchecked items, [x] for checked items. Keep formatting simple and printer-friendly.

IMPORTANT: Start your briefing response with exactly this marker on its own line: ---BRIEFING-START---`;

/**
 * Unique marker that must be included in the actual recap content
 * Used to distinguish the recap from intro messages
 */
export const RECAP_CONTENT_MARKER = '---RECAP-START---';

/**
 * Generates a recap request message
 * Uses getRecapData tool for efficient single-call data retrieval
 */
export function getRecapRequestMessage(): string {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];

  return `Generate an INSIGHTFUL daily recap with SPECIFIC completed tasks. Today is ${dateStr}. Call the getRecapData tool to get all recap data in one call. This returns:
- completedToday: Todos completed today with timestamps
- activeTimeTracking: Currently tracked work (work in progress)
- upcomingNextActions: Next actions for tomorrow preview

Create a recap that includes: ACTUAL TITLES grouped by context (work/personal), clean titles like "[x] Fixed authentication bug" or "[x] Completed project proposal" - DO NOT include IDs or technical identifiers in the display. Show 5-7 specific accomplishments if available. For time-tracked items, show duration if meaningful (e.g., "[x] Project X (2h 30m)"). Highlight productivity patterns and celebrate wins with encouraging tone. End with brief motivational outlook mentioning 2-3 SPECIFIC next actions for tomorrow. Make it mobile-friendly with clear, readable accomplishments.

FORMATTING RULES FOR THERMAL PRINTER: NO EMOJIS ANYWHERE - they will not print correctly. Use ONLY ASCII characters: letters, numbers, punctuation, basic symbols. Use - or * for bullets, [x] for completed items. Keep formatting simple and printer-friendly.

IMPORTANT: Start your recap response with exactly this marker on its own line: ---RECAP-START---`;
}

/**
 * @deprecated Use getRecapRequestMessage() instead for dynamic date injection
 */
export const DAILY_RECAP_REQUEST_MESSAGE = getRecapRequestMessage();
