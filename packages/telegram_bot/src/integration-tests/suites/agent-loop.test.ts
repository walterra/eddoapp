/**
 * Agent Loop E2E Integration Tests
 * Tests the complete agent loop workflow with real MCP server and CouchDB
 *
 * Design principles:
 * - Minimize API calls (each LLM call costs money)
 * - Combine related assertions into single tests
 * - Accept multiple valid LLM behaviors (avoid brittle assertions)
 * - Focus on verifying database state, not exact LLM responses
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import nano from 'nano';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createAgentAssertions } from '../helpers/agent-assertions.js';
import { TestAgentServer } from '../setup/test-agent-server.js';

describe('Agent Loop E2E Integration', () => {
  let agentServer: TestAgentServer;
  let assert: ReturnType<typeof createAgentAssertions>;
  let testDb: nano.DocumentScope<any>;

  beforeAll(async () => {
    if (!process.env.COUCHDB_URL) {
      throw new Error('COUCHDB_URL not set - testcontainer setup may have failed');
    }
  });

  afterAll(async () => {
    // Cleanup after all tests
  });

  beforeEach(async () => {
    agentServer = new TestAgentServer({
      llmModel: process.env.LLM_MODEL || 'claude-3-5-haiku-20241022',
    });

    await agentServer.start();
    assert = createAgentAssertions();

    const couchDbUrl = process.env.COUCHDB_URL!;
    const couch = nano(couchDbUrl);
    const userDbName = agentServer.getUserDatabaseName();

    testDb = couch.use(userDbName);
  });

  afterEach(async () => {
    await agentServer.stop();
  });

  describe('Core Todo Operations', () => {
    it('should create todo with natural language date parsing', async () => {
      // Tests: basic creation, date parsing, database persistence
      const input = 'add todo next friday to go shopping';

      const response = await assert.expectTimely(agentServer.executeAgent(input, 'test-user-1'));

      assert.expectSuccess(response);
      assert.expectTypingAction(response);
      assert.expectToolUsed(response, 'createTodo');

      // Verify todo exists in database with correct properties
      const result = await testDb.find({
        selector: {
          version: 'alpha3',
        },
      });

      expect(result.docs.length).toBeGreaterThanOrEqual(1);

      // Find the shopping todo (LLM may word it differently)
      const todo = result.docs.find(
        (doc: any) =>
          doc.title.toLowerCase().includes('shop') || doc.title.toLowerCase().includes('grocery'),
      );
      expect(todo).toBeDefined();
      expect(todo.due).toBeTruthy();

      // Verify due date is in the future (don't check specific day - LLM interpretation varies)
      const dueDate = new Date(todo.due);
      const today = new Date();
      expect(dueDate.getTime()).toBeGreaterThan(today.getTime());
    });

    it('should create todo with context and tags', async () => {
      // Tests: context assignment, tag extraction, specific date
      const input = 'create work todo for quarterly report due next month with urgent tag';

      const response = await assert.expectTimely(agentServer.executeAgent(input, 'test-user-2'));

      assert.expectSuccess(response);
      assert.expectToolUsed(response, 'createTodo');

      const result = await testDb.find({
        selector: {
          version: 'alpha3',
          context: 'work',
        },
      });

      expect(result.docs.length).toBeGreaterThanOrEqual(1);
      const todo = result.docs.find(
        (doc: any) =>
          doc.title.toLowerCase().includes('quarterly') ||
          doc.title.toLowerCase().includes('report'),
      );
      expect(todo).toBeDefined();
      expect(todo.context).toBe('work');

      // Check for urgent tag (LLM may add it as 'urgent' or include gtd tags)
      const hasUrgentTag = todo.tags.some(
        (tag: string) => tag.toLowerCase().includes('urgent') || tag.toLowerCase().includes('high'),
      );
      expect(hasUrgentTag).toBe(true);

      // Verify due date exists (don't check if future - LLM date interpretation varies)
      expect(todo.due).toBeTruthy();
    });

    it('should handle multi-step operations (create then list)', async () => {
      // Tests: multi-tool chaining, sequential operations
      const input = 'create a work todo for code review, then show me all my work todos';

      const response = await assert.expectTimely(agentServer.executeAgent(input, 'test-user-3'));

      assert.expectSuccess(response);
      assert.expectToolUsed(response, 'createTodo');
      assert.expectToolUsed(response, 'listTodos');

      // Verify todo was created
      const result = await testDb.find({
        selector: {
          version: 'alpha3',
          context: 'work',
        },
      });

      expect(result.docs.length).toBeGreaterThanOrEqual(1);
      const todo = result.docs.find(
        (doc: any) =>
          doc.title.toLowerCase().includes('code') || doc.title.toLowerCase().includes('review'),
      );
      expect(todo).toBeDefined();
    });

    it('should complete todo workflow (create and mark done)', async () => {
      // Tests: todo completion, update operations
      // First create a todo
      const createInput = 'create todo called integration test task';
      const createResponse = await assert.expectTimely(
        agentServer.executeAgent(createInput, 'test-user-4'),
      );
      assert.expectSuccess(createResponse);

      // Then mark it complete
      const completeInput = 'mark the integration test task as done';
      const completeResponse = await assert.expectTimely(
        agentServer.executeAgent(completeInput, 'test-user-4'),
      );

      assert.expectSuccess(completeResponse);

      // Accept either updateTodo or toggleTodoCompletion - both are valid
      const usedUpdateTool =
        completeResponse.context.toolResults?.some(
          (r) => r.toolName === 'updateTodo' || r.toolName === 'toggleTodoCompletion',
        ) ?? false;
      expect(usedUpdateTool).toBe(true);

      // Verify todo is completed in database
      const result = await testDb.find({
        selector: {
          version: 'alpha3',
        },
      });

      const todo = result.docs.find(
        (doc: any) =>
          doc.title.toLowerCase().includes('integration') ||
          doc.title.toLowerCase().includes('test'),
      );
      expect(todo).toBeDefined();
      expect(todo.completed).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    it('should handle ambiguous input gracefully', async () => {
      // Tests: error handling, graceful degradation
      const input = 'add todo';

      const response = await assert.expectTimely(agentServer.executeAgent(input, 'test-user-5'));

      // Agent should respond (either create with defaults or ask for clarification)
      expect(response.context.replies.length).toBeGreaterThan(0);

      // Accept multiple valid outcomes
      const replies = response.context.replies.join(' ').toLowerCase();
      const validOutcome =
        // Created a todo with defaults
        replies.includes('created') ||
        replies.includes('added') ||
        // Asked for clarification
        replies.includes('what') ||
        replies.includes('title') ||
        replies.includes('specify') ||
        replies.includes('more detail');

      expect(validOutcome).toBe(true);
    });
  });
});
