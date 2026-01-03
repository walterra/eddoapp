/**
 * Tool execution wrapper with OpenTelemetry tracing support
 */
import { context, trace } from '@opentelemetry/api';

import { logger } from '../utils/logger.js';
import type { ToolContext, UserSession } from './types.js';

// Store extracted trace context per request (keyed by session)
export const requestContexts = new WeakMap<object, ReturnType<typeof context.active>>();

/**
 * Wraps a tool execution with tracing span, preserving distributed trace context
 * @param toolName - Name of the tool for span naming
 * @param executeFn - Tool execution function
 * @returns Wrapped function with tracing
 */
export function wrapToolExecution<TArgs, TResult>(
  toolName: string,
  executeFn: (args: TArgs, toolContext: ToolContext) => TResult | Promise<TResult>,
): (args: TArgs, toolContext: ToolContext) => Promise<TResult> {
  return async (args: TArgs, toolContext: ToolContext) => {
    const extractedContext = toolContext.session
      ? requestContexts.get(toolContext.session)
      : undefined;
    const parentContext = extractedContext ?? context.active();

    const tracer = trace.getTracer('eddo-mcp-server');
    const span = tracer.startSpan(
      `mcp_tool_${toolName}`,
      {
        attributes: {
          'mcp.tool': toolName,
          'user.id': toolContext.session?.userId ?? 'anonymous',
          'user.name': toolContext.session?.username ?? 'anonymous',
        },
      },
      parentContext,
    );

    return context.with(trace.setSpan(parentContext, span), async () => {
      try {
        const result = await Promise.resolve(executeFn(args, toolContext));
        span.setAttribute('mcp.result', 'success');
        logger.info({ toolName, userId: toolContext.session?.userId }, 'MCP tool executed');
        span.end();
        return result;
      } catch (error) {
        span.setAttribute('mcp.result', 'error');
        span.setAttribute('error.message', error instanceof Error ? error.message : String(error));
        span.recordException(error instanceof Error ? error : new Error(String(error)));
        logger.error({ toolName, error }, 'MCP tool execution failed');
        span.end();
        throw error;
      }
    });
  };
}

/**
 * Stores trace context for a user session
 * @param session - User session object
 * @param ctx - Trace context to store
 */
export function storeTraceContext(
  session: UserSession,
  ctx: ReturnType<typeof context.active>,
): void {
  requestContexts.set(session, ctx);
}
