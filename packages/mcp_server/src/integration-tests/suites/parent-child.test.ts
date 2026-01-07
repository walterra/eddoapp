/**
 * Integration tests for parent-child todo relationships in MCP server
 * Tests subtask creation, querying, and hierarchy management
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { TodoAlpha3 } from '../helpers/mcp-assertions.js';
import { createMCPAssertions } from '../helpers/mcp-assertions.js';
import { MCPTestServer } from '../setup/test-server.js';

describe('Parent-Child Todo Relationships', () => {
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

  describe('createTodo with parentId', () => {
    it('should create a subtask with parent reference', async () => {
      // Create parent todo
      const parentResult = await assert.expectToolCallSuccess<{ data: { id: string } }>(
        'createTodo',
        {
          title: 'Build feature X',
          description: 'Main project task',
          context: 'work',
          tags: ['gtd:project'],
        },
      );

      const parentId = parentResult.data.id;

      // Create subtask
      await assert.expectToolCallSuccess('createTodo', {
        title: 'Write unit tests',
        description: 'Subtask of Build feature X',
        context: 'work',
        tags: ['gtd:next'],
        parentId,
      });

      // Verify subtask was created with parentId
      const todos = await assert.expectToolCallSuccess<TodoAlpha3[]>('listTodos', {
        parentId,
      });

      expect(todos).toHaveLength(1);
      expect(todos[0].title).toBe('Write unit tests');
      expect(todos[0].parentId).toBe(parentId);
    });

    it('should create todo without parentId (root-level)', async () => {
      await assert.expectToolCallSuccess('createTodo', {
        title: 'Standalone task',
        context: 'private',
      });

      const todos = await assert.expectToolCallSuccess<TodoAlpha3[]>('listTodos', {
        context: 'private',
      });

      const task = todos.find((t) => t.title === 'Standalone task');
      expect(task).toBeDefined();
      expect(task!.parentId == null).toBe(true); // null or undefined
    });

    it('should create multiple subtasks under same parent', async () => {
      // Create parent
      const parentResult = await assert.expectToolCallSuccess<{ data: { id: string } }>(
        'createTodo',
        {
          title: 'Release v2.0',
          context: 'work',
          tags: ['gtd:project'],
        },
      );

      const parentId = parentResult.data.id;

      // Create multiple subtasks
      await assert.expectToolCallSuccess('createTodo', {
        title: 'Update changelog',
        context: 'work',
        parentId,
      });

      await assert.expectToolCallSuccess('createTodo', {
        title: 'Run integration tests',
        context: 'work',
        parentId,
      });

      await assert.expectToolCallSuccess('createTodo', {
        title: 'Deploy to staging',
        context: 'work',
        parentId,
      });

      // Query children
      const children = await assert.expectToolCallSuccess<TodoAlpha3[]>('listTodos', {
        parentId,
      });

      expect(children).toHaveLength(3);
      expect(children.every((c) => c.parentId === parentId)).toBe(true);
    });
  });

  describe('listTodos with parentId filter', () => {
    it('should filter by exact parentId match', async () => {
      // Create two parent todos
      const parent1Result = await assert.expectToolCallSuccess<{ data: { id: string } }>(
        'createTodo',
        {
          title: 'Project A',
          context: 'work',
        },
      );

      const parent2Result = await assert.expectToolCallSuccess<{ data: { id: string } }>(
        'createTodo',
        {
          title: 'Project B',
          context: 'work',
        },
      );

      // Create subtasks for each
      await assert.expectToolCallSuccess('createTodo', {
        title: 'Task A1',
        context: 'work',
        parentId: parent1Result.data.id,
      });

      await assert.expectToolCallSuccess('createTodo', {
        title: 'Task B1',
        context: 'work',
        parentId: parent2Result.data.id,
      });

      // Query children of Project A only
      const childrenA = await assert.expectToolCallSuccess<TodoAlpha3[]>('listTodos', {
        parentId: parent1Result.data.id,
      });

      expect(childrenA).toHaveLength(1);
      expect(childrenA[0].title).toBe('Task A1');
    });

    it('should return empty array when parent has no children', async () => {
      const parentResult = await assert.expectToolCallSuccess<{ data: { id: string } }>(
        'createTodo',
        {
          title: 'Empty parent',
          context: 'work',
        },
      );

      const children = await assert.expectToolCallSuccess<TodoAlpha3[]>('listTodos', {
        parentId: parentResult.data.id,
      });

      expect(children).toHaveLength(0);
    });

    it('should combine parentId filter with other filters', async () => {
      const parentResult = await assert.expectToolCallSuccess<{ data: { id: string } }>(
        'createTodo',
        {
          title: 'Parent project',
          context: 'work',
        },
      );

      const parentId = parentResult.data.id;

      // Create subtasks with different tags
      await assert.expectToolCallSuccess('createTodo', {
        title: 'Next action subtask',
        context: 'work',
        tags: ['gtd:next'],
        parentId,
      });

      await assert.expectToolCallSuccess('createTodo', {
        title: 'Waiting subtask',
        context: 'work',
        tags: ['gtd:waiting'],
        parentId,
      });

      // Filter by parentId + tags
      const nextActions = await assert.expectToolCallSuccess<TodoAlpha3[]>('listTodos', {
        parentId,
        tags: ['gtd:next'],
      });

      expect(nextActions).toHaveLength(1);
      expect(nextActions[0].title).toBe('Next action subtask');
    });
  });

  describe('updateTodo with parentId', () => {
    it('should update parentId to move subtask to different parent', async () => {
      // Create two parents
      const parent1Result = await assert.expectToolCallSuccess<{ data: { id: string } }>(
        'createTodo',
        {
          title: 'Old parent',
          context: 'work',
        },
      );

      const parent2Result = await assert.expectToolCallSuccess<{ data: { id: string } }>(
        'createTodo',
        {
          title: 'New parent',
          context: 'work',
        },
      );

      // Create subtask under first parent
      const subtaskResult = await assert.expectToolCallSuccess<{ data: { id: string } }>(
        'createTodo',
        {
          title: 'Movable task',
          context: 'work',
          parentId: parent1Result.data.id,
        },
      );

      // Move to second parent
      await assert.expectToolCallSuccess('updateTodo', {
        id: subtaskResult.data.id,
        parentId: parent2Result.data.id,
      });

      // Verify move
      const oldParentChildren = await assert.expectToolCallSuccess<TodoAlpha3[]>('listTodos', {
        parentId: parent1Result.data.id,
      });
      expect(oldParentChildren).toHaveLength(0);

      const newParentChildren = await assert.expectToolCallSuccess<TodoAlpha3[]>('listTodos', {
        parentId: parent2Result.data.id,
      });
      expect(newParentChildren).toHaveLength(1);
      expect(newParentChildren[0].title).toBe('Movable task');
    });

    it('should remove parentId to make subtask a root todo', async () => {
      const parentResult = await assert.expectToolCallSuccess<{ data: { id: string } }>(
        'createTodo',
        {
          title: 'Parent',
          context: 'work',
        },
      );

      const subtaskResult = await assert.expectToolCallSuccess<{ data: { id: string } }>(
        'createTodo',
        {
          title: 'Will become root',
          context: 'work',
          parentId: parentResult.data.id,
        },
      );

      // Remove parent by setting to null
      await assert.expectToolCallSuccess('updateTodo', {
        id: subtaskResult.data.id,
        parentId: null,
      });

      // Verify no longer under parent
      const children = await assert.expectToolCallSuccess<TodoAlpha3[]>('listTodos', {
        parentId: parentResult.data.id,
      });
      expect(children).toHaveLength(0);

      // Verify todo still exists
      const todoResponse = await assert.expectToolCallSuccess<{ data: TodoAlpha3 }>('getTodo', {
        id: subtaskResult.data.id,
      });
      expect(todoResponse.data.title).toBe('Will become root');
      expect(todoResponse.data.parentId == null).toBe(true);
    });

    it('should add parentId to existing root todo', async () => {
      // Create root todo first
      const rootResult = await assert.expectToolCallSuccess<{ data: { id: string } }>(
        'createTodo',
        {
          title: 'Originally root',
          context: 'work',
        },
      );

      // Create parent
      const parentResult = await assert.expectToolCallSuccess<{ data: { id: string } }>(
        'createTodo',
        {
          title: 'New parent',
          context: 'work',
        },
      );

      // Add parentId
      await assert.expectToolCallSuccess('updateTodo', {
        id: rootResult.data.id,
        parentId: parentResult.data.id,
      });

      // Verify
      const children = await assert.expectToolCallSuccess<TodoAlpha3[]>('listTodos', {
        parentId: parentResult.data.id,
      });
      expect(children).toHaveLength(1);
      expect(children[0].title).toBe('Originally root');
    });
  });

  describe('Backwards compatibility', () => {
    it('should handle todos without parentId field', async () => {
      // Create todo without parentId
      await assert.expectToolCallSuccess('createTodo', {
        title: 'Legacy todo',
        context: 'private',
      });

      const todos = await assert.expectToolCallSuccess<TodoAlpha3[]>('listTodos', {
        context: 'private',
      });

      const legacy = todos.find((t) => t.title === 'Legacy todo');
      expect(legacy).toBeDefined();
      expect(legacy!.parentId == null).toBe(true); // null or undefined
      expect(legacy!.version).toBe('alpha3');
    });

    it('should list todos with and without parentId together', async () => {
      const parentResult = await assert.expectToolCallSuccess<{ data: { id: string } }>(
        'createTodo',
        {
          title: 'Parent task',
          context: 'work',
        },
      );

      await assert.expectToolCallSuccess('createTodo', {
        title: 'Child task',
        context: 'work',
        parentId: parentResult.data.id,
      });

      await assert.expectToolCallSuccess('createTodo', {
        title: 'Root task',
        context: 'work',
      });

      const todos = await assert.expectToolCallSuccess<TodoAlpha3[]>('listTodos', {
        context: 'work',
      });

      expect(todos.length).toBeGreaterThanOrEqual(3);

      const withParent = todos.filter((t) => t.parentId);
      const withoutParent = todos.filter((t) => !t.parentId);

      expect(withParent.length).toBeGreaterThanOrEqual(1);
      expect(withoutParent.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Nested hierarchies', () => {
    it('should support multi-level nesting (grandchildren)', async () => {
      // Create grandparent
      const grandparentResult = await assert.expectToolCallSuccess<{ data: { id: string } }>(
        'createTodo',
        {
          title: 'Epic: Complete redesign',
          context: 'work',
          tags: ['gtd:project'],
        },
      );

      // Create parent (child of grandparent)
      const parentResult = await assert.expectToolCallSuccess<{ data: { id: string } }>(
        'createTodo',
        {
          title: 'Story: Implement header',
          context: 'work',
          tags: ['gtd:project'],
          parentId: grandparentResult.data.id,
        },
      );

      // Create child (grandchild)
      await assert.expectToolCallSuccess('createTodo', {
        title: 'Task: Style navigation',
        context: 'work',
        tags: ['gtd:next'],
        parentId: parentResult.data.id,
      });

      // Verify each level
      const children = await assert.expectToolCallSuccess<TodoAlpha3[]>('listTodos', {
        parentId: grandparentResult.data.id,
      });
      expect(children).toHaveLength(1);
      expect(children[0].title).toBe('Story: Implement header');

      const grandchildren = await assert.expectToolCallSuccess<TodoAlpha3[]>('listTodos', {
        parentId: parentResult.data.id,
      });
      expect(grandchildren).toHaveLength(1);
      expect(grandchildren[0].title).toBe('Task: Style navigation');
    });
  });
});
