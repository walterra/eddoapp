import type { BotContext } from '../bot/bot.js';
import { logger } from '../utils/logger.js';
import { getUserContextForMCP } from '../utils/user-lookup.js';

/**
 * User context for MCP operations
 */
export interface MCPUserContext {
  username: string;
  databaseName: string;
  telegramId: number;
}

/**
 * Extract user context from bot session for MCP operations
 */
export async function extractUserContextForMCP(
  ctx: BotContext,
): Promise<MCPUserContext | null> {
  const telegramId = ctx.from?.id;

  if (!telegramId) {
    logger.warn('No Telegram ID available for MCP context extraction');
    return null;
  }

  // Try to get user context from session first (already loaded during auth)
  if (ctx.session?.user) {
    logger.debug('Using cached user context from session', {
      telegramId,
      username: ctx.session.user.username,
    });

    return {
      username: ctx.session.user.username,
      databaseName: ctx.session.user.database_name,
      telegramId: ctx.session.user.telegram_id,
    };
  }

  // Fallback to lookup if not in session
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
      databaseName: userContext.databaseName,
      telegramId,
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
 * Create MCP headers with user authentication
 */
export function createMCPHeaders(
  userContext: MCPUserContext,
): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-User-ID': userContext.username,
    'X-Database-Name': userContext.databaseName,
    'X-Telegram-ID': userContext.telegramId.toString(),
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

  const required = ['username', 'databaseName', 'telegramId'];
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
    databaseName: userContext.databaseName,
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
    databaseName: userContext.databaseName,
    telegramId: userContext.telegramId,
    error: error instanceof Error ? error.message : String(error),
  });
}
