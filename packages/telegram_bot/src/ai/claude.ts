import { Anthropic } from '@anthropic-ai/sdk';
import { getRandomHex } from '@eddo/core-shared';

import type { AgentState } from '../agent/simple-agent.js';
import { appConfig } from '../utils/config.js';
import { logger, withSpan } from '../utils/logger.js';

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
    const model = appConfig.LLM_MODEL || 'claude-3-haiku-20240307';

    return withSpan(
      'llm_generate',
      {
        'llm.model': model,
        'llm.messages_count': conversationHistory.length,
        'llm.system_prompt_length': systemPrompt.length,
      },
      async (span) => {
        const requestId = `req_${Date.now()}_${getRandomHex(9)}`;
        return this.executeRequest({
          requestId,
          model,
          conversationHistory,
          systemPrompt,
          span,
        });
      },
    );
  }

  private async executeRequest(params: {
    requestId: string;
    model: string;
    conversationHistory: AgentState['history'];
    systemPrompt: string;
    span: { setAttribute: (key: string, value: string | number) => void };
  }): Promise<string> {
    const { requestId, model, conversationHistory, systemPrompt, span } = params;

    try {
      logger.info('🤖 LLM Request', {
        requestId,
        model,
        systemPrompt,
        conversationHistory,
        historyLength: conversationHistory.length,
        systemPromptLength: systemPrompt.length,
      });

      const response = await this.anthropic.messages.create({
        model,
        max_tokens: 1000,
        system: systemPrompt,
        messages: conversationHistory.map((msg) => ({ role: msg.role, content: msg.content })),
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Claude');
      }

      span.setAttribute('llm.response_length', content.text.length);
      span.setAttribute('llm.input_tokens', response.usage.input_tokens);
      span.setAttribute('llm.output_tokens', response.usage.output_tokens);

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

// Lazy singleton instance - only created when accessed
// In VCR playback mode, tests use cachedClaudeService instead
let _claudeService: SimpleClaudeService | null = null;

export const claudeService: ClaudeService = {
  generateResponse: async (conversationHistory, systemPrompt) => {
    if (!_claudeService) {
      _claudeService = new SimpleClaudeService();
    }
    return _claudeService.generateResponse(conversationHistory, systemPrompt);
  },
};
