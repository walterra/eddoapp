/**
 * MCP information retrieval utilities
 */
import type { BotContext } from '../../bot/bot.js';
import type { MCPClient } from '../../mcp/client.js';
import { extractUserContextForMCP } from '../../mcp/user-context.js';
import { logger } from '../../utils/logger.js';

/**
 * Retrieves comprehensive system information from MCP server
 */
export async function getMCPSystemInfo(
  mcpClient: MCPClient,
  telegramContext: BotContext,
): Promise<string> {
  try {
    const userContext = await extractUserContextForMCP(telegramContext);

    const serverInfoResult = await mcpClient.invoke(
      'getServerInfo',
      { section: 'all' },
      userContext || undefined,
    );

    // Handle array response format
    if (Array.isArray(serverInfoResult) && serverInfoResult.length > 0) {
      const textContent = serverInfoResult.find((content) => content.type === 'text');
      if (textContent?.text) {
        logger.debug('Retrieved comprehensive server info from MCP content array', {
          length: textContent.text.length,
          preview: textContent.text.substring(0, 200) + '...',
        });
        return textContent.text;
      }
    }

    // Handle direct string response
    if (typeof serverInfoResult === 'string') {
      logger.debug('Retrieved comprehensive server info as string', {
        length: serverInfoResult.length,
        preview: serverInfoResult.substring(0, 200) + '...',
      });
      return serverInfoResult;
    }

    return getFallbackToolList(mcpClient);
  } catch (error) {
    logger.debug('Failed to retrieve server info, falling back to basic tools', { error });
    return getFallbackToolList(mcpClient);
  }
}

/**
 * Returns a fallback tool list when getServerInfo fails
 */
function getFallbackToolList(mcpClient: MCPClient): string {
  return mcpClient.tools.map((tool) => `- ${tool.name}: ${tool.description}`).join('\n');
}
