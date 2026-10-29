/** Describes Eddo's GTD conventions independently of its HTTP transport. */
export const SERVER_INSTRUCTIONS = `Eddo Todo MCP Server with user registry authentication and GTD tag awareness. Pass Authorization: Bearer <api-key> or X-API-Key header for user-specific database access. Each user gets an isolated database.

GTD SYSTEM:
- TAGS: gtd:next, gtd:project, gtd:waiting, gtd:someday, gtd:calendar (for actionability/type)
- CONTEXT: work, private, errands, etc. (for location/situation)
- DUE FIELD: For gtd:calendar = exact appointment time, for others = deadline/target

When creating todos, add appropriate GTD tags AND set proper context:
- tags: ["gtd:next"] + context: "work" for work actionable items
- tags: ["gtd:project"] + context: "private" for personal projects
- tags: ["gtd:waiting"] + context: "work" for work dependencies
- tags: ["gtd:calendar"] + context: "work" for appointments/meetings

APPOINTMENT CREATION RULE: For gtd:calendar items, ALWAYS prefix title with time in HH:MM format:
- "Doctor appointment at 3pm" → title: "15:00 Doctor appointment"
- "Meeting tomorrow at 10:30" → title: "10:30 Meeting"

For GTD queries like "what's next?", filter by gtd:next tags and optionally by context.`;
