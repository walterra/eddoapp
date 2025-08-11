/**
 * Agent Loop E2E Integration Tests
 * Tests the complete agent loop workflow with real MCP server and CouchDB
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import nano from 'nano';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';

import { createAgentAssertions } from '../helpers/agent-assertions.js';
import { TestAgentServer } from '../setup/test-agent-server.js';

describe('Agent Loop E2E Integration', () => {
  let agentServer: TestAgentServer;
  let assert: ReturnType<typeof createAgentAssertions>;
  let testDb: nano.DocumentScope<any>;

  beforeAll(async () => {
    // MCP server should be running for these tests
    // COUCHDB_URL is set by run-telegram-bot-integration-tests.ts via testcontainer
    if (!process.env.COUCHDB_URL) {
      throw new Error(
        'COUCHDB_URL not set - testcontainer setup may have failed',
      );
    }
  });

  afterAll(async () => {
    // Cleanup after all tests
  });

  beforeEach(async () => {
    // Create agent server with test configuration
    agentServer = new TestAgentServer({
      llmModel: process.env.LLM_MODEL || 'claude-3-5-haiku-20241022',
    });

    await agentServer.start();
    assert = createAgentAssertions();

    // Set up direct database access for verification
    // COUCHDB_URL is set by the runner script via testcontainer
    const couchDbUrl = process.env.COUCHDB_URL!;
    const dbName = process.env.COUCHDB_DB_NAME || 'todos-dev';
    const couch = nano(couchDbUrl);
    const testDbName = `${dbName}-${agentServer.getTestApiKey()}`;

    // Ensure test database exists
    try {
      await couch.db.create(testDbName);
    } catch (error: any) {
      if (error.statusCode !== 412) {
        // 412 means database already exists
        throw error;
      }
    }

    testDb = couch.use(testDbName);
  });

  afterEach(async () => {
    await agentServer.stop();
  });

  describe('Basic Todo Creation', () => {
    it('should create todo from natural language input', async () => {
      const input = 'add todo next friday to go shopping';

      const response = await assert.expectTimely(
        agentServer.executeAgent(input, 'test-user-1'),
      );

      // Verify successful execution
      assert.expectSuccess(response);
      assert.expectTypingAction(response);

      // Verify todo exists in database
      const result = await testDb.find({
        selector: {
          version: 'alpha3',
          title: { $regex: '.*shopping.*' },
        },
      });

      expect(result.docs).toHaveLength(1);
      const todo = result.docs[0];
      expect(todo.title.toLowerCase()).toContain('shopping');
      expect(todo.due).toBeTruthy();

      // Verify the due date is a Friday in the future
      const dueDate = new Date(todo.due);
      const today = new Date();
      expect(dueDate.getUTCDay()).toBe(5); // Friday (using UTC since the date is stored in UTC)
      expect(dueDate.getTime()).toBeGreaterThan(today.getTime()); // In the future

      // Verify it's the next Friday or the Friday after (depending on what day today is)
      const daysDiff = Math.floor(
        (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
      );
      expect(daysDiff).toBeGreaterThanOrEqual(4); // At least 4 days away
      expect(daysDiff).toBeLessThanOrEqual(11); // At most 11 days away
    });

    it('should handle todo creation with specific date', async () => {
      const input = 'create todo for December 25th to buy Christmas presents';

      const response = await assert.expectTimely(
        agentServer.executeAgent(input, 'test-user-2'),
      );

      assert.expectSuccess(response);
      assert.expectToolUsed(response, 'createTodo');

      // Verify todo in database
      const result = await testDb.find({
        selector: {
          version: 'alpha3',
          title: { $regex: '.*Christmas.*' },
        },
      });

      expect(result.docs).toHaveLength(1);
      const todo = result.docs[0];
      expect(todo.title.toLowerCase()).toContain('christmas');
      const dueDate = new Date(todo.due);
      expect(dueDate.getUTCMonth()).toBe(11); // December (0-indexed)
      expect(dueDate.getUTCDate()).toBe(25);
    });
  });

  describe('Complex Todo with Context', () => {
    it('should create work todo with context and tags', async () => {
      const input =
        'create work todo for quarterly report due next month with urgent tag';

      const response = await assert.expectTimely(
        agentServer.executeAgent(input, 'test-user-3'),
      );

      assert.expectSuccess(response);
      assert.expectToolUsed(response, 'createTodo');

      // Verify todo in database
      const result = await testDb.find({
        selector: {
          version: 'alpha3',
          context: 'work',
        },
      });

      expect(result.docs).toHaveLength(1);
      const todo = result.docs[0];
      expect(todo.title.toLowerCase()).toContain('quarterly report');
      expect(todo.context).toBe('work');
      expect(todo.tags).toContain('urgent');

      // Verify due date is next month
      const dueDate = new Date(todo.due);
      const nextMonth = new Date();
      nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
      expect(dueDate.getUTCMonth()).toBe(nextMonth.getUTCMonth());
    });

    it('should create private todo with multiple tags', async () => {
      const input =
        'add personal todo to call mom tomorrow, tag it with family and important';

      const response = await assert.expectTimely(
        agentServer.executeAgent(input, 'test-user-4'),
      );

      assert.expectSuccess(response);

      // Verify todo in database
      const result = await testDb.find({
        selector: {
          version: 'alpha3',
          title: { $regex: '.*mom.*' },
        },
      });

      expect(result.docs).toHaveLength(1);
      const todo = result.docs[0];
      expect(todo.context).toBe('private');
      expect(todo.tags).toContain('family');
      expect(todo.tags).toContain('important');

      // Verify due date is tomorrow
      const tomorrow = new Date();
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      const dueDate = new Date(todo.due);
      expect(dueDate.getUTCDate()).toBe(tomorrow.getUTCDate());
    });
  });

  describe('Multi-iteration Processing', () => {
    it('should handle create and list in single request', async () => {
      const input =
        'create a work todo for code review, then show me all my work todos';

      const response = await assert.expectTimely(
        agentServer.executeAgent(input, 'test-user-5'),
      );

      assert.expectSuccess(response);
      assert.expectToolUsed(response, 'createTodo');
      assert.expectToolUsed(response, 'listTodos');

      // Verify todo was created
      const result = await testDb.find({
        selector: {
          version: 'alpha3',
          title: { $regex: '.*code review.*' },
        },
      });
      expect(result.docs).toHaveLength(1);
    });

    it('should create todo and start time tracking', async () => {
      const input =
        'add todo to review pull requests and start tracking time on it';

      const response = await assert.expectTimely(
        agentServer.executeAgent(input, 'test-user-6'),
      );

      assert.expectSuccess(response);
      assert.expectToolUsed(response, 'createTodo');
      assert.expectToolUsed(response, 'startTimeTracking');

      // Verify todo with active time tracking
      const result = await testDb.find({
        selector: {
          version: 'alpha3',
          title: { $regex: '.*pull requests.*' },
        },
      });

      expect(result.docs).toHaveLength(1);
      const todo = result.docs[0];
      expect(todo.active).toBeTruthy();
      expect(Object.keys(todo.active).length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid date gracefully', async () => {
      const input = 'create todo for yesterday to time travel';

      const response = await assert.expectTimely(
        agentServer.executeAgent(input, 'test-user-7'),
      );

      // Agent should still succeed but handle the date appropriately
      assert.expectSuccess(response);

      // Verify todo was created with adjusted date
      const result = await testDb.find({
        selector: {
          version: 'alpha3',
          title: { $regex: '.*time travel.*' },
        },
      });

      expect(result.docs).toHaveLength(1);
      const todo = result.docs[0];
      // Due date should be today or later, not yesterday
      const dueDate = new Date(todo.due);
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      expect(dueDate.getTime()).toBeGreaterThanOrEqual(today.getTime());
    });

    it('should handle ambiguous requests by asking for clarification', async () => {
      const input = 'add todo';

      const response = await assert.expectTimely(
        agentServer.executeAgent(input, 'test-user-8'),
      );

      // Agent should handle this gracefully
      expect(response.context.replies.length).toBeGreaterThan(0);

      // Should either create a basic todo or ask for more details
      const replies = response.context.replies.join(' ');
      const createdTodo =
        replies.includes('created') || replies.includes('Created');
      const askedForDetails =
        replies.includes('What') ||
        replies.includes('what') ||
        replies.includes('title');

      expect(createdTodo || askedForDetails).toBe(true);
    });
  });

  describe('Advanced Workflows', () => {
    it('should list todos with specific filters', async () => {
      // First create some todos
      const setupInput1 =
        'create work todo for meeting preparation due tomorrow';
      const setupInput2 = 'create private todo for grocery shopping due today';

      await agentServer.executeAgent(setupInput1, 'test-user-9');
      await agentServer.executeAgent(setupInput2, 'test-user-9');

      // Now test filtering
      const input = 'show me all my work todos that are due tomorrow';
      const response = await assert.expectTimely(
        agentServer.executeAgent(input, 'test-user-9'),
      );

      assert.expectSuccess(response);
      assert.expectToolUsed(response, 'listTodos');
      assert.expectReplyContains(response, 'meeting preparation');
    });

    it('should complete todo workflow', async () => {
      // Create a todo first
      const createInput = 'create todo for test completion';
      await agentServer.executeAgent(createInput, 'test-user-10');

      // Complete the todo
      const completeInput = 'mark the test completion todo as done';
      const response = await assert.expectTimely(
        agentServer.executeAgent(completeInput, 'test-user-10'),
      );

      assert.expectSuccess(response);
      assert.expectToolUsed(response, 'updateTodo');

      // Verify todo is completed
      const result = await testDb.find({
        selector: {
          version: 'alpha3',
          title: { $regex: '.*test completion.*' },
        },
      });

      expect(result.docs).toHaveLength(1);
      const todo = result.docs[0];
      expect(todo.completed).toBeTruthy();
    });
  });
});
