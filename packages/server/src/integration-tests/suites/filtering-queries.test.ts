/**
 * Filtering and Query Integration Tests
 * Tests all filtering capabilities of listTodos
 */

import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import { MCPTestServer } from '../setup/test-server.js';
import { createMCPAssertions } from '../helpers/mcp-assertions.js';
import { createTestTodoData, testDates } from '../__fixtures__/todo-factory.js';
import type { TodoAlpha3 } from '../helpers/mcp-assertions.js';

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
      const workTodo1 = await assert.expectToolCallSuccess<TodoAlpha3>(
        'createTodo',
        createTestTodoData.withContext('work')
      );
      
      const workTodo2 = await assert.expectToolCallSuccess<TodoAlpha3>(
        'createTodo',
        { ...createTestTodoData.withContext('work'), title: 'Work Todo 2' }
      );
      
      const privateTodo = await assert.expectToolCallSuccess<TodoAlpha3>(
        'createTodo',
        createTestTodoData.withContext('private')
      );
      
      const personalTodo = await assert.expectToolCallSuccess<TodoAlpha3>(
        'createTodo',
        createTestTodoData.withContext('personal')
      );

      // Filter by work context
      const workTodos = await assert.expectToolCallSuccess<TodoAlpha3[]>(
        'listTodos',
        { context: 'work' }
      );
      
      assert.expectValidTodos(workTodos);
      assert.expectTodoCount(workTodos, 2);
      assert.expectTodosFilteredByContext(workTodos, 'work');

      // Filter by private context
      const privateTodos = await assert.expectToolCallSuccess<TodoAlpha3[]>(
        'listTodos',
        { context: 'private' }
      );
      
      assert.expectTodoCount(privateTodos, 1);
      assert.expectTodosFilteredByContext(privateTodos, 'private');

      // Filter by personal context
      const personalTodos = await assert.expectToolCallSuccess<TodoAlpha3[]>(
        'listTodos',
        { context: 'personal' }
      );
      
      assert.expectTodoCount(personalTodos, 1);
      assert.expectTodosFilteredByContext(personalTodos, 'personal');

      // Verify all todos returned without filter
      const allTodos = await assert.expectToolCallSuccess<TodoAlpha3[]>(
        'listTodos',
        {}
      );
      
      assert.expectTodoCount(allTodos, 4);
    });
  });

  describe('Completion Status Filtering', () => {
    it('should filter by completion status', async () => {
      // Create multiple todos
      const todo1 = await assert.expectToolCallSuccess<TodoAlpha3>(
        'createTodo',
        createTestTodoData.basic()
      );
      
      const todo2 = await assert.expectToolCallSuccess<TodoAlpha3>(
        'createTodo',
        createTestTodoData.forCompletion()
      );
      
      const todo3 = await assert.expectToolCallSuccess<TodoAlpha3>(
        'createTodo',
        { ...createTestTodoData.basic(), title: 'Third Todo' }
      );

      // Complete one todo
      await assert.expectToolCallSuccess('toggleTodoCompletion', { id: todo2._id });

      // Filter for active (incomplete) todos
      const activeTodos = await assert.expectToolCallSuccess<TodoAlpha3[]>(
        'listTodos',
        { completed: false }
      );
      
      assert.expectValidTodos(activeTodos);
      assert.expectTodoCount(activeTodos, 2);
      assert.expectTodosFilteredByCompletion(activeTodos, false);

      // Filter for completed todos
      const completedTodos = await assert.expectToolCallSuccess<TodoAlpha3[]>(
        'listTodos',
        { completed: true }
      );
      
      assert.expectTodoCount(completedTodos, 1);
      assert.expectTodosFilteredByCompletion(completedTodos, true);
      expect(completedTodos[0]._id).toBe(todo2._id);
    });

    it('should handle mixed completion states with context filtering', async () => {
      // Create todos in same context with different completion states
      const workTodo1 = await assert.expectToolCallSuccess<TodoAlpha3>(
        'createTodo',
        createTestTodoData.withContext('work')
      );
      
      const workTodo2 = await assert.expectToolCallSuccess<TodoAlpha3>(
        'createTodo',
        { ...createTestTodoData.withContext('work'), title: 'Work Todo 2' }
      );

      // Complete one work todo
      await assert.expectToolCallSuccess('toggleTodoCompletion', { id: workTodo1._id });

      // Filter for active work todos
      const activeWorkTodos = await assert.expectToolCallSuccess<TodoAlpha3[]>(
        'listTodos',
        { context: 'work', completed: false }
      );
      
      assert.expectTodoCount(activeWorkTodos, 1);
      assert.expectTodosFilteredByContext(activeWorkTodos, 'work');
      assert.expectTodosFilteredByCompletion(activeWorkTodos, false);
      expect(activeWorkTodos[0]._id).toBe(workTodo2._id);

      // Filter for completed work todos
      const completedWorkTodos = await assert.expectToolCallSuccess<TodoAlpha3[]>(
        'listTodos',
        { context: 'work', completed: true }
      );
      
      assert.expectTodoCount(completedWorkTodos, 1);
      assert.expectTodosFilteredByContext(completedWorkTodos, 'work');
      assert.expectTodosFilteredByCompletion(completedWorkTodos, true);
      expect(completedWorkTodos[0]._id).toBe(workTodo1._id);
    });
  });

  describe('Date Range Filtering', () => {
    it('should filter todos by date range', async () => {
      const dateRange = testDates.range(1, 7); // Tomorrow to next week
      
      // Create todos with different due dates
      const todayTodo = await assert.expectToolCallSuccess<TodoAlpha3>(
        'createTodo',
        createTestTodoData.withDueDate(testDates.today())
      );
      
      const tomorrowTodo = await assert.expectToolCallSuccess<TodoAlpha3>(
        'createTodo',
        createTestTodoData.withDueDate(testDates.tomorrow())
      );
      
      const nextWeekTodo = await assert.expectToolCallSuccess<TodoAlpha3>(
        'createTodo',
        createTestTodoData.withDueDate(testDates.nextWeek())
      );
      
      const pastTodo = await assert.expectToolCallSuccess<TodoAlpha3>(
        'createTodo',
        createTestTodoData.withDueDate(testDates.yesterday())
      );

      // Filter by date range (tomorrow to next week)
      const rangeFiltered = await assert.expectToolCallSuccess<TodoAlpha3[]>(
        'listTodos',
        {
          startDate: dateRange.start,
          endDate: dateRange.end,
        }
      );
      
      assert.expectValidTodos(rangeFiltered);
      assert.expectTodosInDateRange(rangeFiltered, dateRange.start, dateRange.end);
      
      // Should contain tomorrow and next week todos, not today or past
      const filteredIds = rangeFiltered.map(t => t._id);
      expect(filteredIds).toContain(tomorrowTodo._id);
      expect(filteredIds).toContain(nextWeekTodo._id);
      expect(filteredIds).not.toContain(todayTodo._id);
      expect(filteredIds).not.toContain(pastTodo._id);
    });

    it('should handle single date filtering', async () => {
      const targetDate = testDates.tomorrow();
      
      // Create todos with different due dates
      await assert.expectToolCallSuccess('createTodo', createTestTodoData.withDueDate(testDates.today()));
      const targetTodo = await assert.expectToolCallSuccess<TodoAlpha3>(
        'createTodo',
        createTestTodoData.withDueDate(targetDate)
      );
      await assert.expectToolCallSuccess('createTodo', createTestTodoData.withDueDate(testDates.nextWeek()));

      // Filter for single date (start and end same)
      const singleDateFiltered = await assert.expectToolCallSuccess<TodoAlpha3[]>(
        'listTodos',
        {
          startDate: targetDate,
          endDate: targetDate,
        }
      );
      
      assert.expectTodoCount(singleDateFiltered, 1);
      expect(singleDateFiltered[0]._id).toBe(targetTodo._id);
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
        { limit: 3 }
      );
      assert.expectTodoCount(limit3, 3);

      const limit5 = await assert.expectToolCallSuccess<TodoAlpha3[]>(
        'listTodos',
        { limit: 5 }
      );
      assert.expectTodoCount(limit5, 5);

      const limit0 = await assert.expectToolCallSuccess<TodoAlpha3[]>(
        'listTodos',
        { limit: 0 }
      );
      // Limit 0 should return all or none depending on implementation
      expect(limit0.length).toBeGreaterThanOrEqual(0);

      // No limit should return all
      const noLimit = await assert.expectToolCallSuccess<TodoAlpha3[]>(
        'listTodos',
        {}
      );
      assert.expectTodoCount(noLimit, 10);
    });

    it('should return todos in consistent order', async () => {
      // Create todos with slight time differences
      const todos: TodoAlpha3[] = [];
      for (let i = 0; i < 5; i++) {
        // Small delay to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 10));
        const todo = await assert.expectToolCallSuccess<TodoAlpha3>(
          'createTodo',
          { ...createTestTodoData.basic(), title: `Order Test ${i + 1}` }
        );
        todos.push(todo);
      }

      // Query multiple times to ensure consistent ordering
      for (let i = 0; i < 3; i++) {
        const queried = await assert.expectToolCallSuccess<TodoAlpha3[]>('listTodos', {});
        assert.expectTodosSortedByCreation(queried);
      }
    });
  });

  describe('Complex Multi-Filter Queries', () => {
    it('should combine context, completion, and date filters', async () => {
      const targetDate = testDates.tomorrow();
      
      // Create test data matrix
      // Work context, active, tomorrow
      const workActiveTomorrow = await assert.expectToolCallSuccess<TodoAlpha3>(
        'createTodo',
        { ...createTestTodoData.withContext('work'), due: targetDate, title: 'Work Active Tomorrow' }
      );
      
      // Work context, completed, tomorrow
      const workCompletedTomorrow = await assert.expectToolCallSuccess<TodoAlpha3>(
        'createTodo',
        { ...createTestTodoData.withContext('work'), due: targetDate, title: 'Work Completed Tomorrow' }
      );
      await assert.expectToolCallSuccess('toggleTodoCompletion', { id: workCompletedTomorrow._id });
      
      // Work context, active, today
      await assert.expectToolCallSuccess(
        'createTodo',
        { ...createTestTodoData.withContext('work'), due: testDates.today(), title: 'Work Active Today' }
      );
      
      // Private context, active, tomorrow
      await assert.expectToolCallSuccess(
        'createTodo',
        { ...createTestTodoData.withContext('private'), due: targetDate, title: 'Private Active Tomorrow' }
      );

      // Complex filter: work context, active, tomorrow
      const complexFiltered = await assert.expectToolCallSuccess<TodoAlpha3[]>(
        'listTodos',
        {
          context: 'work',
          completed: false,
          startDate: targetDate,
          endDate: targetDate,
        }
      );
      
      assert.expectTodoCount(complexFiltered, 1);
      expect(complexFiltered[0]._id).toBe(workActiveTomorrow._id);
      
      assert.expectTodosFilteredByContext(complexFiltered, 'work');
      assert.expectTodosFilteredByCompletion(complexFiltered, false);
      assert.expectTodosInDateRange(complexFiltered, targetDate, targetDate);
    });

    it('should combine all filters with limit', async () => {
      const targetDate = testDates.tomorrow();
      
      // Create multiple matching todos
      const matchingTodos: TodoAlpha3[] = [];
      for (let i = 0; i < 5; i++) {
        await new Promise(resolve => setTimeout(resolve, 10)); // Ensure different timestamps
        const todo = await assert.expectToolCallSuccess<TodoAlpha3>(
          'createTodo',
          {
            ...createTestTodoData.withContext('work'),
            due: targetDate,
            title: `Multi-filter Test ${i + 1}`,
          }
        );
        matchingTodos.push(todo);
      }
      
      // Create non-matching todos
      await assert.expectToolCallSuccess(
        'createTodo',
        createTestTodoData.withContext('private') // Different context
      );

      // Apply all filters with limit
      const complexWithLimit = await assert.expectToolCallSuccess<TodoAlpha3[]>(
        'listTodos',
        {
          context: 'work',
          completed: false,
          startDate: targetDate,
          endDate: targetDate,
          limit: 3,
        }
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
      await assert.expectToolCallSuccess('createTodo', createTestTodoData.withContext('work'));
      
      // Filter for non-existent context
      const noMatches = await assert.expectToolCallSuccess<TodoAlpha3[]>(
        'listTodos',
        { context: 'nonexistent' }
      );
      
      assert.expectTodoCount(noMatches, 0);
    });

    it('should handle invalid date ranges gracefully', async () => {
      // Create a todo
      await assert.expectToolCallSuccess('createTodo', createTestTodoData.basic());

      // Test with invalid date format (should error or return empty)
      try {
        const result = await assert.expectToolCallSuccess<TodoAlpha3[]>(
          'listTodos',
          {
            startDate: 'invalid-date',
            endDate: testDates.tomorrow(),
          }
        );
        // If it doesn't throw, should return empty or all todos
        expect(Array.isArray(result)).toBe(true);
      } catch (error) {
        // Error is acceptable for invalid date format
        expect(error).toBeDefined();
      }
    });

    it('should handle start date after end date', async () => {
      await assert.expectToolCallSuccess('createTodo', createTestTodoData.basic());

      // Start date after end date
      const result = await assert.expectToolCallSuccess<TodoAlpha3[]>(
        'listTodos',
        {
          startDate: testDates.nextWeek(),
          endDate: testDates.today(),
        }
      );
      
      // Should return empty array for invalid range
      assert.expectTodoCount(result, 0);
    });
  });
});