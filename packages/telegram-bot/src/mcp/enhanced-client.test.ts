import type { Tool } from '@langchain/core/tools';
import { describe, expect, it, vi } from 'vitest';

import {
  categorizeToolsByCapability,
  extractServerName,
} from './enhanced-client.js';

describe('Enhanced MCP Client', () => {
  describe('categorizeToolsByCapability', () => {
    it('should categorize tools correctly', () => {
      const mockTools = [
        {
          name: 'eddo_todo_listTodos',
          description: 'List all todos',
          schema: {},
          call: vi.fn(),
        },
        {
          name: 'eddo_todo_createTodo',
          description: 'Create a new todo',
          schema: {},
          call: vi.fn(),
        },
        {
          name: 'eddo_timer_startTimer',
          description: 'Start time tracking',
          schema: {},
          call: vi.fn(),
        },
        {
          name: 'eddo_timer_stopTimer',
          description: 'Stop time tracking',
          schema: {},
          call: vi.fn(),
        },
        {
          name: 'eddo_analysis_generateReport',
          description: 'Generate analysis report',
          schema: {},
          call: vi.fn(),
        },
      ] as unknown as Tool[];

      const categories = categorizeToolsByCapability(mockTools);

      expect(categories.todo_management).toHaveLength(2);
      expect(categories.time_tracking).toHaveLength(2);
      expect(categories.analysis).toHaveLength(1);
      expect(categories.calendar).toHaveLength(0);
    });
  });

  // Feature flag test removed - enhanced MCP is now always enabled

  describe('extractServerName', () => {
    it('should extract server name from prefixed tool names', () => {
      expect(extractServerName('eddo_todo_listTodos')).toBe('todo');
      expect(extractServerName('eddo_calendar_getEvents')).toBe('calendar');
      expect(extractServerName('simple_tool')).toBe('tool');
      expect(extractServerName('unprefixed')).toBe('unknown');
    });
  });
});
