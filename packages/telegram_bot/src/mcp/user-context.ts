import type { BotContext } from '../bot/bot.js';
import { logger } from '../utils/logger.js';
import { getUserContextForMCP } from '../utils/user-lookup.js';

/**
 * User context for MCP operations
 */
export interface MCPUserContext {
  username: string;
  telegramId: number;
  mcpApiKey: string;
}

/** Extract user context from cached session */
function extractFromSession(ctx: BotContext, telegramId: number): MCPUserContext | null {
  if (!ctx.session?.user) {
    return null;
  }

  logger.debug('Using cached user context from session', {
    telegramId,
    username: ctx.session.user.username,
  });

  return {
    username: ctx.session.user.username,
    telegramId: ctx.session.user.telegram_id,
    mcpApiKey: ctx.session.user.preferences?.mcpApiKey || '',
  };
}

/** Extract user context from registry lookup */
async function extractFromRegistry(telegramId: number): Promise<MCPUserContext | null> {
  logger.debug('User not in session, performing lookup for MCP context', {
    telegramId,
  });

  try {
    const userContext = await getUserContextForMCP(telegramId);

    if (!userContext) {
      logger.warn('No user context found for MCP operations', { telegramId });
      return null;
    }

    return {
      username: userContext.username,
      telegramId,
      mcpApiKey: userContext.mcpApiKey || '',
    };
  } catch (error) {
    logger.error('Error extracting user context for MCP', {
      telegramId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Extract user context from bot session for MCP operations
 */
export async function extractUserContextForMCP(ctx: BotContext): Promise<MCPUserContext | null> {
  const telegramId = ctx.from?.id;

  if (!telegramId) {
    logger.warn('No Telegram ID available for MCP context extraction');
    return null;
  }

  return extractFromSession(ctx, telegramId) || (await extractFromRegistry(telegramId));
}

/**
 * Create MCP headers with user authentication
 */
export function createMCPHeaders(userContext: MCPUserContext): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${userContext.mcpApiKey}`,
  };
}

/**
 * Create user-aware MCP client configuration
 */
export function createUserMCPConfig(
  userContext: MCPUserContext,
  baseUrl: string,
): {
  url: string;
  headers: Record<string, string>;
  userContext: MCPUserContext;
} {
  return {
    url: baseUrl,
    headers: createMCPHeaders(userContext),
    userContext,
  };
}

/**
 * Validate that user context is complete for MCP operations
 */
export function validateUserContextForMCP(
  userContext: MCPUserContext | null,
): userContext is MCPUserContext {
  if (!userContext) {
    return false;
  }

  const required = ['username', 'telegramId', 'mcpApiKey'];
  for (const field of required) {
    if (!userContext[field as keyof MCPUserContext]) {
      logger.warn('Incomplete user context for MCP operations', {
        missingField: field,
        userContext,
      });
      return false;
    }
  }

  return true;
}

/**
 * Log MCP operation with user context
 */
export function logMCPOperation(
  operation: string,
  userContext: MCPUserContext,
  additionalData?: Record<string, unknown>,
): void {
  logger.info(`MCP operation: ${operation}`, {
    username: userContext.username,
    telegramId: userContext.telegramId,
    ...additionalData,
  });
}

/**
 * Handle MCP operation errors with user context
 */
export function handleMCPError(
  operation: string,
  userContext: MCPUserContext,
  error: unknown,
): void {
  logger.error(`MCP operation failed: ${operation}`, {
    username: userContext.username,
    telegramId: userContext.telegramId,
    error: error instanceof Error ? error.message : String(error),
  });
}
