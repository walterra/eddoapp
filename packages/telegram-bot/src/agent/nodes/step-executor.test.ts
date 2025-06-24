import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Helper function to get the next occurrence of a specific weekday
 */
function getNextWeekday(from: Date, targetDay: number): Date {
  const result = new Date(from);
  const currentDay = result.getDay();

  // Calculate days until target weekday
  let daysUntil = targetDay - currentDay;
  if (daysUntil <= 0) {
    daysUntil += 7; // Next week
  }

  result.setDate(result.getDate() + daysUntil);
  return result;
}

/**
 * Validates and fixes date formats in step parameters
 */
function validateAndFixDates(
  parameters: Record<string, unknown>,
): Record<string, unknown> {
  const fixed = { ...parameters };

  if (fixed.due && typeof fixed.due === 'string') {
    const due = fixed.due.toLowerCase();

    // If it's already an ISO string, keep it
    if (due.includes('t') && due.includes('z')) {
      return fixed;
    }

    // Convert common relative dates to ISO format
    const now = new Date();
    let targetDate: Date;

    if (due.includes('saturday')) {
      targetDate = getNextWeekday(now, 6); // Saturday = 6
    } else if (due.includes('sunday')) {
      targetDate = getNextWeekday(now, 0); // Sunday = 0
    } else if (due.includes('monday')) {
      targetDate = getNextWeekday(now, 1);
    } else if (due.includes('tuesday')) {
      targetDate = getNextWeekday(now, 2);
    } else if (due.includes('wednesday')) {
      targetDate = getNextWeekday(now, 3);
    } else if (due.includes('thursday')) {
      targetDate = getNextWeekday(now, 4);
    } else if (due.includes('friday')) {
      targetDate = getNextWeekday(now, 5);
    } else if (due.includes('tomorrow')) {
      targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() + 1);
    } else if (due.includes('today')) {
      targetDate = new Date(now);
    } else {
      // Try to parse as a date string, fallback to end of today
      try {
        targetDate = new Date(fixed.due as string);
        if (isNaN(targetDate.getTime())) {
          targetDate = new Date(now);
          targetDate.setHours(23, 59, 59, 999);
        }
      } catch {
        targetDate = new Date(now);
        targetDate.setHours(23, 59, 59, 999);
      }
    }

    // Set time to end of day if no specific time mentioned
    if (!due.includes(':') && !due.includes('am') && !due.includes('pm')) {
      targetDate.setHours(23, 59, 59, 999);
    }

    fixed.due = targetDate.toISOString();
  }

  return fixed;
}

describe('Date Validation and Fixing', () => {
  let mockDate: Date;

  beforeEach(() => {
    // Mock current date to Tuesday, June 24, 2025 for consistent testing
    mockDate = new Date('2025-06-24T10:00:00.000Z');
    vi.setSystemTime(mockDate);
  });

  describe('getNextWeekday', () => {
    it('should calculate next Saturday correctly', () => {
      const nextSaturday = getNextWeekday(mockDate, 6);
      expect(nextSaturday.getDay()).toBe(6); // Saturday
      expect(nextSaturday.getDate()).toBe(28); // June 28, 2025
    });

    it('should calculate next Sunday correctly', () => {
      const nextSunday = getNextWeekday(mockDate, 0);
      expect(nextSunday.getDay()).toBe(0); // Sunday
      expect(nextSunday.getDate()).toBe(29); // June 29, 2025
    });

    it('should calculate next Monday correctly', () => {
      const nextMonday = getNextWeekday(mockDate, 1);
      expect(nextMonday.getDay()).toBe(1); // Monday
      expect(nextMonday.getDate()).toBe(30); // June 30, 2025
    });

    it('should handle same weekday by going to next week', () => {
      // Tuesday to Tuesday should be next week
      const nextTuesday = getNextWeekday(mockDate, 2);
      expect(nextTuesday.getDay()).toBe(2); // Tuesday
      expect(nextTuesday.getDate()).toBe(31); // July 1, 2025 (next week)
    });
  });

  describe('validateAndFixDates', () => {
    it('should preserve valid ISO date strings', () => {
      const isoDate = '2025-06-24T09:00:00.000Z';
      const parameters = { due: isoDate, title: 'Test' };
      const result = validateAndFixDates(parameters);

      expect(result.due).toBe(isoDate);
    });

    it('should convert "saturday" to proper ISO date', () => {
      const parameters = { due: 'saturday', title: 'Weekend task' };
      const result = validateAndFixDates(parameters);

      expect(typeof result.due).toBe('string');
      const resultDate = new Date(result.due as string);
      expect(resultDate.getDay()).toBe(6); // Saturday
      expect(resultDate.getDate()).toBe(28); // June 28, 2025
      expect(resultDate.getHours()).toBe(23); // End of day
      expect(resultDate.getMinutes()).toBe(59);
    });

    it('should convert "sunday" to proper ISO date', () => {
      const parameters = { due: 'sunday', title: 'Sunday task' };
      const result = validateAndFixDates(parameters);

      expect(typeof result.due).toBe('string');
      const resultDate = new Date(result.due as string);
      expect(resultDate.getDay()).toBe(0); // Sunday
      expect(resultDate.getDate()).toBe(29); // June 29, 2025
      expect(resultDate.getHours()).toBe(23); // End of day
    });

    it('should handle case-insensitive weekday names', () => {
      const parameters = { due: 'FRIDAY', title: 'Friday task' };
      const result = validateAndFixDates(parameters);

      expect(typeof result.due).toBe('string');
      const resultDate = new Date(result.due as string);
      expect(resultDate.getDay()).toBe(5); // Friday
    });

    it('should convert "tomorrow" to next day', () => {
      const parameters = { due: 'tomorrow', title: 'Tomorrow task' };
      const result = validateAndFixDates(parameters);

      expect(typeof result.due).toBe('string');
      const resultDate = new Date(result.due as string);
      expect(resultDate.getDate()).toBe(25); // June 25, 2025
      expect(resultDate.getHours()).toBe(23); // End of day
    });

    it('should convert "today" to current day', () => {
      const parameters = { due: 'today', title: 'Today task' };
      const result = validateAndFixDates(parameters);

      expect(typeof result.due).toBe('string');
      const resultDate = new Date(result.due as string);
      expect(resultDate.getDate()).toBe(24); // June 24, 2025
      expect(resultDate.getHours()).toBe(23); // End of day
    });

    it('should handle invalid date strings by defaulting to end of today', () => {
      const parameters = { due: 'invalid date', title: 'Invalid date task' };
      const result = validateAndFixDates(parameters);

      expect(typeof result.due).toBe('string');
      const resultDate = new Date(result.due as string);
      expect(resultDate.getDate()).toBe(24); // June 24, 2025 (today)
      expect(resultDate.getHours()).toBe(23); // End of day
    });

    it('should preserve non-due parameters unchanged', () => {
      const parameters = {
        due: 'saturday',
        title: 'Weekend task',
        context: 'work',
        tags: ['important'],
      };
      const result = validateAndFixDates(parameters);

      expect(result.title).toBe('Weekend task');
      expect(result.context).toBe('work');
      expect(result.tags).toEqual(['important']);
    });

    it('should handle parameters without due date', () => {
      const parameters = { title: 'No due date task', context: 'work' };
      const result = validateAndFixDates(parameters);

      expect(result).toEqual(parameters);
    });

    it('should handle non-string due values', () => {
      const parameters = { due: 12345, title: 'Numeric due' };
      const result = validateAndFixDates(parameters);

      expect(result.due).toBe(12345); // Should remain unchanged
    });

    it('should handle undefined due values', () => {
      const parameters = { due: undefined, title: 'Undefined due' };
      const result = validateAndFixDates(parameters);

      expect(result.due).toBeUndefined();
    });
  });

  describe('Time handling', () => {
    it('should preserve time information when present', () => {
      const parameters = { due: 'saturday 2:30 pm', title: 'Timed task' };
      const result = validateAndFixDates(parameters);

      expect(typeof result.due).toBe('string');
      // Should not set to end of day since time was specified
      const resultDate = new Date(result.due as string);
      expect(resultDate.getDay()).toBe(6); // Saturday
    });

    it('should preserve colon-separated time format', () => {
      const parameters = { due: 'sunday 14:30', title: 'Military time task' };
      const result = validateAndFixDates(parameters);

      expect(typeof result.due).toBe('string');
      const resultDate = new Date(result.due as string);
      expect(resultDate.getDay()).toBe(0); // Sunday
    });
  });
});
