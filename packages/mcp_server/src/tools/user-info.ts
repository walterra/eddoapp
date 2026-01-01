/**
 * User Info Tool - Get current authenticated user information
 */
import { z } from 'zod';

import type { ToolContext } from './types.js';

/** Tool description for LLM consumption */
export const getUserInfoDescription = 'Get current authenticated user information';

/** Zod schema for getUserInfo parameters */
export const getUserInfoParameters = z.object({});

/**
 * Execute handler for getUserInfo tool
 */
export function executeGetUserInfo(_args: Record<string, never>, context: ToolContext): string {
  if (!context.session) {
    return JSON.stringify({
      summary: 'Anonymous user session',
      data: {
        userId: 'anonymous',
        dbName: 'default',
        authenticated: false,
      },
      metadata: {
        operation: 'user_info',
        timestamp: new Date().toISOString(),
        auth_status: 'anonymous',
      },
    });
  }

  return JSON.stringify({
    summary: 'User information retrieved',
    data: {
      userId: context.session.userId,
      dbName: context.session.dbName,
      authenticated: true,
    },
    metadata: {
      operation: 'user_info',
      timestamp: new Date().toISOString(),
    },
  });
}
