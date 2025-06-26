import { Anthropic } from '@anthropic-ai/sdk';

import { appConfig } from '../utils/config.js';
import { logger } from '../utils/logger.js';

export interface ClaudeService {
  generateResponse: (
    conversationHistory: string,
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
    conversationHistory: string,
    systemPrompt: string,
  ): Promise<string> {
    try {
      logger.debug('Generating Claude response', {
        historyLength: conversationHistory.length,
        systemPromptLength: systemPrompt.length,
      });

      const response = await this.anthropic.messages.create({
        model: appConfig.LLM_MODEL || 'claude-3-haiku-20240307',
        max_tokens: 1000,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: conversationHistory,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Claude');
      }

      logger.debug('Claude response generated', {
        responseLength: content.text.length,
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
