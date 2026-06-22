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

import { getChatDatabaseName, validateEnv } from '@eddo/core-server';
import nano from 'nano';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createAgentAssertions } from '../helpers/agent-assertions.js';
import { TestAgentServer } from '../setup/test-agent-server.js';

const TELEGRAM_BOT_MODEL = 'claude-sonnet-4-5-20250929';

interface AssistantConversationMessageDoc {
  version: 'assistant_conversation_message_alpha1';
  role: 'user' | 'assistant';
  content: string;
  conversationId: string;
  createdAt: string;
  sequence: number;
}

function getAssistantConversationDb(username: string): nano.DocumentScope<unknown> {
  const couch = nano(process.env.COUCHDB_URL!);
  const env = validateEnv(process.env);
  return couch.use(getChatDatabaseName(env, username));
}

async function getAssistantConversationMessages(
  username: string,
): Promise<AssistantConversationMessageDoc[]> {
  const chatDb = getAssistantConversationDb(username);
  const result = await chatDb.list({ include_docs: true });

  return result.rows
    .map((row) => row.doc as AssistantConversationMessageDoc | undefined)
    .filter((doc): doc is AssistantConversationMessageDoc =>
      Boolean(doc?.version === 'assistant_conversation_message_alpha1'),
    )
    .sort((a, b) => a.sequence - b.sequence || a.createdAt.localeCompare(b.createdAt));
}

async function clearAssistantConversationMessages(username: string): Promise<void> {
  const chatDb = getAssistantConversationDb(username);
  const result = await chatDb.list({ include_docs: true });
  const docs = result.rows
    .map((row) => row.doc as { _id?: string; _rev?: string; version?: string } | undefined)
    .filter((doc) => doc?.version?.startsWith('assistant_conversation_'));

  await Promise.all(docs.map((doc) => chatDb.destroy(doc!._id!, doc!._rev!)));
}

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
      llmModel: process.env.LLM_MODEL || TELEGRAM_BOT_MODEL,
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

  describe('Persistent Chat History', () => {
    it('persists assistant conversation history across real messages', async () => {
      agentServer.loadCassette('persistent-chat-history');

      const context = agentServer.createMockContext();
      const username = context.session?.user?.username;
      expect(username).toBeTruthy();

      const firstInput = 'My planning keyword for this test is deep-work.';
      const firstResponse = await assert.expectTimely(
        agentServer.executeAgent(firstInput, 'test-user-history', context),
      );
      assert.expectSuccess(firstResponse);

      const firstMessages = await getAssistantConversationMessages(username!);
      expect(firstMessages).toHaveLength(2);
      expect(firstMessages[0].content).toBe(firstInput);
      expect(firstMessages[1].role).toBe('assistant');

      const requestCountAfterFirstMessage = agentServer.getLlmRequests().length;
      const secondInput = 'What planning keyword did I mention?';
      const secondResponse = await assert.expectTimely(
        agentServer.executeAgent(secondInput, 'test-user-history', context),
      );
      assert.expectSuccess(secondResponse);
      expect(secondResponse.message.toLowerCase()).toContain('deep-work');

      const secondRequest = agentServer.getLlmRequests()[requestCountAfterFirstMessage];
      const conversationId = secondRequest.sessionId?.replace(`assistant:${username}:`, '');
      expect(conversationId).toBeTruthy();
      expect(secondRequest.sessionId).toBe(`assistant:${username}:${conversationId}`);
      expect(secondRequest.messages.map((message) => message.content)).toEqual([
        firstInput,
        firstMessages[1].content,
        secondInput,
      ]);

      const allMessages = await getAssistantConversationMessages(username!);
      expect(allMessages.map((message) => message.role)).toEqual([
        'user',
        'assistant',
        'user',
        'assistant',
      ]);
    });
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
        replies.includes('more detail') ||
        replies.includes('need') ||
        replies.includes('provide') ||
        replies.includes('details') ||
        replies.includes('clarify');

      expect(validOutcome).toBe(true);
    });
  });

  describe('STATUS Message Pattern', () => {
    it('should use STATUS for intermediate feedback without hallucinated content', async () => {
      agentServer.loadCassette('status-message-pattern');

      // First create some todos to have data for the recap
      const setupInput = 'create a work todo called "Test task for recap"';
      const setupContext = agentServer.createMockContext();
      await assert.expectTimely(agentServer.executeAgent(setupInput, 'test-user-6', setupContext));
      await clearAssistantConversationMessages(setupContext.session!.user!.username);

      // Request a recap which requires multiple tool calls
      const recapInput = 'show me what I completed today';
      const recapContext = agentServer.createMockContext();

      const response = await assert.expectTimely(
        agentServer.executeAgent(recapInput, 'test-user-6-recap', recapContext),
      );

      assert.expectSuccess(response);
      const usedRecapTool =
        response.context.toolResults?.some(
          (result) => result.toolName === 'listTodos' || result.toolName === 'getRecapData',
        ) ?? false;
      expect(usedRecapTool).toBe(true);

      // Verify responses don't contain hallucinated content before tool results
      // STATUS messages should be short (under 10 words), not full recaps
      const replies = response.context.replies;

      // Check that intermediate messages (if any) are short status messages
      // and don't contain hallucinated recap content
      for (let i = 0; i < replies.length - 1; i++) {
        const reply = replies[i];
        // Intermediate messages should be short status updates
        // They should NOT contain detailed recap content like "[x] Task name"
        const wordCount = reply.split(/\s+/).length;

        // If it's a short message (likely a STATUS), it shouldn't have recap markers
        if (wordCount < 20) {
          expect(reply).not.toMatch(/---RECAP-START---/);
          expect(reply).not.toMatch(/\[x\].*completed/i);
        }
      }

      // Final response should have actual content
      const finalReply = replies[replies.length - 1];
      expect(finalReply.length).toBeGreaterThan(20);
    });
  });
});
