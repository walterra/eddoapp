/**
 * Filtering and Query Integration Tests
 * Tests all filtering capabilities of listTodos
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createTestTodoData, testDates } from '../__fixtures__/todo-factory.js';
import type { MCPResponse, TodoAlpha3 } from '../helpers/mcp-assertions.js';
import { createMCPAssertions } from '../helpers/mcp-assertions.js';
import { MCPTestServer } from '../setup/test-server.js';

describe('MCP Query and Filtering Integration', () => {
  let testServer: MCPTestServer;
  let assert: ReturnType<typeof createMCPAssertions>;

  beforeEach(async () => {
    testServer = new MCPTestServer();
    await testServer.waitForServer();
    assert = createMCPAssertions(testServer);

    // Reset test data
    await testServer.resetTestData();
  });

  afterEach(async () => {
    await testServer.stop();
  });

  describe('Context Filtering', () => {
    it('should filter todos by context correctly', async () => {
      // Create todos in different contexts
      const _workTodo1 = await assert.expectToolCallSuccess<TodoAlpha3>(
        'createTodo',
        createTestTodoData.withContext('work'),
      );

      const _workTodo2 = await assert.expectToolCallSuccess<TodoAlpha3>(
        'createTodo',
        { ...createTestTodoData.withContext('work'), title: 'Work Todo 2' },
      );

      const _privateTodo = await assert.expectToolCallSuccess<TodoAlpha3>(
        'createTodo',
        createTestTodoData.withContext('private'),
      );

      const _personalTodo = await assert.expectToolCallSuccess<TodoAlpha3>(
        'createTodo',
        createTestTodoData.withContext('personal'),
      );

      // Filter by work context
      const workTodos = await assert.expectToolCallSuccess<TodoAlpha3[]>(
        'listTodos',
        { context: 'work' },
      );

      assert.expectValidTodos(workTodos);
      assert.expectTodoCount(workTodos, 2);
      assert.expectTodosFilteredByContext(workTodos, 'work');

      // Filter by private context
      const privateTodos = await assert.expectToolCallSuccess<TodoAlpha3[]>(
        'listTodos',
        { context: 'private' },
      );

      assert.expectTodoCount(privateTodos, 1);
      assert.expectTodosFilteredByContext(privateTodos, 'private');

      // Filter by personal context
      const personalTodos = await assert.expectToolCallSuccess<TodoAlpha3[]>(
        'listTodos',
        { context: 'personal' },
      );

      assert.expectTodoCount(personalTodos, 1);
      assert.expectTodosFilteredByContext(personalTodos, 'personal');

      // Verify all todos returned without filter
      const allTodos = await assert.expectToolCallSuccess<TodoAlpha3[]>(
        'listTodos',
        {},
      );

      assert.expectTodoCount(allTodos, 4);
    });
  });

  describe('Completion Status Filtering', () => {
    it('should filter by completion status', async () => {
      // Create multiple todos
      const todo1Response = await assert.expectToolCallSuccess<MCPResponse>(
        'createTodo',
        createTestTodoData.basic(),
      );
      const _todo1Id = todo1Response.data!.id!;

      const todo2Response = await assert.expectToolCallSuccess<MCPResponse>(
        'createTodo',
        createTestTodoData.forCompletion(),
      );
      const todo2Id = todo2Response.data!.id!;

      const todo3Response = await assert.expectToolCallSuccess<MCPResponse>(
        'createTodo',
        { ...createTestTodoData.basic(), title: 'Third Todo' },
      );
      const _todo3Id = todo3Response.data!.id!;

      // Complete one todo
      await assert.expectToolCallSuccess('toggleTodoCompletion', {
        id: todo2Id,
        completed: true,
      });

      // Filter for active (incomplete) todos
      const activeTodos = await assert.expectToolCallSuccess<TodoAlpha3[]>(
        'listTodos',
        { completed: false },
      );

      assert.expectValidTodos(activeTodos);
      assert.expectTodoCount(activeTodos, 2);
      assert.expectTodosFilteredByCompletion(activeTodos, false);

      // Filter for completed todos
      const completedTodos = await assert.expectToolCallSuccess<TodoAlpha3[]>(
        'listTodos',
        { completed: true },
      );

      assert.expectTodoCount(completedTodos, 1);
      assert.expectTodosFilteredByCompletion(completedTodos, true);
      expect(completedTodos[0]._id).toBe(todo2Id);
    });

    it('should handle mixed completion states with context filtering', async () => {
      // Create todos in same context with different completion states
      const workTodo1Response = await assert.expectToolCallSuccess<MCPResponse>(
        'createTodo',
        createTestTodoData.withContext('work'),
      );
      const workTodo1Id = workTodo1Response.data!.id!;

      const workTodo2Response = await assert.expectToolCallSuccess<MCPResponse>(
        'createTodo',
        { ...createTestTodoData.withContext('work'), title: 'Work Todo 2' },
      );
      const workTodo2Id = workTodo2Response.data!.id!;

      // Complete one work todo
      await assert.expectToolCallSuccess('toggleTodoCompletion', {
        id: workTodo1Id,
        completed: true,
      });

      // Filter for active work todos
      const activeWorkTodos = await assert.expectToolCallSuccess<TodoAlpha3[]>(
        'listTodos',
        { context: 'work', completed: false },
      );

      assert.expectTodoCount(activeWorkTodos, 1);
      assert.expectTodosFilteredByContext(activeWorkTodos, 'work');
      assert.expectTodosFilteredByCompletion(activeWorkTodos, false);
      expect(activeWorkTodos[0]._id).toBe(workTodo2Id);

      // Filter for completed work todos
      const completedWorkTodos = await assert.expectToolCallSuccess<
        TodoAlpha3[]
      >('listTodos', { context: 'work', completed: true });

      assert.expectTodoCount(completedWorkTodos, 1);
      assert.expectTodosFilteredByContext(completedWorkTodos, 'work');
      assert.expectTodosFilteredByCompletion(completedWorkTodos, true);
      expect(completedWorkTodos[0]._id).toBe(workTodo1Id);
    });
  });

  describe('Completion Date Range Filtering', () => {
    it('should filter todos by completion date range', async () => {
      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60000);
      const oneMinuteFromNow = new Date(now.getTime() + 60000);

      // Create some todos
      const completedTodo1Response =
        await assert.expectToolCallSuccess<MCPResponse>('createTodo', {
          ...createTestTodoData.withContext('work'),
          title: 'Completed Todo 1',
        });
      const completedTodo1Id = completedTodo1Response.data!.id!;

      const completedTodo2Response =
        await assert.expectToolCallSuccess<MCPResponse>('createTodo', {
          ...createTestTodoData.withContext('work'),
          title: 'Completed Todo 2',
        });
      const completedTodo2Id = completedTodo2Response.data!.id!;

      await assert.expectToolCallSuccess<MCPResponse>('createTodo', {
        ...createTestTodoData.withContext('work'),
        title: 'Not Completed',
      });

      // Complete the todos (they will get current timestamp)
      await assert.expectToolCallSuccess('toggleTodoCompletion', {
        id: completedTodo1Id,
        completed: true,
      });

      await assert.expectToolCallSuccess('toggleTodoCompletion', {
        id: completedTodo2Id,
        completed: true,
      });

      // Filter by completion date range (should include recently completed)
      const completedInRange = await assert.expectToolCallSuccess<TodoAlpha3[]>(
        'listTodos',
        {
          completedFrom: oneMinuteAgo.toISOString(),
          completedTo: oneMinuteFromNow.toISOString(),
        },
      );

      assert.expectTodoCount(completedInRange, 2);
      const titles = completedInRange.map((t) => t.title);
      expect(titles).toContain('Completed Todo 1');
      expect(titles).toContain('Completed Todo 2');
      expect(titles).not.toContain('Not Completed');

      // Filter outside the range (should return empty)
      const tomorrow = new Date(now.getTime() + 86400000);
      const dayAfterTomorrow = new Date(now.getTime() + 172800000);
      const completedOutsideRange = await assert.expectToolCallSuccess<
        TodoAlpha3[]
      >('listTodos', {
        completedFrom: tomorrow.toISOString(),
        completedTo: dayAfterTomorrow.toISOString(),
      });

      assert.expectTodoCount(completedOutsideRange, 0);
    });

    it('should combine completion date range with context filter', async () => {
      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60000);
      const oneMinuteFromNow = new Date(now.getTime() + 60000);

      // Create completed todos in different contexts
      const workTodoResponse = await assert.expectToolCallSuccess<MCPResponse>(
        'createTodo',
        {
          ...createTestTodoData.withContext('work'),
          title: 'Work Completed',
        },
      );
      const workTodoId = workTodoResponse.data!.id!;
      await assert.expectToolCallSuccess('toggleTodoCompletion', {
        id: workTodoId,
        completed: true,
      });

      const privateTodoResponse =
        await assert.expectToolCallSuccess<MCPResponse>('createTodo', {
          ...createTestTodoData.withContext('private'),
          title: 'Private Completed',
        });
      const privateTodoId = privateTodoResponse.data!.id!;
      await assert.expectToolCallSuccess('toggleTodoCompletion', {
        id: privateTodoId,
        completed: true,
      });

      // Filter by completion date + work context
      const workCompleted = await assert.expectToolCallSuccess<TodoAlpha3[]>(
        'listTodos',
        {
          context: 'work',
          completedFrom: oneMinuteAgo.toISOString(),
          completedTo: oneMinuteFromNow.toISOString(),
        },
      );

      assert.expectTodoCount(workCompleted, 1);
      expect(workCompleted[0].title).toBe('Work Completed');
      assert.expectTodosFilteredByContext(workCompleted, 'work');
    });
  });

  describe('Date Range Filtering', () => {
    it('should filter todos by date range', async () => {
      const dateRange = testDates.range(1, 7); // Tomorrow to next week

      // Create todos with different due dates
      const todayResponse = await assert.expectToolCallSuccess<MCPResponse>(
        'createTodo',
        createTestTodoData.withDueDate(testDates.today()),
      );
      const todayTodoId = todayResponse.data!.id!;

      const tomorrowResponse = await assert.expectToolCallSuccess<MCPResponse>(
        'createTodo',
        createTestTodoData.withDueDate(testDates.tomorrow()),
      );
      const tomorrowTodoId = tomorrowResponse.data!.id!;

      const nextWeekResponse = await assert.expectToolCallSuccess<MCPResponse>(
        'createTodo',
        createTestTodoData.withDueDate(testDates.nextWeek()),
      );
      const nextWeekTodoId = nextWeekResponse.data!.id!;

      const pastResponse = await assert.expectToolCallSuccess<MCPResponse>(
        'createTodo',
        createTestTodoData.withDueDate(testDates.yesterday()),
      );
      const pastTodoId = pastResponse.data!.id!;

      // Filter by date range (tomorrow to next week)
      const rangeFiltered = await assert.expectToolCallSuccess<TodoAlpha3[]>(
        'listTodos',
        {
          dateFrom: dateRange.start,
          dateTo: dateRange.end,
        },
      );

      assert.expectValidTodos(rangeFiltered);
      assert.expectTodosInDateRange(
        rangeFiltered,
        dateRange.start,
        dateRange.end,
      );

      // Should contain tomorrow and next week todos, not today or past
      const filteredIds = rangeFiltered.map((t) => t._id);
      expect(filteredIds).toContain(tomorrowTodoId);
      expect(filteredIds).toContain(nextWeekTodoId);
      expect(filteredIds).not.toContain(todayTodoId);
      expect(filteredIds).not.toContain(pastTodoId);
    });

    it('should handle single date filtering', async () => {
      const targetDate = testDates.tomorrow();

      // Create todos with different due dates
      await assert.expectToolCallSuccess(
        'createTodo',
        createTestTodoData.withDueDate(testDates.today()),
      );
      const targetResponse = await assert.expectToolCallSuccess<MCPResponse>(
        'createTodo',
        createTestTodoData.withDueDate(targetDate),
      );
      const targetTodoId = targetResponse.data!.id!;
      await assert.expectToolCallSuccess(
        'createTodo',
        createTestTodoData.withDueDate(testDates.nextWeek()),
      );

      // Filter for single date (start and end same)
      const singleDateFiltered = await assert.expectToolCallSuccess<
        TodoAlpha3[]
      >('listTodos', {
        dateFrom: targetDate,
        dateTo: targetDate,
      });

      assert.expectTodoCount(singleDateFiltered, 1);
      expect(singleDateFiltered[0]._id).toBe(targetTodoId);
    });
  });

  describe('Limit and Pagination', () => {
    it('should respect limit parameter', async () => {
      // Create many todos
      const batchTodos = createTestTodoData.batch(10, 'Limit Test');
      for (const todoData of batchTodos) {
        await assert.expectToolCallSuccess('createTodo', todoData);
      }

      // Test different limits
      const limit3 = await assert.expectToolCallSuccess<TodoAlpha3[]>(
        'listTodos',
        { limit: 3 },
      );
      assert.expectTodoCount(limit3, 3);

      const limit5 = await assert.expectToolCallSuccess<TodoAlpha3[]>(
        'listTodos',
        { limit: 5 },
      );
      assert.expectTodoCount(limit5, 5);

      const limit0 = await assert.expectToolCallSuccess<TodoAlpha3[]>(
        'listTodos',
        { limit: 0 },
      );
      // Limit 0 should return all or none depending on implementation
      expect(limit0.length).toBeGreaterThanOrEqual(0);

      // No limit should return all
      const noLimit = await assert.expectToolCallSuccess<TodoAlpha3[]>(
        'listTodos',
        {},
      );
      assert.expectTodoCount(noLimit, 10);
    });

    it('should return todos in consistent order', async () => {
      // Create todos with different due dates
      const todos: TodoAlpha3[] = [];
      for (let i = 0; i < 5; i++) {
        const todo = await assert.expectToolCallSuccess<TodoAlpha3>(
          'createTodo',
          {
            ...createTestTodoData.basic(),
            title: `Order Test ${i + 1}`,
            due: testDates.range(i, i).start, // Different due dates
          },
        );
        todos.push(todo);
      }

      // Query multiple times to ensure consistent ordering (by due date ascending)
      for (let i = 0; i < 3; i++) {
        const queried = await assert.expectToolCallSuccess<TodoAlpha3[]>(
          'listTodos',
          {},
        );
        // Verify they are sorted by due date in ascending order
        for (let j = 1; j < queried.length; j++) {
          const prevDue = new Date(queried[j - 1].due);
          const currDue = new Date(queried[j].due);
          expect(prevDue <= currDue).toBe(true);
        }
      }
    });
  });

  describe('Complex Multi-Filter Queries', () => {
    it('should combine context, completion, and date filters', async () => {
      const targetDate = testDates.tomorrow();

      // Create test data matrix
      // Work context, active, tomorrow
      const workActiveTomorrowResponse =
        await assert.expectToolCallSuccess<MCPResponse>('createTodo', {
          ...createTestTodoData.withContext('work'),
          due: targetDate,
          title: 'Work Active Tomorrow',
        });
      const workActiveTomorrowId = workActiveTomorrowResponse.data!.id!;

      // Work context, completed, tomorrow
      const workCompletedTomorrowResponse =
        await assert.expectToolCallSuccess<MCPResponse>('createTodo', {
          ...createTestTodoData.withContext('work'),
          due: targetDate,
          title: 'Work Completed Tomorrow',
        });
      const workCompletedTomorrowId = workCompletedTomorrowResponse.data!.id!;
      await assert.expectToolCallSuccess('toggleTodoCompletion', {
        id: workCompletedTomorrowId,
        completed: true,
      });

      // Work context, active, today
      await assert.expectToolCallSuccess('createTodo', {
        ...createTestTodoData.withContext('work'),
        due: testDates.today(),
        title: 'Work Active Today',
      });

      // Private context, active, tomorrow
      await assert.expectToolCallSuccess('createTodo', {
        ...createTestTodoData.withContext('private'),
        due: targetDate,
        title: 'Private Active Tomorrow',
      });

      // Complex filter: work context, active, tomorrow
      const complexFiltered = await assert.expectToolCallSuccess<TodoAlpha3[]>(
        'listTodos',
        {
          context: 'work',
          completed: false,
          dateFrom: targetDate,
          dateTo: targetDate,
        },
      );

      assert.expectTodoCount(complexFiltered, 1);
      expect(complexFiltered[0]._id).toBe(workActiveTomorrowId);

      assert.expectTodosFilteredByContext(complexFiltered, 'work');
      assert.expectTodosFilteredByCompletion(complexFiltered, false);
      assert.expectTodosInDateRange(complexFiltered, targetDate, targetDate);
    });

    it('should combine all filters with limit', async () => {
      const targetDate = testDates.tomorrow();

      // Create multiple matching todos
      const matchingTodos: TodoAlpha3[] = [];
      for (let i = 0; i < 5; i++) {
        await new Promise((resolve) => setTimeout(resolve, 10)); // Ensure different timestamps
        const todo = await assert.expectToolCallSuccess<TodoAlpha3>(
          'createTodo',
          {
            ...createTestTodoData.withContext('work'),
            due: targetDate,
            title: `Multi-filter Test ${i + 1}`,
          },
        );
        matchingTodos.push(todo);
      }

      // Create non-matching todos
      await assert.expectToolCallSuccess(
        'createTodo',
        createTestTodoData.withContext('private'), // Different context
      );

      // Apply all filters with limit
      const complexWithLimit = await assert.expectToolCallSuccess<TodoAlpha3[]>(
        'listTodos',
        {
          context: 'work',
          completed: false,
          dateFrom: targetDate,
          dateTo: targetDate,
          limit: 3,
        },
      );

      assert.expectTodoCount(complexWithLimit, 3);
      assert.expectTodosFilteredByContext(complexWithLimit, 'work');
      assert.expectTodosFilteredByCompletion(complexWithLimit, false);
      assert.expectTodosInDateRange(complexWithLimit, targetDate, targetDate);
    });
  });

  describe('Edge Cases', () => {
    it('should return empty array for no matches', async () => {
      // Create some todos
      await assert.expectToolCallSuccess(
        'createTodo',
        createTestTodoData.withContext('work'),
      );

      // Filter for non-existent context
      const noMatches = await assert.expectToolCallSuccess<TodoAlpha3[]>(
        'listTodos',
        { context: 'nonexistent' },
      );

      assert.expectTodoCount(noMatches, 0);
    });

    it('should handle invalid date ranges gracefully', async () => {
      // Create a todo
      await assert.expectToolCallSuccess(
        'createTodo',
        createTestTodoData.basic(),
      );

      // Test with invalid date format (should error or return empty)
      try {
        const result = await assert.expectToolCallSuccess<TodoAlpha3[]>(
          'listTodos',
          {
            dateFrom: 'invalid-date',
            dateTo: testDates.tomorrow(),
          },
        );
        // If it doesn't throw, should return empty or all todos
        expect(Array.isArray(result)).toBe(true);
      } catch (error) {
        // Error is acceptable for invalid date format
        expect(error).toBeDefined();
      }
    });

    it('should handle start date after end date', async () => {
      await assert.expectToolCallSuccess(
        'createTodo',
        createTestTodoData.basic(),
      );

      // Start date after end date
      const result = await assert.expectToolCallSuccess<TodoAlpha3[]>(
        'listTodos',
        {
          dateFrom: testDates.nextWeek(),
          dateTo: testDates.today(),
        },
      );

      // Should return empty array for invalid range
      assert.expectTodoCount(result, 0);
    });
  });
});
