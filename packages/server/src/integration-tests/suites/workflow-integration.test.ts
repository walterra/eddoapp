/**
 * Complete Workflow Integration Tests
 * Tests realistic end-to-end workflows based on MCP-CRUD.md scenarios
 */

import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import { MCPTestServer } from '../setup/test-server.js';
import { createMCPAssertions } from '../helpers/mcp-assertions.js';
import { createTestTodoData } from '../__fixtures__/todo-factory.js';
import type { TodoAlpha3 } from '../helpers/mcp-assertions.js';

describe('MCP Complete Workflow Integration', () => {
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

  describe('Complete Todo Management Workflow', () => {
    it('should execute full todo lifecycle workflow from MCP-CRUD.md', async () => {
      // 1. CREATE: Create initial todos
      const workTodo = await assert.expectToolCallSuccess<TodoAlpha3>('createTodo', {
        title: 'Integration Test Todo',
        context: 'work',
        due: '2025-06-20',
        description: 'Full workflow test todo',
        tags: ['integration', 'workflow'],
      });

      const privateTodo = await assert.expectToolCallSuccess<TodoAlpha3>('createTodo', {
        title: 'Private Task',
        context: 'private',
        due: '2025-06-21',
        tags: ['personal'],
      });

      // 2. READ: Verify creation and list todos
      const allTodos = await assert.expectToolCallSuccess<TodoAlpha3[]>('listTodos', {});
      assert.expectTodoCount(allTodos, 2);

      const workTodos = await assert.expectToolCallSuccess<TodoAlpha3[]>(
        'listTodos',
        { context: 'work' }
      );
      assert.expectTodoCount(workTodos, 1);
      assert.expectTodosFilteredByContext(workTodos, 'work');

      // 3. UPDATE: Modify todo properties
      const updatedTodo = await assert.expectToolCallSuccess<TodoAlpha3>('updateTodo', {
        id: workTodo._id,
        updates: {
          description: 'Updated via MCP workflow test',
          tags: ['integration', 'workflow', 'updated'],
        },
      });

      assert.expectTodoProperties(updatedTodo, {
        description: 'Updated via MCP workflow test',
      });
      expect(updatedTodo.tags).toContain('updated');

      // 4. TIME TRACKING: Start and manage time tracking
      const todoWithTracking = await assert.expectToolCallSuccess<TodoAlpha3>(
        'startTimeTracking',
        { id: workTodo._id, category: 'testing' }
      );

      assert.expectActiveTimeTracking(todoWithTracking, ['testing']);

      // Check active time tracking query
      const activeTracking = await assert.expectToolCallSuccess<TodoAlpha3[]>(
        'getActiveTimeTracking',
        {}
      );
      assert.expectTodoCount(activeTracking, 1);
      expect(activeTracking[0]._id).toBe(workTodo._id);

      // Stop time tracking
      const todoAfterStop = await assert.expectToolCallSuccess<TodoAlpha3>(
        'stopTimeTracking',
        { id: workTodo._id, category: 'testing' }
      );

      assert.expectInactiveTimeTracking(todoAfterStop, ['testing']);

      // 5. COMPLETION: Toggle completion status
      const completedTodo = await assert.expectToolCallSuccess<TodoAlpha3>(
        'toggleTodoCompletion',
        { id: workTodo._id }
      );

      expect(completedTodo.completed).not.toBeNull();

      // Verify completion filtering
      const completedTodos = await assert.expectToolCallSuccess<TodoAlpha3[]>(
        'listTodos',
        { completed: true }
      );
      assert.expectTodoCount(completedTodos, 1);
      assert.expectTodosFilteredByCompletion(completedTodos, true);

      const activeTodos = await assert.expectToolCallSuccess<TodoAlpha3[]>(
        'listTodos',
        { completed: false }
      );
      assert.expectTodoCount(activeTodos, 1);
      expect(activeTodos[0]._id).toBe(privateTodo._id);

      // 6. ANALYTICS: Check tag statistics
      const tagStats = await assert.expectToolCallSuccess(
        'getServerInfo',
        { section: 'tagstats' }
      );

      expect(tagStats.integration).toBe(1);
      expect(tagStats.workflow).toBe(1);
      expect(tagStats.updated).toBe(1);
      expect(tagStats.personal).toBe(1);

      // 7. DELETE: Clean up todos
      await assert.expectToolCallSuccess('deleteTodo', { id: workTodo._id });
      await assert.expectToolCallSuccess('deleteTodo', { id: privateTodo._id });

      // 8. VERIFY DELETION: Confirm todos are removed
      const finalTodos = await assert.expectToolCallSuccess<TodoAlpha3[]>('listTodos', {});
      assert.expectTodoCount(finalTodos, 0);

      // Tag stats should be updated after deletion
      const finalTagStats = await assert.expectToolCallSuccess(
        'getServerInfo',
        { section: 'tagstats' }
      );

      // All tags should be removed or have zero counts
      for (const count of Object.values(finalTagStats)) {
        if (count !== undefined) {
          expect(count).toBe(0);
        }
      }
    });
  });

  describe('Multi-User Simulation Workflow', () => {
    it('should handle concurrent workflows without conflicts', async () => {
      // Simulate multiple users working with different contexts
      const users = [
        { context: 'work', prefix: 'User1' },
        { context: 'private', prefix: 'User2' },
        { context: 'personal', prefix: 'User3' },
      ];

      const userTodos: Record<string, TodoAlpha3[]> = {};

      // Each user creates their todos
      for (const user of users) {
        userTodos[user.prefix] = [];
        
        for (let i = 1; i <= 3; i++) {
          const todo = await assert.expectToolCallSuccess<TodoAlpha3>('createTodo', {
            title: `${user.prefix} Todo ${i}`,
            context: user.context,
            due: `2025-06-${20 + i}`,
            tags: [user.prefix.toLowerCase(), `task-${i}`],
          });
          userTodos[user.prefix].push(todo);
        }
      }

      // Verify each user sees only their context
      for (const user of users) {
        const contextTodos = await assert.expectToolCallSuccess<TodoAlpha3[]>(
          'listTodos',
          { context: user.context }
        );
        
        assert.expectTodoCount(contextTodos, 3);
        assert.expectTodosFilteredByContext(contextTodos, user.context);
      }

      // Users perform different operations simultaneously
      const user1Todo = userTodos['User1'][0];
      const user2Todo = userTodos['User2'][0];
      const user3Todo = userTodos['User3'][0];

      // User1: Updates and starts time tracking
      await assert.expectToolCallSuccess('updateTodo', {
        id: user1Todo._id,
        updates: { description: 'User1 updated this' },
      });
      
      await assert.expectToolCallSuccess('startTimeTracking', {
        id: user1Todo._id,
        category: 'work-focus',
      });

      // User2: Completes a todo
      await assert.expectToolCallSuccess('toggleTodoCompletion', {
        id: user2Todo._id,
      });

      // User3: Starts time tracking different category
      await assert.expectToolCallSuccess('startTimeTracking', {
        id: user3Todo._id,
        category: 'personal-time',
      });

      // Verify operations didn't interfere
      const activeTracking = await assert.expectToolCallSuccess<TodoAlpha3[]>(
        'getActiveTimeTracking',
        {}
      );
      assert.expectTodoCount(activeTracking, 2);

      const completedTodos = await assert.expectToolCallSuccess<TodoAlpha3[]>(
        'listTodos',
        { completed: true }
      );
      assert.expectTodoCount(completedTodos, 1);
      expect(completedTodos[0]._id).toBe(user2Todo._id);

      // Tag statistics should include all users
      const tagStats = await assert.expectToolCallSuccess(
        'getServerInfo',
        { section: 'tagstats' }
      );

      expect(tagStats.user1).toBe(3);
      expect(tagStats.user2).toBe(3);
      expect(tagStats.user3).toBe(3);
    });
  });

  describe('Project Management Workflow', () => {
    it('should support realistic project management scenario', async () => {
      // Project setup phase
      const projectTodos = [
        {
          title: 'Project Planning',
          context: 'work',
          due: '2025-06-20',
          tags: ['project-alpha', 'planning', 'urgent'],
          description: 'Initial project planning and requirements gathering',
        },
        {
          title: 'Design Wireframes',
          context: 'work',
          due: '2025-06-22',
          tags: ['project-alpha', 'design'],
          description: 'Create wireframes for user interface',
        },
        {
          title: 'Backend API Development',
          context: 'work',
          due: '2025-06-25',
          tags: ['project-alpha', 'development', 'backend'],
          description: 'Implement REST API endpoints',
        },
        {
          title: 'Frontend Implementation',
          context: 'work',
          due: '2025-06-28',
          tags: ['project-alpha', 'development', 'frontend'],
          description: 'Build user interface components',
        },
        {
          title: 'Testing and QA',
          context: 'work',
          due: '2025-06-30',
          tags: ['project-alpha', 'testing', 'qa'],
          description: 'Comprehensive testing and quality assurance',
        },
      ];

      const createdTodos: TodoAlpha3[] = [];
      for (const todoData of projectTodos) {
        const todo = await assert.expectToolCallSuccess<TodoAlpha3>('createTodo', todoData);
        createdTodos.push(todo);
      }

      // Sprint 1: Focus on planning and design
      const sprint1Tasks = createdTodos.slice(0, 2);
      
      // Start time tracking for planning
      await assert.expectToolCallSuccess('startTimeTracking', {
        id: sprint1Tasks[0]._id,
        category: 'planning',
      });

      // Complete planning task
      await assert.expectToolCallSuccess('toggleTodoCompletion', {
        id: sprint1Tasks[0]._id,
      });

      // Stop time tracking for completed task
      await assert.expectToolCallSuccess('stopTimeTracking', {
        id: sprint1Tasks[0]._id,
        category: 'planning',
      });

      // Work on design
      await assert.expectToolCallSuccess('startTimeTracking', {
        id: sprint1Tasks[1]._id,
        category: 'design',
      });

      // Sprint 1 review: Check progress
      const completedSprint1 = await assert.expectToolCallSuccess<TodoAlpha3[]>(
        'listTodos',
        { completed: true }
      );
      assert.expectTodoCount(completedSprint1, 1);

      const activeSprint1 = await assert.expectToolCallSuccess<TodoAlpha3[]>(
        'listTodos',
        { completed: false }
      );
      assert.expectTodoCount(activeSprint1, 4);

      // Sprint 2: Development phase
      const developmentTasks = createdTodos.slice(2, 4);
      
      // Complete design and start backend development
      await assert.expectToolCallSuccess('stopTimeTracking', {
        id: sprint1Tasks[1]._id,
        category: 'design',
      });
      
      await assert.expectToolCallSuccess('toggleTodoCompletion', {
        id: sprint1Tasks[1]._id,
      });

      // Start backend development
      await assert.expectToolCallSuccess('startTimeTracking', {
        id: developmentTasks[0]._id,
        category: 'backend-dev',
      });

      // Project analytics
      const projectStats = await assert.expectToolCallSuccess(
        'getServerInfo',
        { section: 'tagstats' }
      );

      expect(projectStats['project-alpha']).toBe(5);
      expect(projectStats.development).toBe(2);
      expect(projectStats.planning).toBe(1);
      expect(projectStats.design).toBe(1);
      expect(projectStats.testing).toBe(1);

      // Filter project tasks by development status
      const completedTasks = await assert.expectToolCallSuccess<TodoAlpha3[]>(
        'listTodos',
        { completed: true }
      );
      
      const inProgressTasks = await assert.expectToolCallSuccess<TodoAlpha3[]>(
        'getActiveTimeTracking',
        {}
      );

      // Project status verification
      assert.expectTodoCount(completedTasks, 2); // Planning and design completed
      assert.expectTodoCount(inProgressTasks, 1); // Backend development in progress

      // Simulate project completion
      for (const todo of createdTodos) {
        if (todo.completed === null) {
          await assert.expectToolCallSuccess('toggleTodoCompletion', {
            id: todo._id,
          });
        }
      }

      // Final project status
      const finalCompleted = await assert.expectToolCallSuccess<TodoAlpha3[]>(
        'listTodos',
        { completed: true }
      );
      assert.expectTodoCount(finalCompleted, 5);

      const finalActive = await assert.expectToolCallSuccess<TodoAlpha3[]>(
        'listTodos',
        { completed: false }
      );
      assert.expectTodoCount(finalActive, 0);
    });
  });

  describe('Error Recovery Workflow', () => {
    it('should handle and recover from various error conditions', async () => {
      // Create a valid todo
      const validTodo = await assert.expectToolCallSuccess<TodoAlpha3>('createTodo', {
        title: 'Error Recovery Test',
        context: 'work',
        due: '2025-06-25',
      });

      // Try operations with invalid IDs and recover
      const invalidId = 'invalid-id-format';
      
      // These should fail gracefully
      await assert.expectToolCallError('updateTodo', {
        id: invalidId,
        updates: { title: 'Should fail' },
      });

      await assert.expectToolCallError('startTimeTracking', {
        id: invalidId,
        category: 'should-fail',
      });

      // Valid operations should still work after errors
      const updatedTodo = await assert.expectToolCallSuccess<TodoAlpha3>('updateTodo', {
        id: validTodo._id,
        updates: { description: 'Updated after error recovery' },
      });

      expect(updatedTodo.description).toBe('Updated after error recovery');

      // Try to complete non-existent todo then complete valid one
      await assert.expectToolCallError('toggleTodoCompletion', {
        id: '2025-01-01T00:00:00.000Z',
      });

      const completedTodo = await assert.expectToolCallSuccess<TodoAlpha3>(
        'toggleTodoCompletion',
        { id: validTodo._id }
      );

      expect(completedTodo.completed).not.toBeNull();

      // System should remain in consistent state
      const allTodos = await assert.expectToolCallSuccess<TodoAlpha3[]>('listTodos', {});
      assert.expectTodoCount(allTodos, 1);
      assert.expectValidTodos(allTodos);
    });
  });
});