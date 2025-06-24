import Anthropic from '@anthropic-ai/sdk';

import type { MCPClient } from '../mcp/client.js';
import { logger } from '../utils/logger.js';
import type { Persona } from './personas.js';

export class ResponseGenerator {
  private client: Anthropic;

  constructor(
    apiKey: string,
    private mcpClient: MCPClient | null,
    private persona: Persona,
  ) {
    this.client = new Anthropic({ apiKey });
  }

  async generateResponse(
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
    systemPrompt?: string,
  ): Promise<string> {
    try {
      const system = systemPrompt || (await this.getEnhancedSystemPrompt());

      // Filter out system messages from the messages array
      const userAndAssistantMessages = messages.filter(
        (msg) => msg.role !== 'system',
      );

      // Find the last system message if any
      const systemMessages = messages.filter((msg) => msg.role === 'system');
      const finalSystemPrompt =
        systemMessages.length > 0
          ? `${system}\n\n${systemMessages[systemMessages.length - 1].content}`
          : system;

      const response = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
        system: finalSystemPrompt,
        messages: userAndAssistantMessages as Anthropic.MessageParam[],
      });

      const assistantContent = response.content[0];
      if (assistantContent.type !== 'text') {
        throw new Error('Unexpected response type from Claude');
      }

      return assistantContent.text;
    } catch (error) {
      logger.error('Failed to generate response', { error });
      throw error;
    }
  }

  /**
   * Get enhanced system prompt with real-time MCP capabilities
   */
  private async getEnhancedSystemPrompt(): Promise<string> {
    try {
      if (!this.mcpClient || !this.mcpClient.isClientConnected()) {
        return this.persona.systemPrompt;
      }

      // Get comprehensive MCP server documentation
      const serverInfo = await this.mcpClient.getServerInfo('all');

      return `${this.persona.systemPrompt}

## MCP Server Documentation
${serverInfo}

Use this documentation to understand the exact capabilities and parameters for each tool.`;
    } catch (error) {
      logger.warn('Failed to get MCP server info for enhanced prompt', {
        error,
      });
      return this.persona.systemPrompt;
    }
  }
}
