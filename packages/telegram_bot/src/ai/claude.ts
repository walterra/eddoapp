import { Anthropic } from '@anthropic-ai/sdk';
import { getRandomHex } from '@eddo/core-shared';

import type { AgentState } from '../agent/simple-agent.js';
import { appConfig } from '../utils/config.js';
import { logger } from '../utils/logger.js';

export interface ClaudeService {
  generateResponse: (
    conversationHistory: AgentState['history'],
    systemPrompt: string,
  ) => Promise<string>;
}

/**
 * Simple Claude service for LLM interactions
 */
export class SimpleClaudeService implements ClaudeService {
  private anthropic: Anthropic;

  constructor() {
    if (!appConfig.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }

    this.anthropic = new Anthropic({
      apiKey: appConfig.ANTHROPIC_API_KEY,
    });

    logger.info('Simple Claude service initialized');
  }

  async generateResponse(
    conversationHistory: AgentState['history'],
    systemPrompt: string,
  ): Promise<string> {
    try {
      const requestId = `req_${Date.now()}_${getRandomHex(9)}`;

      logger.info('🤖 LLM Request', {
        requestId,
        model: appConfig.LLM_MODEL || 'claude-3-haiku-20240307',
        systemPrompt,
        conversationHistory,
        historyLength: conversationHistory.length,
        systemPromptLength: systemPrompt.length,
      });

      const response = await this.anthropic.messages.create({
        model: appConfig.LLM_MODEL || 'claude-3-haiku-20240307',
        max_tokens: 1000,
        system: systemPrompt,
        messages: conversationHistory.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Claude');
      }

      logger.info('🤖 LLM Response', {
        requestId,
        response: content.text,
        responseLength: content.text.length,
        usage: response.usage,
      });

      return content.text;
    } catch (error) {
      logger.error('Failed to generate Claude response', { error });
      throw new Error(
        `Claude API error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

// Singleton instance
export const claudeService = new SimpleClaudeService();
