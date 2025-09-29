/**
 * Constants for daily briefing functionality
 */

export const DAILY_BRIEFING_REQUEST_MESSAGE =
  'Generate a daily briefing for me. Please call these tools: 1) listTodos for today, 2) listTodos for overdue items, 3) listTodos with tags gtd:next, 4) listTodos with tags gtd:waiting, 5) getActiveTimeTracking for active time tracking. Then create a comprehensive briefing. For overdue items, consider the day of the week and prioritize accordingly, for example Mo-Fr prioritize work tasks, Sa-Su prioritize personal tasks. Keep the briefing concise and to the point.';
