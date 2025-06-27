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
      await assert.expectToolCallSuccess('createTodo', {
        title: 'Integration Test Todo',
        context: 'work',
        due: '2025-06-20',
        description: 'Full workflow test todo',
        tags: ['integration', 'workflow'],
      });

      await assert.expectToolCallSuccess('createTodo', {
        title: 'Private Task',
        context: 'private',
        due: '2025-06-21',
        tags: ['personal'],
      });

      // 2. READ: Verify creation and list todos
      const allTodos = await assert.expectToolCallSuccess<TodoAlpha3[]>('listTodos', {});
      assert.expectTodoCount(allTodos, 2);
      
      // Sort by creation time (newest first)
      allTodos.sort((a, b) => new Date(b._id).getTime() - new Date(a._id).getTime());
      const privateTodo = allTodos[0]; // Most recent (private)
      const workTodo = allTodos[1]; // Second most recent (work)

      const workTodos = await assert.expectToolCallSuccess<TodoAlpha3[]>(
        'listTodos',
        { context: 'work' }
      );
      assert.expectTodoCount(workTodos, 1);
      assert.expectTodosFilteredByContext(workTodos, 'work');

      // 3. UPDATE: Modify todo properties
      await assert.expectToolCallSuccess('updateTodo', {
        id: workTodo._id,
        description: 'Updated via MCP workflow test',
        tags: ['integration', 'workflow', 'updated'],
      });
      
      // Get updated todo
      const todosAfterUpdate = await assert.expectToolCallSuccess<TodoAlpha3[]>('listTodos', {});
      const updatedTodo = todosAfterUpdate.find(t => t._id === workTodo._id)!;

      assert.expectTodoProperties(updatedTodo, {
        description: 'Updated via MCP workflow test',
      });
      expect(updatedTodo.tags).toContain('updated');

      // 4. TIME TRACKING: Start and manage time tracking
      await assert.expectToolCallSuccess(
        'startTimeTracking',
        { id: workTodo._id }
      );
      
      // Get updated todo and verify tracking started
      const todosAfterStartTracking = await assert.expectToolCallSuccess<TodoAlpha3[]>('listTodos', {});
      const todoWithTracking = todosAfterStartTracking.find(t => t._id === workTodo._id)!;
      assert.expectHasActiveTimeTracking(todoWithTracking);

      // Check active time tracking query
      const activeTracking = await assert.expectToolCallSuccess<TodoAlpha3[]>(
        'getActiveTimeTracking',
        {}
      );
      assert.expectTodoCount(activeTracking, 1);
      expect(activeTracking[0]._id).toBe(workTodo._id);

      // Stop time tracking
      await assert.expectToolCallSuccess(
        'stopTimeTracking',
        { id: workTodo._id }
      );
      
      // Get updated todo and verify tracking stopped
      const todosAfterStopTracking = await assert.expectToolCallSuccess<TodoAlpha3[]>('listTodos', {});
      const todoAfterStop = todosAfterStopTracking.find(t => t._id === workTodo._id)!;
      assert.expectHasNoActiveTimeTracking(todoAfterStop);

      // 5. COMPLETION: Toggle completion status
      await assert.expectToolCallSuccess(
        'toggleTodoCompletion',
        { id: workTodo._id, completed: true }
      );
      
      // Get updated todo and verify completion
      const todosAfterCompletion = await assert.expectToolCallSuccess<TodoAlpha3[]>('listTodos', {});
      const completedTodo = todosAfterCompletion.find(t => t._id === workTodo._id)!;
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
      const tagStatsMarkdown = await assert.expectToolCallSuccess<string>(
        'getServerInfo',
        { section: 'tagstats' }
      );

      // Parse tag statistics from markdown format
      expect(tagStatsMarkdown).toContain('integration');
      expect(tagStatsMarkdown).toContain('workflow');
      expect(tagStatsMarkdown).toContain('updated');
      expect(tagStatsMarkdown).toContain('personal');

      // 7. DELETE: Clean up todos
      await assert.expectToolCallSuccess('deleteTodo', { id: workTodo._id });
      await assert.expectToolCallSuccess('deleteTodo', { id: privateTodo._id });

      // 8. VERIFY DELETION: Confirm todos are removed
      const finalTodos = await assert.expectToolCallSuccess<TodoAlpha3[]>('listTodos', {});
      assert.expectTodoCount(finalTodos, 0);

      // Tag stats should be updated after deletion
      const finalTagStatsMarkdown = await assert.expectToolCallSuccess<string>(
        'getServerInfo',
        { section: 'tagstats' }
      );

      // After deletion, should show no tags found
      expect(finalTagStatsMarkdown).toContain('No tags found');
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
          await assert.expectToolCallSuccess('createTodo', {
            title: `${user.prefix} Todo ${i}`,
            context: user.context,
            due: `2025-06-${20 + i}`,
            tags: [user.prefix.toLowerCase(), `task-${i}`],
          });
        }
        
        // Get the todos for this user
        const contextTodos = await assert.expectToolCallSuccess<TodoAlpha3[]>(
          'listTodos',
          { context: user.context }
        );
        // Sort by creation time (newest first) and take the 3 most recent
        contextTodos.sort((a, b) => new Date(b._id).getTime() - new Date(a._id).getTime());
        userTodos[user.prefix] = contextTodos.slice(0, 3);
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
        description: 'User1 updated this',
      });
      
      await assert.expectToolCallSuccess('startTimeTracking', {
        id: user1Todo._id,
      });

      // User2: Completes a todo
      await assert.expectToolCallSuccess('toggleTodoCompletion', {
        id: user2Todo._id,
        completed: true,
      });

      // User3: Starts time tracking
      await assert.expectToolCallSuccess('startTimeTracking', {
        id: user3Todo._id,
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
      const tagStatsMarkdown = await assert.expectToolCallSuccess<string>(
        'getServerInfo',
        { section: 'tagstats' }
      );

      // Check that user tags appear in the statistics
      expect(tagStatsMarkdown).toContain('user1');
      expect(tagStatsMarkdown).toContain('user2');
      expect(tagStatsMarkdown).toContain('user3');
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

      // Create all project todos
      for (const todoData of projectTodos) {
        await assert.expectToolCallSuccess('createTodo', todoData);
      }
      
      // Get all created todos
      const allProjectTodos = await assert.expectToolCallSuccess<TodoAlpha3[]>('listTodos', {});
      // Sort by creation time (newest first)
      allProjectTodos.sort((a, b) => new Date(b._id).getTime() - new Date(a._id).getTime());
      // Reverse to get oldest first (creation order)
      const createdTodos = allProjectTodos.reverse();

      // Sprint 1: Focus on planning and design
      const sprint1Tasks = createdTodos.slice(0, 2);
      
      // Start time tracking for planning
      await assert.expectToolCallSuccess('startTimeTracking', {
        id: sprint1Tasks[0]._id,
      });

      // Complete planning task
      await assert.expectToolCallSuccess('toggleTodoCompletion', {
        id: sprint1Tasks[0]._id,
        completed: true,
      });

      // Stop time tracking for completed task
      await assert.expectToolCallSuccess('stopTimeTracking', {
        id: sprint1Tasks[0]._id,
      });

      // Work on design
      await assert.expectToolCallSuccess('startTimeTracking', {
        id: sprint1Tasks[1]._id,
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
      });
      
      await assert.expectToolCallSuccess('toggleTodoCompletion', {
        id: sprint1Tasks[1]._id,
        completed: true,
      });

      // Start backend development
      await assert.expectToolCallSuccess('startTimeTracking', {
        id: developmentTasks[0]._id,
      });

      // Project analytics
      const projectStatsMarkdown = await assert.expectToolCallSuccess<string>(
        'getServerInfo',
        { section: 'tagstats' }
      );

      // Check that project tags appear in the statistics
      expect(projectStatsMarkdown).toContain('project-alpha');
      expect(projectStatsMarkdown).toContain('development');
      expect(projectStatsMarkdown).toContain('planning');
      expect(projectStatsMarkdown).toContain('design');
      expect(projectStatsMarkdown).toContain('testing');

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
      // Get current todo states
      const currentTodos = await assert.expectToolCallSuccess<TodoAlpha3[]>('listTodos', {});
      
      for (const todo of currentTodos) {
        if (todo.completed === null) {
          await assert.expectToolCallSuccess('toggleTodoCompletion', {
            id: todo._id,
            completed: true,
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
      await assert.expectToolCallSuccess('createTodo', {
        title: 'Error Recovery Test',
        context: 'work',
        due: '2025-06-25',
      });
      
      // Get the created todo
      const createdTodos = await assert.expectToolCallSuccess<TodoAlpha3[]>('listTodos', {});
      const validTodo = createdTodos[0];

      // Try operations with invalid IDs and recover
      const invalidId = 'invalid-id-format';
      
      // These should fail gracefully
      await assert.expectToolCallError('updateTodo', {
        id: invalidId,
        title: 'Should fail',
      });

      await assert.expectToolCallError('startTimeTracking', {
        id: invalidId,
      });

      // Valid operations should still work after errors
      await assert.expectToolCallSuccess('updateTodo', {
        id: validTodo._id,
        description: 'Updated after error recovery',
      });
      
      // Get updated todo and verify
      const todosAfterUpdate = await assert.expectToolCallSuccess<TodoAlpha3[]>('listTodos', {});
      const updatedTodo = todosAfterUpdate.find(t => t._id === validTodo._id)!;
      expect(updatedTodo.description).toBe('Updated after error recovery');

      // Try to complete non-existent todo then complete valid one
      await assert.expectToolCallError('toggleTodoCompletion', {
        id: '2025-01-01T00:00:00.000Z',
        completed: true,
      });

      await assert.expectToolCallSuccess(
        'toggleTodoCompletion',
        { id: validTodo._id, completed: true }
      );
      
      // Get updated todo and verify completion
      const todosAfterCompletion = await assert.expectToolCallSuccess<TodoAlpha3[]>('listTodos', {});
      const completedTodo = todosAfterCompletion.find(t => t._id === validTodo._id)!;
      expect(completedTodo.completed).not.toBeNull();

      // System should remain in consistent state
      const finalTodos = await assert.expectToolCallSuccess<TodoAlpha3[]>('listTodos', {});
      assert.expectTodoCount(finalTodos, 1);
      assert.expectValidTodos(finalTodos);
    });
  });
});