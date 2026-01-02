/**
 * Mock data templates for Starfleet officer todos
 */

export type StarfleetContext =
  | 'bridge'
  | 'engineering'
  | 'away-team'
  | 'personal'
  | 'starfleet'
  | 'science'
  | 'diplomatic'
  | 'training';

export interface TodoTemplate {
  title: string;
  context: StarfleetContext;
  due: string;
}

/**
 * Helper to create dates relative to week start
 */
export function getDate(weekStart: Date, daysFromStart: number, hours = 9, minutes = 0): string {
  const date = new Date(weekStart);
  date.setDate(weekStart.getDate() + daysFromStart);
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
}

/**
 * GitHub issue mapping for synced todos
 */
export const GITHUB_ISSUES: Record<string, string> = {
  'Fix transporter buffer overflow': 'github:starfleet/enterprise/issues/1701',
  'Update tricorder firmware': 'github:starfleet/equipment/issues/4742',
  'Investigate replicator malfunction': 'github:starfleet/operations/issues/2063',
};

type DateGetter = (days: number, h?: number, m?: number) => string;

const getWeekdayTemplates = (gd: DateGetter): TodoTemplate[] => [
  { title: 'Review weekly mission objectives', context: 'bridge', due: gd(0, 8, 0) },
  { title: 'Conduct senior staff briefing', context: 'bridge', due: gd(0, 9, 0) },
  { title: 'Analyze long-range sensor data', context: 'science', due: gd(0, 14, 0) },
  { title: 'Submit crew performance evaluations', context: 'starfleet', due: gd(0, 16, 0) },
  {
    title: 'Review diplomatic protocols for Risa conference',
    context: 'diplomatic',
    due: gd(0, 19, 0),
  },
  { title: 'Inspect warp core containment field', context: 'engineering', due: gd(1, 10, 0) },
  { title: 'Calibrate deflector array sensors', context: 'engineering', due: gd(1, 14, 30) },
  { title: 'Approve engineering staff rotation schedule', context: 'starfleet', due: gd(1, 11, 0) },
  { title: 'Review quantum mechanics research proposal', context: 'science', due: gd(1, 15, 0) },
  { title: 'Practice Vulcan meditation techniques', context: 'personal', due: gd(1, 20, 0) },
  { title: 'Prepare away team equipment manifest', context: 'away-team', due: gd(2, 9, 30) },
  { title: 'Briefing on Class M planet survey protocols', context: 'away-team', due: gd(2, 11, 0) },
  { title: 'Review xenobiology database for mission', context: 'science', due: gd(2, 13, 0) },
  { title: 'Test universal translator updates', context: 'away-team', due: gd(2, 15, 30) },
  { title: 'Send subspace message to Admiral Paris', context: 'starfleet', due: gd(2, 17, 0) },
  { title: 'Conduct phaser training simulation', context: 'training', due: gd(3, 10, 0) },
  { title: 'Review Starfleet Academy curriculum updates', context: 'training', due: gd(3, 14, 0) },
  { title: 'Mentor junior officer career development', context: 'training', due: gd(3, 16, 0) },
  { title: 'Complete temporal mechanics certification', context: 'training', due: gd(3, 19, 0) },
  { title: 'Call parents on Earth', context: 'personal', due: gd(3, 21, 0) },
  { title: 'First contact protocols workshop', context: 'diplomatic', due: gd(4, 9, 0) },
  { title: 'Analyze subspace anomaly readings', context: 'science', due: gd(4, 11, 30) },
  { title: 'Prepare report for Starfleet Command', context: 'starfleet', due: gd(4, 15, 0) },
  { title: 'Review trade negotiations with Ferengi', context: 'diplomatic', due: gd(4, 17, 30) },
];

const getWeekendAndExtraTemplates = (gd: DateGetter): TodoTemplate[] => [
  { title: 'Holodeck recreation program updates', context: 'personal', due: gd(5, 10, 0) },
  { title: 'Monthly system diagnostics review', context: 'engineering', due: gd(5, 14, 0) },
  { title: 'Read "Advanced Warp Theory" by Dr. Brahms', context: 'personal', due: gd(6, 16, 0) },
  { title: 'Chess match with Data in Ten Forward', context: 'personal', due: gd(6, 19, 0) },
  { title: 'Weekly replicator maintenance check', context: 'engineering', due: gd(-2, 10, 0) },
  { title: 'Update personal log entries', context: 'personal', due: gd(1, 22, 0) },
  { title: 'Review bridge officer duty roster', context: 'bridge', due: gd(2, 8, 0) },
  { title: 'Coordinate with Engineering on shield upgrades', context: 'bridge', due: gd(4, 13, 0) },
  { title: 'Develop new first contact procedures', context: 'diplomatic', due: gd(14, 12, 0) },
  { title: 'Write paper on quantum field fluctuations', context: 'science', due: gd(21, 15, 0) },
  { title: 'Fix transporter buffer overflow', context: 'engineering', due: gd(1, 16, 0) },
  { title: 'Update tricorder firmware', context: 'engineering', due: gd(3, 14, 30) },
  { title: 'Investigate replicator malfunction', context: 'engineering', due: gd(5, 11, 0) },
];

/** Generate todo templates for a week */
export function generateTodoTemplates(weekStart: Date): TodoTemplate[] {
  const gd: DateGetter = (days, h = 9, m = 0) => getDate(weekStart, days, h, m);
  return [...getWeekdayTemplates(gd), ...getWeekendAndExtraTemplates(gd)];
}

/**
 * Generate appropriate tags based on todo content and context
 */
export function generateTagsForTodo(todo: TodoTemplate): string[] {
  const tags: string[] = [];
  const title = todo.title.toLowerCase();

  // Context-based tags
  const contextTags: Record<StarfleetContext, string[]> = {
    bridge: ['command', 'duty-shift'],
    engineering: ['technical', 'maintenance'],
    'away-team': ['exploration', 'fieldwork'],
    science: ['research', 'analysis'],
    diplomatic: ['negotiations', 'protocol'],
    training: ['education', 'development'],
    starfleet: ['administration', 'paperwork'],
    personal: ['self-care', 'recreation'],
  };

  tags.push(...contextTags[todo.context]);

  // Content-based tags
  if (title.includes('report')) tags.push('documentation');
  if (title.includes('briefing') || title.includes('meeting')) tags.push('meeting');
  if (title.includes('review')) tags.push('review');
  if (title.includes('training') || title.includes('practice')) tags.push('skill-building');
  if (title.includes('contact') || title.includes('call')) tags.push('communication');

  // Priority tags based on context importance
  if (['bridge', 'away-team', 'diplomatic'].includes(todo.context)) {
    tags.push('high-priority');
  }

  return tags;
}
