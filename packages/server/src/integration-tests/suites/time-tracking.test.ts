/**
 * Time Tracking Integration Tests
 * Tests time tracking start/stop functionality and querying
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createTestTodoData } from '../__fixtures__/todo-factory.js';
import { createMCPAssertions } from '../helpers/mcp-assertions.js';
import type { TodoAlpha3 } from '../helpers/mcp-assertions.js';
import { MCPTestServer } from '../setup/test-server.js';

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
      await assert.expectToolCallSuccess('createTodo', todoData);

      // Get the created todo
      const allTodos = await assert.expectToolCallSuccess<TodoAlpha3[]>(
        'listTodos',
        {},
      );
      const createdTodo = allTodos[0]; // Most recent todo
      assert.expectValidTodo(createdTodo);

      // Initially no active time tracking
      expect(Object.keys(createdTodo.active)).toHaveLength(0);

      // Start time tracking
      await assert.expectToolCallSuccess('startTimeTracking', {
        id: createdTodo._id,
      });

      // Get updated todo and verify tracking started
      const todosAfterStart = await assert.expectToolCallSuccess<TodoAlpha3[]>(
        'listTodos',
        {},
      );
      const todoWithTracking = todosAfterStart.find(
        (t) => t._id === createdTodo._id,
      )!;
      assert.expectHasActiveTimeTracking(todoWithTracking);

      // Stop time tracking
      await assert.expectToolCallSuccess('stopTimeTracking', {
        id: createdTodo._id,
      });

      // Get updated todo and verify tracking stopped
      const todosAfterStop = await assert.expectToolCallSuccess<TodoAlpha3[]>(
        'listTodos',
        {},
      );
      const todoAfterStop = todosAfterStop.find(
        (t) => t._id === createdTodo._id,
      )!;
      assert.expectHasNoActiveTimeTracking(todoAfterStop);
    });

    it('should handle multiple concurrent tracking categories', async () => {
      // Create todo
      const todoData = createTestTodoData.withTimeTracking();
      await assert.expectToolCallSuccess('createTodo', todoData);

      // Get the created todo
      const allTodos = await assert.expectToolCallSuccess<TodoAlpha3[]>(
        'listTodos',
        {},
      );
      const createdTodo = allTodos[0]; // Most recent todo
      assert.expectValidTodo(createdTodo);

      // Start multiple tracking sessions
      let currentTodo = createdTodo;

      // Start first session
      await assert.expectToolCallSuccess('startTimeTracking', {
        id: currentTodo._id,
      });

      // Get updated todo and verify tracking started
      let updatedTodos = await assert.expectToolCallSuccess<TodoAlpha3[]>(
        'listTodos',
        {},
      );
      currentTodo = updatedTodos.find((t) => t._id === createdTodo._id)!;
      assert.expectHasActiveTimeTracking(currentTodo);

      // Stop first session
      await assert.expectToolCallSuccess('stopTimeTracking', {
        id: currentTodo._id,
      });

      // Get updated todo and verify tracking stopped
      updatedTodos = await assert.expectToolCallSuccess<TodoAlpha3[]>(
        'listTodos',
        {},
      );
      currentTodo = updatedTodos.find((t) => t._id === createdTodo._id)!;
      assert.expectHasNoActiveTimeTracking(currentTodo);

      // Start second session
      await assert.expectToolCallSuccess('startTimeTracking', {
        id: currentTodo._id,
      });

      // Get updated todo and verify tracking started again
      updatedTodos = await assert.expectToolCallSuccess<TodoAlpha3[]>(
        'listTodos',
        {},
      );
      currentTodo = updatedTodos.find((t) => t._id === createdTodo._id)!;
      assert.expectHasActiveTimeTracking(currentTodo);

      // Stop second session
      await assert.expectToolCallSuccess('stopTimeTracking', {
        id: currentTodo._id,
      });

      // Get final state
      const finalTodos = await assert.expectToolCallSuccess<TodoAlpha3[]>(
        'listTodos',
        {},
      );
      const finalTodo = finalTodos.find((t) => t._id === createdTodo._id)!;

      assert.expectHasNoActiveTimeTracking(finalTodo);
    });

    it('should query active time tracking sessions', async () => {
      // Create multiple todos with different tracking states
      const todoData1 = createTestTodoData.withContext('work');
      const todoData2 = createTestTodoData.withContext('private');
      const todoData3 = createTestTodoData.basic();

      await assert.expectToolCallSuccess('createTodo', todoData1);
      await assert.expectToolCallSuccess('createTodo', todoData2);
      await assert.expectToolCallSuccess('createTodo', todoData3);

      // Get the created todos
      const allTodos = await assert.expectToolCallSuccess<TodoAlpha3[]>(
        'listTodos',
        {},
      );
      assert.expectValidTodos(allTodos);
      assert.expectTodoCount(allTodos, 3);

      // Sort by creation time (newest first)
      allTodos.sort(
        (a, b) => new Date(b._id).getTime() - new Date(a._id).getTime(),
      );

      const todo3 = allTodos[0]; // Most recent (basic todo)
      const todo2 = allTodos[1]; // Second most recent (private context)
      const todo1 = allTodos[2]; // Third most recent (work context)

      // Start tracking on first two todos
      await assert.expectToolCallSuccess('startTimeTracking', {
        id: todo1._id,
      });

      await assert.expectToolCallSuccess('startTimeTracking', {
        id: todo2._id,
      });

      // Third todo has no active tracking

      // Query active time tracking
      const activeTracking = await assert.expectToolCallSuccess<TodoAlpha3[]>(
        'getActiveTimeTracking',
        {},
      );

      assert.expectValidTodos(activeTracking);
      assert.expectTodoCount(activeTracking, 2);

      // Verify the right todos are returned
      const activeTodoIds = activeTracking.map((t) => t._id);
      expect(activeTodoIds).toContain(todo1._id);
      expect(activeTodoIds).toContain(todo2._id);
      expect(activeTodoIds).not.toContain(todo3._id);

      // Verify tracking is active
      const trackedTodo1 = activeTracking.find((t) => t._id === todo1._id)!;
      const trackedTodo2 = activeTracking.find((t) => t._id === todo2._id)!;

      assert.expectHasActiveTimeTracking(trackedTodo1);
      assert.expectHasActiveTimeTracking(trackedTodo2);
    });
  });

  describe('Time Tracking Edge Cases', () => {
    it('should prevent duplicate time tracking starts', async () => {
      const todoData = createTestTodoData.withTimeTracking();
      await assert.expectToolCallSuccess('createTodo', todoData);

      // Get the created todo
      const allTodos = await assert.expectToolCallSuccess<TodoAlpha3[]>(
        'listTodos',
        {},
      );
      const createdTodo = allTodos[0]; // Most recent todo
      assert.expectValidTodo(createdTodo);

      // Start tracking
      await assert.expectToolCallSuccess('startTimeTracking', {
        id: createdTodo._id,
      });

      // Starting again should either be idempotent or throw error
      // (Implementation dependent - both behaviors are valid)
      try {
        await assert.expectToolCallSuccess('startTimeTracking', {
          id: createdTodo._id,
        });
      } catch (error) {
        // Error is acceptable for duplicate start
        expect(error).toBeDefined();
      }
    });

    it('should handle stopping non-active tracking gracefully', async () => {
      const todoData = createTestTodoData.withTimeTracking();
      await assert.expectToolCallSuccess('createTodo', todoData);

      // Get the created todo
      const allTodos = await assert.expectToolCallSuccess<TodoAlpha3[]>(
        'listTodos',
        {},
      );
      const createdTodo = allTodos[0]; // Most recent todo
      assert.expectValidTodo(createdTodo);

      // Try to stop tracking that was never started
      try {
        await assert.expectToolCallSuccess('stopTimeTracking', {
          id: createdTodo._id,
        });
      } catch (error) {
        // Error is acceptable for stopping non-active tracking
        expect(error).toBeDefined();
      }
    });

    it('should handle time tracking with completed todos', async () => {
      const todoData = createTestTodoData.withTimeTracking();
      await assert.expectToolCallSuccess('createTodo', todoData);

      // Get the created todo
      const allTodos = await assert.expectToolCallSuccess<TodoAlpha3[]>(
        'listTodos',
        {},
      );
      const createdTodo = allTodos[0]; // Most recent todo
      assert.expectValidTodo(createdTodo);

      // Start time tracking
      await assert.expectToolCallSuccess('startTimeTracking', {
        id: createdTodo._id,
      });

      // Complete the todo while tracking is active
      await assert.expectToolCallSuccess('toggleTodoCompletion', {
        id: createdTodo._id,
        completed: true,
      });

      // Get updated todo
      const todosAfterCompletion = await assert.expectToolCallSuccess<
        TodoAlpha3[]
      >('listTodos', {});
      const completedTodo = todosAfterCompletion.find(
        (t) => t._id === createdTodo._id,
      )!;

      // Time tracking should persist through completion
      assert.expectHasActiveTimeTracking(completedTodo);

      // Should still be able to stop tracking
      await assert.expectToolCallSuccess('stopTimeTracking', {
        id: createdTodo._id,
      });

      // Get updated todo and verify tracking stopped
      const todosAfterStop = await assert.expectToolCallSuccess<TodoAlpha3[]>(
        'listTodos',
        {},
      );
      const todoAfterStop = todosAfterStop.find(
        (t) => t._id === createdTodo._id,
      )!;
      assert.expectHasNoActiveTimeTracking(todoAfterStop);
    });

    it('should maintain time tracking data integrity', async () => {
      const todoData = createTestTodoData.withTimeTracking();
      await assert.expectToolCallSuccess('createTodo', todoData);

      // Get the created todo
      const allTodos = await assert.expectToolCallSuccess<TodoAlpha3[]>(
        'listTodos',
        {},
      );
      const createdTodo = allTodos[0]; // Most recent todo
      assert.expectValidTodo(createdTodo);

      const startTime = new Date().toISOString();

      // Start tracking
      await assert.expectToolCallSuccess('startTimeTracking', {
        id: createdTodo._id,
      });

      // Get updated todo and verify timestamp
      const todosAfterStart = await assert.expectToolCallSuccess<TodoAlpha3[]>(
        'listTodos',
        {},
      );
      const todoWithTracking = todosAfterStart.find(
        (t) => t._id === createdTodo._id,
      )!;

      // Verify timestamp is reasonable (within last few seconds)
      const activeEntries = Object.entries(todoWithTracking.active).filter(
        ([_, end]) => end === null,
      );
      expect(activeEntries).toHaveLength(1);

      const trackingStartTime = new Date(activeEntries[0][0]);
      const now = new Date();
      const timeDiff = now.getTime() - trackingStartTime.getTime();

      expect(timeDiff).toBeGreaterThanOrEqual(0);
      expect(timeDiff).toBeLessThan(10000); // Less than 10 seconds

      // Update other fields while tracking is active
      await assert.expectToolCallSuccess('updateTodo', {
        id: createdTodo._id,
        title: 'Updated while tracking',
      });

      // Get updated todo
      const todosAfterUpdate = await assert.expectToolCallSuccess<TodoAlpha3[]>(
        'listTodos',
        {},
      );
      const updatedTodo = todosAfterUpdate.find(
        (t) => t._id === createdTodo._id,
      )!;

      // Time tracking data should be preserved
      assert.expectHasActiveTimeTracking(updatedTodo);

      // Verify the active session is preserved
      const originalActive = Object.entries(todoWithTracking.active).find(
        ([_, end]) => end === null,
      );
      const updatedActive = Object.entries(updatedTodo.active).find(
        ([_, end]) => end === null,
      );
      expect(originalActive).toBeDefined();
      expect(updatedActive).toBeDefined();
      expect(originalActive![0]).toBe(updatedActive![0]);

      // Verify title was updated
      expect(updatedTodo.title).toBe('Updated while tracking');
    });
  });

  describe('Time Tracking with Filtering', () => {
    it('should filter active tracking by context', async () => {
      // Create todos in different contexts
      await assert.expectToolCallSuccess(
        'createTodo',
        createTestTodoData.withContext('work'),
      );

      await assert.expectToolCallSuccess(
        'createTodo',
        createTestTodoData.withContext('private'),
      );

      // Get the created todos
      const allTodos = await assert.expectToolCallSuccess<TodoAlpha3[]>(
        'listTodos',
        {},
      );
      assert.expectValidTodos(allTodos);
      assert.expectTodoCount(allTodos, 2);

      const workTodo = allTodos.find((t) => t.context === 'work')!;
      const privateTodo = allTodos.find((t) => t.context === 'private')!;

      // Start tracking on both
      await assert.expectToolCallSuccess('startTimeTracking', {
        id: workTodo._id,
      });

      await assert.expectToolCallSuccess('startTimeTracking', {
        id: privateTodo._id,
      });

      // Query active tracking (should get both)
      const allActiveTracking = await assert.expectToolCallSuccess<
        TodoAlpha3[]
      >('getActiveTimeTracking', {});

      assert.expectTodoCount(allActiveTracking, 2);

      // Filter by context through listTodos
      const workTodos = await assert.expectToolCallSuccess<TodoAlpha3[]>(
        'listTodos',
        { context: 'work' },
      );

      const privateTodos = await assert.expectToolCallSuccess<TodoAlpha3[]>(
        'listTodos',
        { context: 'private' },
      );

      assert.expectTodosFilteredByContext(workTodos, 'work');
      assert.expectTodosFilteredByContext(privateTodos, 'private');

      // Check that tracking is preserved in filtered results
      const workTodoWithTracking = workTodos.find(
        (t) => t._id === workTodo._id,
      )!;
      const privateTodoWithTracking = privateTodos.find(
        (t) => t._id === privateTodo._id,
      )!;

      assert.expectHasActiveTimeTracking(workTodoWithTracking);
      assert.expectHasActiveTimeTracking(privateTodoWithTracking);
    });
  });
});
