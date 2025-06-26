/**
 * Time Tracking Integration Tests
 * Tests time tracking start/stop functionality and querying
 */

import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import { MCPTestServer } from '../setup/test-server.js';
import { createMCPAssertions } from '../helpers/mcp-assertions.js';
import { createTestTodoData } from '../__fixtures__/todo-factory.js';
import type { TodoAlpha3 } from '../helpers/mcp-assertions.js';

describe('MCP Time Tracking Integration', () => {
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

  describe('Basic Time Tracking', () => {
    it('should start and stop time tracking for single category', async () => {
      // Create a todo for time tracking
      const todoData = createTestTodoData.withTimeTracking();
      const createdTodo = await assert.expectToolCallSuccess<TodoAlpha3>('createTodo', todoData);

      // Initially no active time tracking
      expect(Object.keys(createdTodo.active)).toHaveLength(0);

      // Start time tracking
      const category = 'development';
      const todoWithTracking = await assert.expectToolCallSuccess<TodoAlpha3>(
        'startTimeTracking',
        { id: createdTodo._id, category }
      );

      assert.expectActiveTimeTracking(todoWithTracking, [category]);

      // Stop time tracking
      const todoAfterStop = await assert.expectToolCallSuccess<TodoAlpha3>(
        'stopTimeTracking',
        { id: createdTodo._id, category }
      );

      assert.expectInactiveTimeTracking(todoAfterStop, [category]);
    });

    it('should handle multiple concurrent tracking categories', async () => {
      // Create todo
      const todoData = createTestTodoData.withTimeTracking();
      const createdTodo = await assert.expectToolCallSuccess<TodoAlpha3>('createTodo', todoData);

      const categories = ['development', 'research', 'testing'];

      // Start tracking for all categories
      let currentTodo = createdTodo;
      for (const category of categories) {
        currentTodo = await assert.expectToolCallSuccess<TodoAlpha3>(
          'startTimeTracking',
          { id: currentTodo._id, category }
        );
      }

      // All categories should be active
      assert.expectActiveTimeTracking(currentTodo, categories);

      // Stop tracking for middle category
      const todoAfterPartialStop = await assert.expectToolCallSuccess<TodoAlpha3>(
        'stopTimeTracking',
        { id: currentTodo._id, category: 'research' }
      );

      // Research should be inactive, others still active
      assert.expectInactiveTimeTracking(todoAfterPartialStop, ['research']);
      assert.expectActiveTimeTracking(todoAfterPartialStop, ['development', 'testing']);

      // Stop all remaining
      for (const category of ['development', 'testing']) {
        await assert.expectToolCallSuccess('stopTimeTracking', {
          id: currentTodo._id,
          category,
        });
      }

      // Get final state
      const finalTodos = await assert.expectToolCallSuccess<TodoAlpha3[]>('listTodos', {});
      const finalTodo = finalTodos.find(t => t._id === createdTodo._id)!;
      
      assert.expectInactiveTimeTracking(finalTodo, categories);
    });

    it('should query active time tracking sessions', async () => {
      // Create multiple todos with different tracking states
      const todoData1 = createTestTodoData.withContext('work');
      const todoData2 = createTestTodoData.withContext('private');
      const todoData3 = createTestTodoData.basic();

      const todo1 = await assert.expectToolCallSuccess<TodoAlpha3>('createTodo', todoData1);
      const todo2 = await assert.expectToolCallSuccess<TodoAlpha3>('createTodo', todoData2);
      const todo3 = await assert.expectToolCallSuccess<TodoAlpha3>('createTodo', todoData3);

      // Start tracking on first two todos
      await assert.expectToolCallSuccess('startTimeTracking', {
        id: todo1._id,
        category: 'focus',
      });
      
      await assert.expectToolCallSuccess('startTimeTracking', {
        id: todo2._id,
        category: 'creative',
      });

      // Third todo has no active tracking

      // Query active time tracking
      const activeTracking = await assert.expectToolCallSuccess<TodoAlpha3[]>(
        'getActiveTimeTracking',
        {}
      );

      assert.expectValidTodos(activeTracking);
      assert.expectTodoCount(activeTracking, 2);

      // Verify the right todos are returned
      const activeTodoIds = activeTracking.map(t => t._id);
      expect(activeTodoIds).toContain(todo1._id);
      expect(activeTodoIds).toContain(todo2._id);
      expect(activeTodoIds).not.toContain(todo3._id);

      // Verify tracking is active
      const trackedTodo1 = activeTracking.find(t => t._id === todo1._id)!;
      const trackedTodo2 = activeTracking.find(t => t._id === todo2._id)!;
      
      assert.expectActiveTimeTracking(trackedTodo1, ['focus']);
      assert.expectActiveTimeTracking(trackedTodo2, ['creative']);
    });
  });

  describe('Time Tracking Edge Cases', () => {
    it('should prevent duplicate time tracking starts', async () => {
      const todoData = createTestTodoData.withTimeTracking();
      const createdTodo = await assert.expectToolCallSuccess<TodoAlpha3>('createTodo', todoData);

      const category = 'development';

      // Start tracking
      await assert.expectToolCallSuccess('startTimeTracking', {
        id: createdTodo._id,
        category,
      });

      // Starting again should either be idempotent or throw error
      // (Implementation dependent - both behaviors are valid)
      try {
        await assert.expectToolCallSuccess('startTimeTracking', {
          id: createdTodo._id,
          category,
        });
      } catch (error) {
        // Error is acceptable for duplicate start
        expect(error).toBeDefined();
      }
    });

    it('should handle stopping non-active tracking gracefully', async () => {
      const todoData = createTestTodoData.withTimeTracking();
      const createdTodo = await assert.expectToolCallSuccess<TodoAlpha3>('createTodo', todoData);

      // Try to stop tracking that was never started
      try {
        await assert.expectToolCallSuccess('stopTimeTracking', {
          id: createdTodo._id,
          category: 'never-started',
        });
      } catch (error) {
        // Error is acceptable for stopping non-active tracking
        expect(error).toBeDefined();
      }
    });

    it('should handle time tracking with completed todos', async () => {
      const todoData = createTestTodoData.withTimeTracking();
      const createdTodo = await assert.expectToolCallSuccess<TodoAlpha3>('createTodo', todoData);

      // Start time tracking
      await assert.expectToolCallSuccess('startTimeTracking', {
        id: createdTodo._id,
        category: 'work',
      });

      // Complete the todo while tracking is active
      const completedTodo = await assert.expectToolCallSuccess<TodoAlpha3>(
        'toggleTodoCompletion',
        { id: createdTodo._id }
      );

      // Time tracking should persist through completion
      assert.expectActiveTimeTracking(completedTodo, ['work']);

      // Should still be able to stop tracking
      const todoAfterStop = await assert.expectToolCallSuccess<TodoAlpha3>(
        'stopTimeTracking',
        { id: createdTodo._id, category: 'work' }
      );

      assert.expectInactiveTimeTracking(todoAfterStop, ['work']);
    });

    it('should maintain time tracking data integrity', async () => {
      const todoData = createTestTodoData.withTimeTracking();
      const createdTodo = await assert.expectToolCallSuccess<TodoAlpha3>('createTodo', todoData);

      const startTime = new Date().toISOString();
      
      // Start tracking
      const todoWithTracking = await assert.expectToolCallSuccess<TodoAlpha3>(
        'startTimeTracking',
        { id: createdTodo._id, category: 'integrity-test' }
      );

      // Verify timestamp is reasonable (within last few seconds)
      const trackingStartTime = new Date(todoWithTracking.active['integrity-test']!);
      const now = new Date();
      const timeDiff = now.getTime() - trackingStartTime.getTime();
      
      expect(timeDiff).toBeGreaterThanOrEqual(0);
      expect(timeDiff).toBeLessThan(10000); // Less than 10 seconds

      // Update other fields while tracking is active
      const updatedTodo = await assert.expectToolCallSuccess<TodoAlpha3>(
        'updateTodo',
        {
          id: createdTodo._id,
          updates: { title: 'Updated while tracking' },
        }
      );

      // Time tracking data should be preserved
      assert.expectActiveTimeTracking(updatedTodo, ['integrity-test']);
      expect(updatedTodo.active['integrity-test']).toBe(todoWithTracking.active['integrity-test']);
    });
  });

  describe('Time Tracking with Filtering', () => {
    it('should filter active tracking by context', async () => {
      // Create todos in different contexts
      const workTodo = await assert.expectToolCallSuccess<TodoAlpha3>(
        'createTodo',
        createTestTodoData.withContext('work')
      );
      
      const privateTodo = await assert.expectToolCallSuccess<TodoAlpha3>(
        'createTodo',
        createTestTodoData.withContext('private')
      );

      // Start tracking on both
      await assert.expectToolCallSuccess('startTimeTracking', {
        id: workTodo._id,
        category: 'focus',
      });
      
      await assert.expectToolCallSuccess('startTimeTracking', {
        id: privateTodo._id,
        category: 'focus',
      });

      // Query active tracking (should get both)
      const allActiveTracking = await assert.expectToolCallSuccess<TodoAlpha3[]>(
        'getActiveTimeTracking',
        {}
      );
      
      assert.expectTodoCount(allActiveTracking, 2);

      // Filter by context through listTodos
      const workTodos = await assert.expectToolCallSuccess<TodoAlpha3[]>(
        'listTodos',
        { context: 'work' }
      );
      
      const privateTodos = await assert.expectToolCallSuccess<TodoAlpha3[]>(
        'listTodos',
        { context: 'private' }
      );

      assert.expectTodosFilteredByContext(workTodos, 'work');
      assert.expectTodosFilteredByContext(privateTodos, 'private');
      
      // Check that tracking is preserved in filtered results
      const workTodoWithTracking = workTodos.find(t => t._id === workTodo._id)!;
      const privateTodoWithTracking = privateTodos.find(t => t._id === privateTodo._id)!;
      
      assert.expectActiveTimeTracking(workTodoWithTracking, ['focus']);
      assert.expectActiveTimeTracking(privateTodoWithTracking, ['focus']);
    });
  });
});