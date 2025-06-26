import Anthropic from '@anthropic-ai/sdk';

import type { MCPClient } from '../mcp/client.js';
import { appConfig } from '../utils/config.js';
import { logger } from '../utils/logger.js';
import { PersonaPromptBuilder } from './persona-prompt-builder.js';
import type { Persona } from './personas.js';

/**
 * Creates a response generator instance for generating AI responses
 */
export function createResponseGenerator(
  apiKey: string,
  mcpClient: MCPClient | null,
  persona: Persona,
) {
  const client = new Anthropic({ apiKey });

  const generateResponse = async (
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
    systemPrompt?: string,
  ): Promise<string> => {
    try {
      const system = systemPrompt || (await getEnhancedSystemPrompt());

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

      const response = await client.messages.create({
        model: appConfig.LLM_MODEL,
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
  };

  /**
   * Get enhanced system prompt with real-time MCP capabilities
   */
  const getEnhancedSystemPrompt = async (): Promise<string> => {
    try {
      if (!mcpClient || !mcpClient.isClientConnected()) {
        // Use persona prompt builder with empty tools if no MCP client
        return await PersonaPromptBuilder.buildSystemPrompt(persona, []);
      }

      // Get MCP tools information for dynamic prompt building
      const mcpToolsRaw = await mcpClient.listTools();
      const mcpTools = mcpToolsRaw.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: (tool.inputSchema as Record<string, unknown>) || {},
      }));

      // Use PersonaPromptBuilder to combine personality with MCP capabilities
      const basePrompt = await PersonaPromptBuilder.buildSystemPrompt(
        persona,
        mcpTools,
      );

      // Get comprehensive MCP server documentation for additional context
      const serverInfo = await mcpClient.getServerInfo('all');

      return `${basePrompt}

## MCP Server Documentation
${serverInfo}

Use this documentation to understand the exact capabilities and parameters for each tool.`;
    } catch (error) {
      logger.warn('Failed to get MCP server info for enhanced prompt', {
        error,
      });
      // Fallback to persona prompt builder with empty tools
      return await PersonaPromptBuilder.buildSystemPrompt(persona, []);
    }
  };

  return {
    generateResponse,
  };
}
