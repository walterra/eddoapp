/**
 * Test data factories for creating consistent test todos
 */

export interface TestTodoData extends Record<string, unknown> {
  title: string;
  context: string;
  due: string;
  description?: string;
  link?: string;
  repeat?: number;
  tags?: string[];
}

/**
 * Converts a date string to full ISO timestamp with end-of-day time.
 * Due dates are normalized to T23:59:59.999Z format by the MCP server.
 */
function toEndOfDayTimestamp(dateStr: string): string {
  return `${dateStr}T23:59:59.999Z`;
}

export const createTestTodoData = {
  /**
   * Basic minimal todo with required fields only
   */
  basic: (): TestTodoData => ({
    title: 'Test Todo',
    context: 'work',
    due: toEndOfDayTimestamp('2025-06-30'),
  }),

  /**
   * Todo with all optional fields populated
   */
  complete: (): TestTodoData => ({
    title: 'Complete Test Todo',
    context: 'private',
    due: toEndOfDayTimestamp('2025-07-15'),
    description: 'Comprehensive test todo with all fields',
    link: 'https://example.com/test',
    repeat: 7,
    tags: ['test', 'integration', 'complete'],
  }),

  /**
   * Todo with time tracking context
   */
  withTimeTracking: (): TestTodoData => ({
    title: 'Time Tracking Todo',
    context: 'work',
    due: toEndOfDayTimestamp('2025-06-28'),
    description: 'Todo for testing time tracking functionality',
    tags: ['time-tracking', 'test'],
  }),

  /**
   * Todo that will be completed in tests
   */
  forCompletion: (): TestTodoData => ({
    title: 'Todo for Completion Test',
    context: 'personal',
    due: toEndOfDayTimestamp('2025-06-25'),
    description: 'This todo will be marked as completed',
    tags: ['completion', 'test'],
  }),

  /**
   * Repeating todo for testing repeat functionality
   */
  repeating: (): TestTodoData => ({
    title: 'Daily Repeating Todo',
    context: 'work',
    due: toEndOfDayTimestamp('2025-06-27'),
    description: 'Todo that repeats daily',
    repeat: 1,
    tags: ['repeat', 'daily'],
  }),

  /**
   * Todo with specific tags for analytics testing
   */
  withTags: (tags: string[]): TestTodoData => ({
    title: 'Tagged Todo',
    context: 'work',
    due: toEndOfDayTimestamp('2025-06-29'),
    description: 'Todo with custom tags for testing',
    tags,
  }),

  /**
   * Todo with specific context for filtering tests
   */
  withContext: (context: string): TestTodoData => ({
    title: `${context} Context Todo`,
    context,
    due: toEndOfDayTimestamp('2025-07-01'),
    description: `Todo in ${context} context`,
    tags: ['context-test'],
  }),

  /**
   * Todo with specific due date for date filtering tests
   */
  withDueDate: (dueDate: string): TestTodoData => ({
    title: 'Date-specific Todo',
    context: 'work',
    due: dueDate,
    description: 'Todo with specific due date for filtering',
    tags: ['date-test'],
  }),

  /**
   * Creates multiple todos for batch testing
   */
  batch: (count: number, baseTitle: string = 'Batch Test Todo'): TestTodoData[] => {
    return Array.from({ length: count }, (_, i) => ({
      title: `${baseTitle} ${i + 1}`,
      context: i % 2 === 0 ? 'work' : 'private',
      due: toEndOfDayTimestamp(
        new Date(Date.now() + (i + 1) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      ),
      description: `Batch test todo number ${i + 1}`,
      tags: ['batch', `item-${i + 1}`],
    }));
  },
};

/**
 * Test data for invalid inputs (error testing)
 */
export const invalidTestData = {
  missingTitle: {
    context: 'work',
    due: '2025-06-30',
  },

  missingContext: {
    title: 'Missing Context Todo',
    due: '2025-06-30',
  },

  missingDue: {
    title: 'Missing Due Date Todo',
    context: 'work',
  },

  invalidContext: {
    title: 'Invalid Context Todo',
    context: 'invalid-context',
    due: '2025-06-30',
  },

  invalidDate: {
    title: 'Invalid Date Todo',
    context: 'work',
    due: 'not-a-date',
  },

  invalidRepeat: {
    title: 'Invalid Repeat Todo',
    context: 'work',
    due: '2025-06-30',
    repeat: -1,
  },
};

/**
 * Generate unique IDs for test todos to avoid conflicts
 */
export function generateTestId(): string {
  return new Date().toISOString();
}

/**
 * Returns end-of-day ISO timestamp for a given date.
 * Due dates should use full ISO timestamps with end-of-day time
 * to ensure consistent comparison with query date ranges.
 */
function toEndOfDayIso(date: Date): string {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

/**
 * Helper to generate date strings for testing.
 * Returns full ISO timestamps (end-of-day) to match how due dates are stored.
 */
export const testDates = {
  today: () => toEndOfDayIso(new Date()),
  tomorrow: () => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return toEndOfDayIso(date);
  },
  nextWeek: () => {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return toEndOfDayIso(date);
  },
  yesterday: () => {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return toEndOfDayIso(date);
  },
  range: (startDaysFromNow: number, endDaysFromNow: number) => {
    const start = new Date();
    start.setDate(start.getDate() + startDaysFromNow);
    const end = new Date();
    end.setDate(end.getDate() + endDaysFromNow);
    return {
      start: toEndOfDayIso(start),
      end: toEndOfDayIso(end),
    };
  },
};
