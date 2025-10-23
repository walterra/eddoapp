/**
 * Constants for daily briefing and recap functionality
 */

/**
 * Unique marker that must be included in the actual briefing content
 * Used to distinguish the briefing from intro messages
 */
export const BRIEFING_CONTENT_MARKER = '---BRIEFING-START---';

export const DAILY_BRIEFING_REQUEST_MESSAGE =
  'Generate an ACTIONABLE daily briefing with SPECIFIC todo examples. Call these tools: 1) listTodos for today, 2) listTodos for overdue items, 3) listTodos with tags gtd:next, 4) listTodos with tags gtd:waiting, 5) listTodos with tags gtd:calendar for today\'s appointments, 6) getActiveTimeTracking for active time tracking. Then create a briefing that includes: ACTUAL TITLES of 3-5 specific todos I can work on right now, not just counts. For each section, show the top 2-3 SPECIFIC items with clean titles like "- Fix authentication bug" or "- Review project proposal" - DO NOT include IDs or technical identifiers in the display. For calendar appointments, show them with their time prefix (e.g., "- 15:00 Doctor appointment"). Prioritize work tasks Mon-Fri, personal tasks weekends. Make it mobile-friendly with clear, readable action items. FORMATTING RULES FOR THERMAL PRINTER: NO EMOJIS ANYWHERE - they will not print correctly. Use ONLY ASCII characters: letters, numbers, punctuation, basic symbols. Use - or * for bullets, [ ] for unchecked items, [x] for checked items. Keep formatting simple and printer-friendly. IMPORTANT: Start your briefing response with exactly this marker on its own line: ---BRIEFING-START---';

/**
 * Unique marker that must be included in the actual recap content
 * Used to distinguish the recap from intro messages
 */
export const RECAP_CONTENT_MARKER = '---RECAP-START---';

/**
 * Generates a recap request message with actual date values
 * Eliminates ambiguity by providing explicit ISO timestamps
 */
export function getRecapRequestMessage(): string {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  const dateStr = now.toISOString().split('T')[0];
  const startTime = todayStart.toISOString();
  const endTime = todayEnd.toISOString();

  return `You MUST send TWO separate messages:

**FIRST MESSAGE (NO MARKER):**
- Send ONLY a brief acknowledgment (under 10 words)
- Examples: "Generating your daily recap..." or "Let me check what you accomplished today..."
- DO NOT include the ---RECAP-START--- marker
- DO NOT include any recap content

**SECOND MESSAGE (WITH MARKER):**
- Start with EXACTLY this marker on its own line: ---RECAP-START---
- Then include the full recap content after the marker
- Today is ${dateStr}. Query for todos completed between ${startTime} and ${endTime}
- Call these tools: 1) listTodos with completedFrom=${startTime} and completedTo=${endTime}, 2) getActiveTimeTracking, 3) listTodos with tags gtd:next and completed false
- Generate an INSIGHTFUL daily recap with SPECIFIC completed tasks:
  • ACTUAL TITLES grouped by context (work/personal)
  • Clean titles like "[x] Fixed authentication bug" or "[x] Completed project proposal"
  • NO IDs or technical identifiers
  • Show 5-7 specific accomplishments if available
  • For time-tracked items, show duration if meaningful (e.g., "[x] Project X (2h 30m)")
  • Highlight productivity patterns and celebrate wins with encouraging tone
  • End with brief motivational outlook mentioning 2-3 SPECIFIC next actions for tomorrow
  • Make it mobile-friendly with clear, readable accomplishments

**FORMATTING RULES FOR THERMAL PRINTER:**
- NO EMOJIS ANYWHERE (no 🎯 ✅ 🔥 📅 ⏰ etc.) - they will not print correctly
- Use ONLY ASCII characters: letters, numbers, punctuation, basic symbols
- Section headers: Use plain text with # markdown (e.g., "## Accomplished Today:")
- Checkmarks: Use [x] for completed items
- Bullets: Use - or * for lists
- Keep formatting simple and printer-friendly

CRITICAL: The marker ---RECAP-START--- MUST be at the beginning of the SECOND message ONLY.`;
}

/**
 * @deprecated Use getRecapRequestMessage() instead for dynamic date injection
 */
export const DAILY_RECAP_REQUEST_MESSAGE = getRecapRequestMessage();
