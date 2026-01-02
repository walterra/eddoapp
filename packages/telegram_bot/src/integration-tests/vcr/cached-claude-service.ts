/**
 * Cached Claude Service for VCR-style Testing
 *
 * Wraps the real Claude service to enable recording/replaying LLM responses.
 */
import { Anthropic } from '@anthropic-ai/sdk';

import type { AgentState } from '../../agent/simple-agent.js';
import type { ClaudeService } from '../../ai/claude.js';
import { appConfig } from '../../utils/config.js';
import { logger } from '../../utils/logger.js';
import type { CassetteManager } from './cassette-manager.js';

export interface CachedClaudeServiceConfig {
  cassetteManager: CassetteManager;
  /** Model to use for real API calls */
  model?: string;
}

/** Creates lazy-initialized Anthropic client factory */
function createAnthropicFactory(): () => Anthropic {
  let client: Anthropic | null = null;
  return () => {
    if (!client) {
      if (!appConfig.ANTHROPIC_API_KEY) {
        throw new Error(
          'ANTHROPIC_API_KEY required for recording. Set VCR_MODE=playback to use cached responses.',
        );
      }
      client = new Anthropic({ apiKey: appConfig.ANTHROPIC_API_KEY });
    }
    return client;
  };
}

/** Make real Claude API call */
async function makeClaudeApiCall(
  getClient: () => Anthropic,
  model: string,
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>,
): Promise<string> {
  logger.debug('Making real Claude API call', { model, messagesCount: messages.length });
  const response = await getClient().messages.create({
    model,
    max_tokens: 1000,
    system: systemPrompt,
    messages: messages as Anthropic.MessageParam[],
  });
  const content = response.content[0];
  if (content.type !== 'text') throw new Error('Unexpected response type from Claude');
  return content.text;
}

/** Creates a Claude service that records/replays responses via cassette manager */
export function createCachedClaudeService(config: CachedClaudeServiceConfig): ClaudeService {
  const { cassetteManager, model = 'claude-3-5-haiku-20241022' } = config;
  const getClient = createAnthropicFactory();

  async function generateResponse(
    conversationHistory: AgentState['history'],
    systemPrompt: string,
  ): Promise<string> {
    const messages = conversationHistory.map((msg) => ({ role: msg.role, content: msg.content }));
    return cassetteManager.handleInteraction(model, systemPrompt, messages, () =>
      makeClaudeApiCall(getClient, model, systemPrompt, messages),
    );
  }

  return { generateResponse };
}
