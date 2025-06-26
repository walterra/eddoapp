/**
 * CRUD Lifecycle Integration Tests
 * Tests the complete create → read → update → delete cycle
 */

import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import { MCPTestServer } from '../setup/test-server.js';
import { createMCPAssertions } from '../helpers/mcp-assertions.js';
import { createTestTodoData, invalidTestData } from '../__fixtures__/todo-factory.js';
import type { TodoAlpha3 } from '../helpers/mcp-assertions.js';

describe('MCP CRUD Lifecycle Integration', () => {
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

  describe('Basic CRUD Operations', () => {
    it('should complete full create → read → update → delete cycle', async () => {
      // 1. CREATE: Create a basic todo
      const todoData = createTestTodoData.basic();
      const createdTodo = await assert.expectToolCallSuccess<TodoAlpha3>('createTodo', todoData);
      
      assert.expectValidTodo(createdTodo);
      assert.expectTodoProperties(createdTodo, {
        title: todoData.title,
        context: todoData.context,
        due: todoData.due,
      });

      // 2. READ: Verify todo exists
      const allTodos = await assert.expectToolCallSuccess<TodoAlpha3[]>('listTodos', {});
      assert.expectValidTodos(allTodos);
      assert.expectTodoCount(allTodos, 1);
      
      const foundTodo = allTodos.find(t => t._id === createdTodo._id);
      expect(foundTodo).toBeDefined();

      // 3. UPDATE: Modify the todo
      const updates = {
        title: 'Updated Test Todo',
        description: 'Added description via update',
        tags: ['updated', 'integration-test'],
      };
      
      const updatedTodo = await assert.expectToolCallSuccess<TodoAlpha3>(
        'updateTodo',
        { id: createdTodo._id, updates }
      );
      
      assert.expectValidTodo(updatedTodo);
      assert.expectTodoProperties(updatedTodo, updates);

      // 4. DELETE: Remove the todo
      await assert.expectToolCallSuccess('deleteTodo', { id: createdTodo._id });
      
      // 5. VERIFY DELETION: Todo should no longer exist
      const todosAfterDelete = await assert.expectToolCallSuccess<TodoAlpha3[]>('listTodos', {});
      assert.expectTodoCount(todosAfterDelete, 0);
    });

    it('should handle todo completion toggling', async () => {
      // Create todo
      const todoData = createTestTodoData.forCompletion();
      const createdTodo = await assert.expectToolCallSuccess<TodoAlpha3>('createTodo', todoData);
      
      expect(createdTodo.completed).toBeNull();

      // Toggle to completed
      const completedTodo = await assert.expectToolCallSuccess<TodoAlpha3>(
        'toggleTodoCompletion',
        { id: createdTodo._id }
      );
      
      assert.expectValidTodo(completedTodo);
      expect(completedTodo.completed).not.toBeNull();
      expect(new Date(completedTodo.completed!)).toBeInstanceOf(Date);

      // Toggle back to incomplete
      const incompleteTodo = await assert.expectToolCallSuccess<TodoAlpha3>(
        'toggleTodoCompletion',
        { id: createdTodo._id }
      );
      
      expect(incompleteTodo.completed).toBeNull();
    });

    it('should handle repeating todos on completion', async () => {
      // Create repeating todo
      const todoData = createTestTodoData.repeating();
      const createdTodo = await assert.expectToolCallSuccess<TodoAlpha3>('createTodo', todoData);
      
      expect(createdTodo.repeat).toBe(1);

      // Complete the repeating todo
      await assert.expectToolCallSuccess('toggleTodoCompletion', { id: createdTodo._id });

      // Should create a new todo for next occurrence
      const allTodos = await assert.expectToolCallSuccess<TodoAlpha3[]>('listTodos', {});
      
      // Should have both completed original and new instance
      const incompleteTodos = allTodos.filter(t => t.completed === null);
      const completedTodos = allTodos.filter(t => t.completed !== null);
      
      expect(completedTodos).toHaveLength(1);
      expect(incompleteTodos).toHaveLength(1);
      
      // New todo should have updated due date
      const newTodo = incompleteTodos[0];
      const originalDueDate = new Date(createdTodo.due);
      const newDueDate = new Date(newTodo.due);
      
      expect(newDueDate.getTime()).toBeGreaterThan(originalDueDate.getTime());
    });
  });

  describe('Batch Operations', () => {
    it('should handle multiple todo creation and operations', async () => {
      // Create multiple todos
      const batchData = createTestTodoData.batch(5, 'Batch Test');
      const createdTodos: TodoAlpha3[] = [];
      
      for (const todoData of batchData) {
        const todo = await assert.expectToolCallSuccess<TodoAlpha3>('createTodo', todoData);
        createdTodos.push(todo);
      }

      // Verify all were created
      const allTodos = await assert.expectToolCallSuccess<TodoAlpha3[]>('listTodos', {});
      assert.expectTodoCount(allTodos, 5);

      // Update multiple todos
      for (let i = 0; i < 3; i++) {
        await assert.expectToolCallSuccess('updateTodo', {
          id: createdTodos[i]._id,
          updates: { description: `Updated description ${i + 1}` },
        });
      }

      // Complete some todos
      for (let i = 0; i < 2; i++) {
        await assert.expectToolCallSuccess('toggleTodoCompletion', {
          id: createdTodos[i]._id,
        });
      }

      // Verify completion status
      const finalTodos = await assert.expectToolCallSuccess<TodoAlpha3[]>('listTodos', {});
      const completedCount = finalTodos.filter(t => t.completed !== null).length;
      const activeCount = finalTodos.filter(t => t.completed === null).length;
      
      expect(completedCount).toBe(2);
      expect(activeCount).toBe(3);

      // Clean up remaining todos
      for (const todo of createdTodos) {
        await assert.expectToolCallSuccess('deleteTodo', { id: todo._id });
      }
    });
  });

  describe('Data Consistency', () => {
    it('should maintain data integrity across operations', async () => {
      // Create todo with all fields
      const todoData = createTestTodoData.complete();
      const createdTodo = await assert.expectToolCallSuccess<TodoAlpha3>('createTodo', todoData);
      
      // Verify all data is preserved
      assert.expectTodoProperties(createdTodo, {
        title: todoData.title,
        context: todoData.context,
        due: todoData.due,
        description: todoData.description,
        link: todoData.link,
        repeat: todoData.repeat,
      });
      
      expect(createdTodo.tags).toEqual(expect.arrayContaining(todoData.tags!));

      // Update partial fields and verify others remain unchanged
      const updates = { title: 'New Title Only' };
      const updatedTodo = await assert.expectToolCallSuccess<TodoAlpha3>(
        'updateTodo',
        { id: createdTodo._id, updates }
      );
      
      // Updated field should change
      expect(updatedTodo.title).toBe(updates.title);
      
      // Other fields should remain the same
      expect(updatedTodo.context).toBe(createdTodo.context);
      expect(updatedTodo.due).toBe(createdTodo.due);
      expect(updatedTodo.description).toBe(createdTodo.description);
      expect(updatedTodo.link).toBe(createdTodo.link);
      expect(updatedTodo.repeat).toBe(createdTodo.repeat);
      expect(updatedTodo.tags).toEqual(createdTodo.tags);
    });
  });

  describe('Error Handling', () => {
    it('should reject invalid todo creation', async () => {
      // Missing required fields
      await assert.expectToolCallError('createTodo', invalidTestData.missingTitle);
      await assert.expectToolCallError('createTodo', invalidTestData.missingContext);
      await assert.expectToolCallError('createTodo', invalidTestData.missingDue);
      
      // Invalid field values
      await assert.expectToolCallError('createTodo', invalidTestData.invalidContext);
      await assert.expectToolCallError('createTodo', invalidTestData.invalidDate);
      await assert.expectToolCallError('createTodo', invalidTestData.invalidRepeat);
    });

    it('should reject operations on non-existent todos', async () => {
      const nonExistentId = '2025-01-01T00:00:00.000Z';
      
      await assert.expectToolCallError('updateTodo', {
        id: nonExistentId,
        updates: { title: 'Should fail' },
      });
      
      await assert.expectToolCallError('toggleTodoCompletion', {
        id: nonExistentId,
      });
      
      await assert.expectToolCallError('deleteTodo', {
        id: nonExistentId,
      });
    });

    it('should reject invalid todo IDs', async () => {
      const invalidIds = ['invalid-id', '', 'not-a-timestamp', '123'];
      
      for (const invalidId of invalidIds) {
        await assert.expectToolCallError('updateTodo', {
          id: invalidId,
          updates: { title: 'Should fail' },
        });
      }
    });
  });
});