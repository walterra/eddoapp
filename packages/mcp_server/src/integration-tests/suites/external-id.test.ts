/**
 * Integration tests for externalId support in MCP server
 * Tests GitHub issue sync use case
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { TodoAlpha3 } from '../helpers/mcp-assertions.js';
import { createMCPAssertions } from '../helpers/mcp-assertions.js';
import { MCPTestServer } from '../setup/test-server.js';

describe('External ID Support', () => {
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
  describe('createTodo with externalId', () => {
    it('should create todo with GitHub issue external ID', async () => {
      // Create todo with externalId
      await assert.expectToolCallSuccess('createTodo', {
        title: 'Fix login bug',
        description: 'Users cannot login with special characters in password',
        context: 'work',
        tags: ['bug', 'gtd:next'],
        externalId: 'github:walterra/eddoapp/issues/123',
      });

      // Verify by querying with externalId filter
      const todos = await assert.expectToolCallSuccess<TodoAlpha3[]>('listTodos', {
        externalId: 'github:walterra/eddoapp/issues/123',
      });

      expect(todos).toHaveLength(1);
      expect(todos[0].title).toBe('Fix login bug');
      expect(todos[0].externalId).toBe('github:walterra/eddoapp/issues/123');
    });

    it('should create todo without externalId (Eddo-created)', async () => {
      await assert.expectToolCallSuccess('createTodo', {
        title: 'Regular todo',
        description: 'Not synced with external system',
        context: 'private',
      });

      // List all private todos
      const todos = await assert.expectToolCallSuccess<TodoAlpha3[]>('listTodos', {
        context: 'private',
      });

      const regularTodo = todos.find((t) => t.title === 'Regular todo');
      expect(regularTodo).toBeDefined();
      expect(regularTodo!.externalId == null).toBe(true); // null or undefined
    });

    it('should create todos with different external systems', async () => {
      await assert.expectToolCallSuccess('createTodo', {
        title: 'GitHub issue',
        externalId: 'github:owner/repo/issues/1',
        context: 'work',
      });

      await assert.expectToolCallSuccess('createTodo', {
        title: 'JIRA ticket',
        externalId: 'jira:PROJECT-123',
        context: 'work',
      });

      // Verify both were created with correct externalId
      const githubTodos = await assert.expectToolCallSuccess<TodoAlpha3[]>('listTodos', {
        externalId: 'github:owner/repo/issues/1',
      });
      expect(githubTodos[0].externalId).toBe('github:owner/repo/issues/1');

      const jiraTodos = await assert.expectToolCallSuccess<TodoAlpha3[]>('listTodos', {
        externalId: 'jira:PROJECT-123',
      });
      expect(jiraTodos[0].externalId).toBe('jira:PROJECT-123');
    });
  });

  describe('listTodos with externalId filter', () => {
    it('should filter by exact externalId match', async () => {
      // Create todos with different external IDs
      await assert.expectToolCallSuccess('createTodo', {
        title: 'Issue 1',
        externalId: 'github:walterra/eddoapp/issues/100',
        context: 'work',
      });

      await assert.expectToolCallSuccess('createTodo', {
        title: 'Issue 2',
        externalId: 'github:walterra/eddoapp/issues/200',
        context: 'work',
      });

      await assert.expectToolCallSuccess('createTodo', {
        title: 'Regular todo',
        context: 'work',
      });

      // Filter by exact match
      const result = await assert.expectToolCallSuccess<TodoAlpha3[]>('listTodos', {
        externalId: 'github:walterra/eddoapp/issues/100',
      });

      const todos = result;
      expect(todos).toHaveLength(1);
      expect(todos[0].title).toBe('Issue 1');
      expect(todos[0].externalId).toBe('github:walterra/eddoapp/issues/100');
    });

    it('should filter by multiple specific externalIds (client-side use case)', async () => {
      // Create todos from different sources
      await assert.expectToolCallSuccess('createTodo', {
        title: 'GitHub issue A',
        externalId: 'github:org1/repo1/issues/1',
        context: 'work',
      });

      await assert.expectToolCallSuccess('createTodo', {
        title: 'GitHub issue B',
        externalId: 'github:org2/repo2/issues/2',
        context: 'work',
      });

      await assert.expectToolCallSuccess('createTodo', {
        title: 'JIRA ticket',
        externalId: 'jira:PROJ-123',
        context: 'work',
      });

      // Query for each specific externalId
      const githubA = await assert.expectToolCallSuccess<TodoAlpha3[]>('listTodos', {
        externalId: 'github:org1/repo1/issues/1',
      });
      expect(githubA.length).toBe(1);
      expect(githubA[0].title).toBe('GitHub issue A');

      const githubB = await assert.expectToolCallSuccess<TodoAlpha3[]>('listTodos', {
        externalId: 'github:org2/repo2/issues/2',
      });
      expect(githubB.length).toBe(1);
      expect(githubB[0].title).toBe('GitHub issue B');

      const jira = await assert.expectToolCallSuccess<TodoAlpha3[]>('listTodos', {
        externalId: 'jira:PROJ-123',
      });
      expect(jira.length).toBe(1);
      expect(jira[0].title).toBe('JIRA ticket');
    });

    it('should combine externalId filter with other filters', async () => {
      // Create GitHub issues in different contexts
      const externalId = 'github:company/app/issues/1';

      await assert.expectToolCallSuccess('createTodo', {
        title: 'Work GitHub issue',
        externalId,
        context: 'work',
      });

      await assert.expectToolCallSuccess('createTodo', {
        title: 'Personal GitHub issue',
        externalId: 'github:personal/project/issues/2',
        context: 'private',
      });

      // Filter by exact externalId + work context
      const result = await assert.expectToolCallSuccess<TodoAlpha3[]>('listTodos', {
        externalId,
        context: 'work',
        completed: false,
      });

      expect(result.length).toBe(1);
      expect(result[0].externalId).toBe(externalId);
      expect(result[0].context).toBe('work');
      expect(result[0].completed).toBeNull();
    });

    it('should return empty array when no matches found', async () => {
      const result = await assert.expectToolCallSuccess<TodoAlpha3[]>('listTodos', {
        externalId: 'nonexistent:system/id',
      });

      const todos = result;
      expect(todos).toHaveLength(0);
    });
  });

  describe('Deduplication use case', () => {
    it('should prevent duplicate imports using externalId', async () => {
      const externalId = 'github:walterra/eddoapp/issues/999';

      // First import
      await assert.expectToolCallSuccess('createTodo', {
        title: 'Implement feature X',
        description: 'Original import',
        externalId,
        context: 'work',
      });

      // Check if already exists before re-import
      const existingTodos = await assert.expectToolCallSuccess<TodoAlpha3[]>('listTodos', {
        externalId,
      });

      expect(existingTodos.length).toBeGreaterThanOrEqual(1);
      expect(existingTodos[0].externalId).toBe(externalId);

      // Deduplication logic would skip creating duplicate here
    });
  });

  describe('Backwards compatibility', () => {
    it('should handle todos without externalId field', async () => {
      // Create todo without externalId
      await assert.expectToolCallSuccess('createTodo', {
        title: 'Old-style todo',
        context: 'private',
      });

      // Verify it was created correctly
      const todos = await assert.expectToolCallSuccess<TodoAlpha3[]>('listTodos', {
        context: 'private',
      });

      const oldStyleTodo = todos.find((t) => t.title === 'Old-style todo');
      expect(oldStyleTodo).toBeDefined();
      expect(oldStyleTodo!.externalId == null).toBe(true); // null or undefined
      expect(oldStyleTodo!.version).toBe('alpha3');
    });

    it('should list todos with and without externalId', async () => {
      await assert.expectToolCallSuccess('createTodo', {
        title: 'With external ID',
        externalId: 'github:test/repo/issues/1',
        context: 'work',
      });

      await assert.expectToolCallSuccess('createTodo', {
        title: 'Without external ID',
        context: 'work',
      });

      const result = await assert.expectToolCallSuccess<TodoAlpha3[]>('listTodos', {
        context: 'work',
      });

      const todos = result;
      expect(todos.length).toBeGreaterThanOrEqual(2);

      const withExternal = todos.filter((t) => t.externalId);
      const withoutExternal = todos.filter((t) => !t.externalId);

      expect(withExternal.length).toBeGreaterThanOrEqual(1);
      expect(withoutExternal.length).toBeGreaterThanOrEqual(1);
    });
  });
});
