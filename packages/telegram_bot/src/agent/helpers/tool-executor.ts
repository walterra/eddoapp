/**
 * Tool execution utilities for the agent
 */
import type { BotContext } from '../../bot/bot.js';
import type { MCPClient } from '../../mcp/client.js';
import { extractUserContextForMCP } from '../../mcp/user-context.js';
import { logger, SpanAttributes, withSpan } from '../../utils/logger.js';

import type { AgentState, ToolCall } from './types.js';

/**
 * Context for tool execution
 */
interface ToolExecutionContext {
  telegramContext: BotContext;
  mcpClient: MCPClient;
  iterationId: string;
}

/**
 * Executes a tool call via MCP
 */
export async function executeTool(
  toolCall: ToolCall,
  telegramContext: BotContext,
  mcpClient: MCPClient,
): Promise<unknown> {
  return withSpan(
    'mcp_tool_execute',
    {
      [SpanAttributes.MCP_TOOL]: toolCall.name,
      [SpanAttributes.MCP_OPERATION]: 'invoke',
    },
    async () => {
      const tool = mcpClient.tools.find((t) => t.name === toolCall.name);
      if (!tool) {
        throw new Error(`Tool not found: ${toolCall.name}`);
      }

      const userContext = await extractUserContextForMCP(telegramContext);

      logger.info('Executing tool', {
        toolName: tool.name,
        parameters: toolCall.parameters,
        username: userContext?.username,
        databaseName: userContext?.databaseName,
      });

      return mcpClient.invoke(tool.name, toolCall.parameters, userContext || undefined);
    },
  );
}

/**
 * Handles the result of a tool execution and updates state
 */
export async function handleToolExecution(
  toolCall: ToolCall,
  state: AgentState,
  context: ToolExecutionContext,
): Promise<void> {
  const { telegramContext, mcpClient, iterationId } = context;

  logger.info('🔧 Agent Decision: Tool Call', {
    iterationId,
    toolName: toolCall.name,
    parameters: toolCall.parameters,
    reasoning: 'LLM decided to use a tool based on the current context',
  });

  try {
    const toolResult = await executeTool(toolCall, telegramContext, mcpClient);
    state.toolResults.push({
      toolName: toolCall.name,
      result: toolResult,
      timestamp: Date.now(),
    });

    logger.info('✅ Tool Execution Success', {
      iterationId,
      toolName: toolCall.name,
      resultPreview: JSON.stringify(toolResult).substring(0, 200) + '...',
    });

    state.history.push({
      role: 'user',
      content: `Tool "${toolCall.name}" result: ${JSON.stringify(toolResult)}`,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('❌ Tool Execution Failed', {
      iterationId,
      toolName: toolCall.name,
      error: error instanceof Error ? error.message : String(error),
    });

    state.history.push({
      role: 'user',
      content: `Tool "${toolCall.name}" failed: ${error instanceof Error ? error.message : String(error)}`,
      timestamp: Date.now(),
    });
  }
}
