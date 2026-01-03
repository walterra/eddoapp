/**
 * Briefing and Recap Data Integration Tests
 * Tests getBriefingData and getRecapData aggregation tools
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createTestTodoData, testDates } from '../__fixtures__/todo-factory.js';
import type { MCPResponse, TodoAlpha3 } from '../helpers/mcp-assertions.js';
import { createMCPAssertions } from '../helpers/mcp-assertions.js';
import { MCPTestServer } from '../setup/test-server.js';

/** Briefing data structure returned by getBriefingData */
interface BriefingData {
  todaysTodos: TodoAlpha3[];
  overdueTodos: TodoAlpha3[];
  nextActions: TodoAlpha3[];
  waitingFor: TodoAlpha3[];
  calendarToday: TodoAlpha3[];
  activeTimeTracking: Array<TodoAlpha3 & { activeSessionCount: number }>;
  metadata: {
    date: string;
    dateStart: string;
    dateEnd: string;
    counts: {
      todaysTodos: number;
      overdueTodos: number;
      nextActions: number;
      waitingFor: number;
      calendarToday: number;
      activeTimeTracking: number;
    };
  };
}

/** Recap data structure returned by getRecapData */
interface RecapData {
  completedToday: TodoAlpha3[];
  activeTimeTracking: Array<TodoAlpha3 & { activeSessionCount: number }>;
  upcomingNextActions: TodoAlpha3[];
  metadata: {
    date: string;
    dateStart: string;
    dateEnd: string;
    counts: {
      completedToday: number;
      activeTimeTracking: number;
      upcomingNextActions: number;
    };
  };
}

/** MCP response wrapper for briefing/recap data */
interface MCPDataResponse<T> {
  summary: string;
  data: T;
  metadata: {
    execution_time: string;
    operation: string;
    timestamp: string;
  };
}

describe('Briefing and Recap Data Integration', () => {
  let testServer: MCPTestServer;
  let assert: ReturnType<typeof createMCPAssertions>;

  beforeEach(async () => {
    testServer = new MCPTestServer();
    await testServer.waitForServer();
    assert = createMCPAssertions(testServer);
    await testServer.resetTestData();
  });

  afterEach(async () => {
    await testServer.stop();
  });

  describe('getBriefingData', () => {
    it('should return empty briefing data when no todos exist', async () => {
      const response = await assert.expectToolCallSuccess<MCPDataResponse<BriefingData>>(
        'getBriefingData',
        {},
      );
      const result = response.data;

      expect(result).toBeDefined();
      expect(result.todaysTodos).toEqual([]);
      expect(result.overdueTodos).toEqual([]);
      expect(result.nextActions).toEqual([]);
      expect(result.waitingFor).toEqual([]);
      expect(result.calendarToday).toEqual([]);
      expect(result.activeTimeTracking).toEqual([]);
      expect(result.metadata.counts.todaysTodos).toBe(0);
      expect(result.metadata.counts.overdueTodos).toBe(0);
      expect(result.metadata.counts.nextActions).toBe(0);
      expect(result.metadata.counts.waitingFor).toBe(0);
      expect(result.metadata.counts.calendarToday).toBe(0);
      expect(result.metadata.counts.activeTimeTracking).toBe(0);
    });

    it('should include todos due today in todaysTodos', async () => {
      await assert.expectToolCallSuccess('createTodo', {
        ...createTestTodoData.basic(),
        title: 'Today Task',
        due: testDates.today(),
      });

      const response = await assert.expectToolCallSuccess<MCPDataResponse<BriefingData>>(
        'getBriefingData',
        {},
      );
      const result = response.data;

      expect(result.todaysTodos.length).toBe(1);
      expect(result.todaysTodos[0].title).toBe('Today Task');
      expect(result.metadata.counts.todaysTodos).toBe(1);
    });

    it('should include overdue todos in overdueTodos', async () => {
      await assert.expectToolCallSuccess('createTodo', {
        ...createTestTodoData.basic(),
        title: 'Overdue Task',
        due: testDates.yesterday(),
      });

      const response = await assert.expectToolCallSuccess<MCPDataResponse<BriefingData>>(
        'getBriefingData',
        {},
      );
      const result = response.data;

      expect(result.overdueTodos.length).toBe(1);
      expect(result.overdueTodos[0].title).toBe('Overdue Task');
      expect(result.metadata.counts.overdueTodos).toBe(1);
    });

    it('should include gtd:next tagged todos in nextActions', async () => {
      await assert.expectToolCallSuccess('createTodo', {
        ...createTestTodoData.basic(),
        title: 'Next Action',
        tags: ['gtd:next'],
      });

      const response = await assert.expectToolCallSuccess<MCPDataResponse<BriefingData>>(
        'getBriefingData',
        {},
      );
      const result = response.data;

      expect(result.nextActions.length).toBe(1);
      expect(result.nextActions[0].title).toBe('Next Action');
      expect(result.nextActions[0].tags).toContain('gtd:next');
      expect(result.metadata.counts.nextActions).toBe(1);
    });

    it('should include gtd:waiting tagged todos in waitingFor', async () => {
      await assert.expectToolCallSuccess('createTodo', {
        ...createTestTodoData.basic(),
        title: 'Waiting For Item',
        tags: ['gtd:waiting'],
      });

      const response = await assert.expectToolCallSuccess<MCPDataResponse<BriefingData>>(
        'getBriefingData',
        {},
      );
      const result = response.data;

      expect(result.waitingFor.length).toBe(1);
      expect(result.waitingFor[0].title).toBe('Waiting For Item');
      expect(result.waitingFor[0].tags).toContain('gtd:waiting');
      expect(result.metadata.counts.waitingFor).toBe(1);
    });

    it('should include gtd:calendar todos due today in calendarToday', async () => {
      await assert.expectToolCallSuccess('createTodo', {
        ...createTestTodoData.basic(),
        title: '10:00 Team Meeting',
        tags: ['gtd:calendar'],
        due: testDates.today(),
      });

      const response = await assert.expectToolCallSuccess<MCPDataResponse<BriefingData>>(
        'getBriefingData',
        {},
      );
      const result = response.data;

      expect(result.calendarToday.length).toBe(1);
      expect(result.calendarToday[0].title).toBe('10:00 Team Meeting');
      expect(result.calendarToday[0].tags).toContain('gtd:calendar');
      expect(result.metadata.counts.calendarToday).toBe(1);
    });

    it('should not include completed todos in any category', async () => {
      // Create and complete a todo
      const todoResponse = await assert.expectToolCallSuccess<MCPResponse>('createTodo', {
        ...createTestTodoData.basic(),
        title: 'Completed Task',
        due: testDates.today(),
        tags: ['gtd:next'],
      });

      await assert.expectToolCallSuccess('toggleTodoCompletion', {
        id: todoResponse.data!.id!,
        completed: true,
      });

      const response = await assert.expectToolCallSuccess<MCPDataResponse<BriefingData>>(
        'getBriefingData',
        {},
      );
      const result = response.data;

      expect(result.todaysTodos.length).toBe(0);
      expect(result.nextActions.length).toBe(0);
    });

    it('should include active time tracking entries', async () => {
      // Create a todo and start time tracking
      const todoResponse = await assert.expectToolCallSuccess<MCPResponse>('createTodo', {
        ...createTestTodoData.basic(),
        title: 'Time Tracked Task',
      });

      await assert.expectToolCallSuccess('startTimeTracking', {
        id: todoResponse.data!.id!,
      });

      const response = await assert.expectToolCallSuccess<MCPDataResponse<BriefingData>>(
        'getBriefingData',
        {},
      );
      const result = response.data;

      expect(result.activeTimeTracking.length).toBe(1);
      expect(result.activeTimeTracking[0].title).toBe('Time Tracked Task');
      expect(result.activeTimeTracking[0].activeSessionCount).toBe(1);
      expect(result.metadata.counts.activeTimeTracking).toBe(1);
    });

    it('should aggregate all data types correctly', async () => {
      // Create a variety of todos with explicit future due dates to avoid overdue classification
      const tomorrow = testDates.tomorrow();

      await assert.expectToolCallSuccess('createTodo', {
        ...createTestTodoData.basic(),
        title: 'Today Task',
        due: testDates.today(),
      });

      await assert.expectToolCallSuccess('createTodo', {
        ...createTestTodoData.basic(),
        title: 'Overdue Task',
        due: testDates.yesterday(),
      });

      await assert.expectToolCallSuccess('createTodo', {
        ...createTestTodoData.basic(),
        title: 'Next Action',
        tags: ['gtd:next'],
        due: tomorrow, // Explicit future date so it's not overdue
      });

      await assert.expectToolCallSuccess('createTodo', {
        ...createTestTodoData.basic(),
        title: 'Waiting For',
        tags: ['gtd:waiting'],
        due: tomorrow, // Explicit future date so it's not overdue
      });

      const response = await assert.expectToolCallSuccess<MCPDataResponse<BriefingData>>(
        'getBriefingData',
        {},
      );
      const result = response.data;

      expect(result.todaysTodos.length).toBe(1);
      expect(result.overdueTodos.length).toBe(1);
      expect(result.nextActions.length).toBe(1);
      expect(result.waitingFor.length).toBe(1);

      // Verify metadata counts match
      expect(result.metadata.counts.todaysTodos).toBe(result.todaysTodos.length);
      expect(result.metadata.counts.overdueTodos).toBe(result.overdueTodos.length);
      expect(result.metadata.counts.nextActions).toBe(result.nextActions.length);
      expect(result.metadata.counts.waitingFor).toBe(result.waitingFor.length);
    });

    it('should include metadata with correct date information', async () => {
      const response = await assert.expectToolCallSuccess<MCPDataResponse<BriefingData>>(
        'getBriefingData',
        {},
      );
      const result = response.data;

      expect(result.metadata).toBeDefined();
      expect(result.metadata.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result.metadata.dateStart).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(result.metadata.dateEnd).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('getRecapData', () => {
    it('should return empty recap data when no todos exist', async () => {
      const response = await assert.expectToolCallSuccess<MCPDataResponse<RecapData>>(
        'getRecapData',
        {},
      );
      const result = response.data;

      expect(result).toBeDefined();
      expect(result.completedToday).toEqual([]);
      expect(result.activeTimeTracking).toEqual([]);
      expect(result.upcomingNextActions).toEqual([]);
      expect(result.metadata.counts.completedToday).toBe(0);
      expect(result.metadata.counts.activeTimeTracking).toBe(0);
      expect(result.metadata.counts.upcomingNextActions).toBe(0);
    });

    it('should include todos completed today in completedToday', async () => {
      // Create and complete a todo
      const todoResponse = await assert.expectToolCallSuccess<MCPResponse>('createTodo', {
        ...createTestTodoData.basic(),
        title: 'Completed Today',
      });

      await assert.expectToolCallSuccess('toggleTodoCompletion', {
        id: todoResponse.data!.id!,
        completed: true,
      });

      const response = await assert.expectToolCallSuccess<MCPDataResponse<RecapData>>(
        'getRecapData',
        {},
      );
      const result = response.data;

      expect(result.completedToday.length).toBe(1);
      expect(result.completedToday[0].title).toBe('Completed Today');
      expect(result.metadata.counts.completedToday).toBe(1);
    });

    it('should include gtd:next tagged incomplete todos in upcomingNextActions', async () => {
      await assert.expectToolCallSuccess('createTodo', {
        ...createTestTodoData.basic(),
        title: 'Next Action for Tomorrow',
        tags: ['gtd:next'],
      });

      const response = await assert.expectToolCallSuccess<MCPDataResponse<RecapData>>(
        'getRecapData',
        {},
      );
      const result = response.data;

      expect(result.upcomingNextActions.length).toBe(1);
      expect(result.upcomingNextActions[0].title).toBe('Next Action for Tomorrow');
      expect(result.metadata.counts.upcomingNextActions).toBe(1);
    });

    it('should include active time tracking entries', async () => {
      // Create a todo and start time tracking
      const todoResponse = await assert.expectToolCallSuccess<MCPResponse>('createTodo', {
        ...createTestTodoData.basic(),
        title: 'Work In Progress',
      });

      await assert.expectToolCallSuccess('startTimeTracking', {
        id: todoResponse.data!.id!,
      });

      const response = await assert.expectToolCallSuccess<MCPDataResponse<RecapData>>(
        'getRecapData',
        {},
      );
      const result = response.data;

      expect(result.activeTimeTracking.length).toBe(1);
      expect(result.activeTimeTracking[0].title).toBe('Work In Progress');
      expect(result.activeTimeTracking[0].activeSessionCount).toBe(1);
      expect(result.metadata.counts.activeTimeTracking).toBe(1);
    });

    it('should include metadata with correct date information', async () => {
      const response = await assert.expectToolCallSuccess<MCPDataResponse<RecapData>>(
        'getRecapData',
        {},
      );
      const result = response.data;

      expect(result.metadata).toBeDefined();
      expect(result.metadata.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result.metadata.dateStart).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(result.metadata.dateEnd).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should not include completed next actions in upcomingNextActions', async () => {
      // Create and complete a gtd:next todo
      const todoResponse = await assert.expectToolCallSuccess<MCPResponse>('createTodo', {
        ...createTestTodoData.basic(),
        title: 'Completed Next Action',
        tags: ['gtd:next'],
      });

      await assert.expectToolCallSuccess('toggleTodoCompletion', {
        id: todoResponse.data!.id!,
        completed: true,
      });

      const response = await assert.expectToolCallSuccess<MCPDataResponse<RecapData>>(
        'getRecapData',
        {},
      );
      const result = response.data;

      // It should appear in completedToday but not upcomingNextActions
      expect(result.completedToday.length).toBe(1);
      expect(result.upcomingNextActions.length).toBe(0);
    });
  });

  describe('Performance', () => {
    it('should handle multiple todos efficiently', async () => {
      // Create many todos of different types
      const batchSize = 20;

      // Create today's todos
      for (let i = 0; i < batchSize; i++) {
        await assert.expectToolCallSuccess('createTodo', {
          ...createTestTodoData.basic(),
          title: `Today ${i}`,
          due: testDates.today(),
        });
      }

      // Create next actions
      for (let i = 0; i < batchSize; i++) {
        await assert.expectToolCallSuccess('createTodo', {
          ...createTestTodoData.basic(),
          title: `Next Action ${i}`,
          tags: ['gtd:next'],
        });
      }

      const startTime = Date.now();
      const response = await assert.expectToolCallSuccess<MCPDataResponse<BriefingData>>(
        'getBriefingData',
        {},
      );
      const result = response.data;
      const duration = Date.now() - startTime;

      // Should complete in reasonable time (< 5 seconds)
      expect(duration).toBeLessThan(5000);

      // Verify data was retrieved
      expect(result.todaysTodos.length).toBe(batchSize);
      expect(result.nextActions.length).toBe(batchSize);
    });
  });
});
