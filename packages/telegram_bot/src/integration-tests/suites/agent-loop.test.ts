/**
 * Agent Loop E2E Integration Tests
 * Tests the complete agent loop workflow with real MCP server and CouchDB
 *
 * Design principles:
 * - Minimize API calls (each LLM call costs money)
 * - Combine related assertions into single tests
 * - Accept multiple valid LLM behaviors (avoid brittle assertions)
 * - Focus on verifying database state, not exact LLM responses
 *
 * VCR-style caching:
 * - VCR_MODE=auto (default): Record if cassette missing, replay if exists
 * - VCR_MODE=record: Always record fresh responses (updates cassettes)
 * - VCR_MODE=playback: Only replay, fail if cassette missing (CI default)
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
    console.log(`📼 VCR Mode: ${process.env.VCR_MODE || 'auto'}`);
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
      // Set up cassette for this test
      agentServer.loadCassette('create-todo-natural-language');

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

      // Verify due date is a valid ISO date (don't check if future - depends on when cassette was recorded)
      const dueDate = new Date(todo.due);
      expect(dueDate.getTime()).not.toBeNaN();
    });

    it('should create todo with context and tags', async () => {
      agentServer.loadCassette('create-todo-context-tags');

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
      agentServer.loadCassette('multi-step-create-list');

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

    // NOTE: This test cannot use VCR caching because:
    // 1. First LLM call creates a todo with a unique ID
    // 2. Second LLM call references that specific ID to mark it done
    // 3. During playback, the cached LLM response contains the OLD ID
    // 4. But the database has a NEW ID, causing "missing" errors
    // Multi-step workflows with ID references require live API calls.
    it.skipIf(process.env.VCR_MODE === 'playback')(
      'should complete todo workflow (create and mark done)',
      async () => {
        agentServer.loadCassette('complete-todo-workflow');

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
      },
    );
  });

  describe('Edge Cases', () => {
    it('should handle ambiguous input gracefully', async () => {
      agentServer.loadCassette('ambiguous-input');

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
