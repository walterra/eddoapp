import { describe, expect, it, vi } from 'vitest';

import {
  categorizeToolsByCapability,
  extractServerName,
  useEnhancedMCP,
} from './enhanced-client.js';

describe('Enhanced MCP Client', () => {
  describe('categorizeToolsByCapability', () => {
    it('should categorize tools correctly', () => {
      const mockTools = [
        { name: 'eddo_todo_listTodos', description: 'List all todos' },
        { name: 'eddo_todo_createTodo', description: 'Create a new todo' },
        { name: 'eddo_timer_startTimer', description: 'Start time tracking' },
        { name: 'eddo_timer_stopTimer', description: 'Stop time tracking' },
        {
          name: 'eddo_analysis_generateReport',
          description: 'Generate analysis report',
        },
      ];

      const categories = categorizeToolsByCapability(mockTools);

      expect(categories.todo_management).toHaveLength(2);
      expect(categories.time_tracking).toHaveLength(2);
      expect(categories.analysis).toHaveLength(1);
      expect(categories.calendar).toHaveLength(0);
    });
  });

  describe('useEnhancedMCP', () => {
    it('should return false by default', () => {
      expect(useEnhancedMCP()).toBe(false);
    });

    it('should return true when environment variable is set', () => {
      const originalEnv = process.env.USE_ENHANCED_MCP;
      process.env.USE_ENHANCED_MCP = 'true';

      expect(useEnhancedMCP()).toBe(true);

      // Restore original environment
      if (originalEnv !== undefined) {
        process.env.USE_ENHANCED_MCP = originalEnv;
      } else {
        delete process.env.USE_ENHANCED_MCP;
      }
    });
  });

  describe('extractServerName', () => {
    it('should extract server name from prefixed tool names', () => {
      expect(extractServerName('eddo_todo_listTodos')).toBe('todo');
      expect(extractServerName('eddo_calendar_getEvents')).toBe('calendar');
      expect(extractServerName('simple_tool')).toBe('tool');
      expect(extractServerName('unprefixed')).toBe('unknown');
    });
  });
});
