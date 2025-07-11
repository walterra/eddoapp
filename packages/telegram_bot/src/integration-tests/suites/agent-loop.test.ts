/**
 * Agent Loop E2E Integration Tests
 * Tests the complete agent loop workflow with real MCP server and CouchDB
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { getTestCouchDbConfig, validateEnv } from '@eddo/shared';
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
    // In a real scenario, this would be started by the test environment
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
    const env = validateEnv(process.env);
    const couchDbConfig = getTestCouchDbConfig(env);
    const couch = nano(couchDbConfig.url);
    const dbName = `${couchDbConfig.dbName}-${agentServer.getTestApiKey()}`;

    // Ensure test database exists
    try {
      await couch.db.create(dbName);
    } catch (error: any) {
      if (error.statusCode !== 412) {
        // 412 means database already exists
        throw error;
      }
    }

    testDb = couch.use(dbName);
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
      assert.expectToolUsed(response, 'createTodo');

      // Verify todo exists in database
      const result = await testDb.find({
        selector: {
          type: 'todo',
          title: { $regex: '.*shopping.*' },
        },
      });

      expect(result.docs).toHaveLength(1);
      const todo = result.docs[0];
      expect(todo.title.toLowerCase()).toContain('shopping');
      expect(todo.due).toBeTruthy();
      expect(new Date(todo.due).getDay()).toBe(5); // Friday
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
          type: 'todo',
          title: { $regex: '.*Christmas.*' },
        },
      });

      expect(result.docs).toHaveLength(1);
      const todo = result.docs[0];
      expect(todo.title.toLowerCase()).toContain('christmas');
      const dueDate = new Date(todo.due);
      expect(dueDate.getMonth()).toBe(11); // December (0-indexed)
      expect(dueDate.getDate()).toBe(25);
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
          type: 'todo',
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
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      expect(dueDate.getMonth()).toBe(nextMonth.getMonth());
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
          type: 'todo',
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
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dueDate = new Date(todo.due);
      expect(dueDate.getDate()).toBe(tomorrow.getDate());
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

      // Verify multiple iterations
      assert.expectIterationCount(response, 2, 3);

      // Verify todo was created
      const result = await testDb.find({
        selector: {
          type: 'todo',
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
          type: 'todo',
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
          type: 'todo',
          title: { $regex: '.*time travel.*' },
        },
      });

      expect(result.docs).toHaveLength(1);
      const todo = result.docs[0];
      // Due date should be today or later, not yesterday
      const dueDate = new Date(todo.due);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
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
          type: 'todo',
          title: { $regex: '.*test completion.*' },
        },
      });

      expect(result.docs).toHaveLength(1);
      const todo = result.docs[0];
      expect(todo.completed).toBeTruthy();
    });
  });
});
