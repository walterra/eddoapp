/**
 * Agent Test Assertions
 * Helper functions for testing agent behavior
 */
import { expect } from 'vitest';

import type { MockTelegramContext } from '../setup/test-agent-server.js';

export interface AgentResponse {
  success: boolean;
  message: string;
  context: MockTelegramContext;
}

export function createAgentAssertions() {
  return {
    /**
     * Assert that agent executed successfully
     */
    expectSuccess(response: AgentResponse): void {
      expect(response.success).toBe(true);
      expect(response.message).toBeTruthy();
    },

    /**
     * Assert that agent failed with expected error
     */
    expectFailure(response: AgentResponse, expectedError?: string): void {
      expect(response.success).toBe(false);
      if (expectedError) {
        expect(response.message).toContain(expectedError);
      }
    },

    /**
     * Assert that agent replied with expected content
     */
    expectReplyContains(
      response: AgentResponse,
      expectedContent: string,
    ): void {
      const replies = response.context.replies;
      expect(replies.length).toBeGreaterThan(0);
      const hasContent = replies.some((reply) =>
        reply.includes(expectedContent),
      );
      expect(hasContent).toBe(true);
    },

    /**
     * Assert that agent used specific MCP tool
     */
    expectToolUsed(response: AgentResponse, toolName: string): void {
      const replies = response.context.replies;
      const toolMentioned = replies.some(
        (reply) =>
          reply.includes(`Tool ${toolName}`) ||
          reply.includes(`using ${toolName}`) ||
          reply.includes(`${toolName} tool`),
      );
      expect(toolMentioned).toBe(true);
    },

    /**
     * Assert that agent showed typing indicator
     */
    expectTypingAction(response: AgentResponse): void {
      const chatActions = response.context.chatActions;
      expect(chatActions).toContain('typing');
    },

    /**
     * Assert number of agent iterations
     */
    expectIterationCount(
      response: AgentResponse,
      minIterations: number,
      maxIterations?: number,
    ): void {
      const replies = response.context.replies;
      const iterationCount = replies.filter((reply) =>
        reply.includes('🤔 Processing'),
      ).length;
      expect(iterationCount).toBeGreaterThanOrEqual(minIterations);
      if (maxIterations !== undefined) {
        expect(iterationCount).toBeLessThanOrEqual(maxIterations);
      }
    },

    /**
     * Extract tool calls from agent response
     */
    extractToolCalls(response: AgentResponse): string[] {
      const replies = response.context.replies;
      const toolCalls: string[] = [];

      replies.forEach((reply) => {
        const toolMatch = reply.match(/Tool (\w+)/g);
        if (toolMatch) {
          toolCalls.push(...toolMatch.map((m) => m.replace('Tool ', '')));
        }
      });

      return toolCalls;
    },

    /**
     * Assert that agent completed within reasonable time
     */
    async expectTimely<T>(
      promise: Promise<T>,
      timeoutMs: number = 30000,
    ): Promise<T> {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error(`Operation timed out after ${timeoutMs}ms`)),
          timeoutMs,
        );
      });

      return Promise.race([promise, timeoutPromise]);
    },
  };
}
