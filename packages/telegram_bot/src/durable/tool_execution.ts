import { getTracer } from '@eddo/core-instrumentation';
import { SpanStatusCode } from '@opentelemetry/api';
import type { MCPClient } from '../mcp/client.js';
import type { MCPUserContext } from '../mcp/user-context.js';
import { normalizeToolOutput, type ToolOutput } from './tool_output.js';

/** Traces authenticated MCP execution without exporting arguments, credentials, or returned data. */
export function invokeMcpTool(
  client: Pick<MCPClient, 'invoke'>,
  name: string,
  args: Record<string, unknown>,
  user: MCPUserContext,
): Promise<ToolOutput> {
  return getTracer('eddo-telegram-bot').startActiveSpan(
    'mcp_tool_execute',
    {
      attributes: {
        'mcp.tool': name,
        'mcp.operation': 'invoke',
        'user.id': String(user.telegramId),
      },
    },
    async (span) => {
      try {
        const result = normalizeToolOutput(await client.invoke(name, args, user));
        span.setAttribute('mcp.is_error', result.isError);
        span.setStatus({ code: result.isError ? SpanStatusCode.ERROR : SpanStatusCode.OK });
        if (result.isError) span.recordException(new Error('MCP tool returned an error'));
        return result;
      } catch (error) {
        span.recordException(new Error('MCP tool invocation failed'));
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw error;
      } finally {
        span.end();
      }
    },
  );
}
