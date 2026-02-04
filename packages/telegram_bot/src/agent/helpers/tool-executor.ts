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

const MAX_TOOL_RESULT_CHARS = 12000;
const MAX_TOOL_RESULT_ITEMS = 50;
const MAX_DESCRIPTION_CHARS = 200;

interface TextContentBlock {
  type: 'text';
  text: string;
}

interface ToolResponsePagination {
  count?: number;
  limit?: number;
  has_more?: boolean;
}

interface ToolResponse {
  summary?: string;
  data?: unknown;
  metadata?: Record<string, unknown>;
  pagination?: ToolResponsePagination;
  error?: string;
}

interface TodoSummary {
  _id: string;
  title: string;
  context?: string;
  tags?: string[];
  due?: string;
  completed?: string | null;
  description?: string;
  link?: string | null;
  externalId?: string | null;
  parentId?: string | null;
}

function isTextContentBlock(value: unknown): value is TextContentBlock {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return record.type === 'text' && typeof record.text === 'string';
}

function extractToolResultText(toolResult: unknown): string | null {
  if (typeof toolResult === 'string') return toolResult;
  if (!Array.isArray(toolResult)) return null;

  const textBlocks = toolResult.filter(isTextContentBlock);
  if (textBlocks.length === 0) return null;
  return textBlocks.map((block) => block.text).join('\n');
}

function truncateText(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  return `${value.substring(0, maxChars)}…[TRUNCATED]`;
}

function parseToolResponse(text: string): ToolResponse | null {
  try {
    return JSON.parse(text) as ToolResponse;
  } catch {
    return null;
  }
}

function getStringField(record: Record<string, unknown>, field: string): string | undefined {
  const value = record[field];
  return typeof value === 'string' ? value : undefined;
}

function getNullableStringField(
  record: Record<string, unknown>,
  field: string,
): string | null | undefined {
  const value = record[field];
  if (typeof value === 'string') return value;
  if (value === null) return null;
  return undefined;
}

function getStringArrayField(record: Record<string, unknown>, field: string): string[] | undefined {
  const value = record[field];
  if (!Array.isArray(value)) return undefined;
  return value.filter((item) => typeof item === 'string') as string[];
}

function getTruncatedDescription(record: Record<string, unknown>): string | undefined {
  const description = getStringField(record, 'description');
  if (!description) return undefined;
  return truncateText(description, MAX_DESCRIPTION_CHARS);
}

function toTodoSummary(item: unknown): TodoSummary | null {
  if (!item || typeof item !== 'object') return null;
  const record = item as Record<string, unknown>;
  const id = getStringField(record, '_id');
  const title = getStringField(record, 'title');
  if (!id || !title) return null;

  return {
    _id: id,
    title,
    context: getStringField(record, 'context'),
    tags: getStringArrayField(record, 'tags'),
    due: getStringField(record, 'due'),
    completed: getNullableStringField(record, 'completed'),
    description: getTruncatedDescription(record),
    link: getNullableStringField(record, 'link'),
    externalId: getNullableStringField(record, 'externalId'),
    parentId: getNullableStringField(record, 'parentId'),
  };
}

function summarizeTodoList(items: unknown[]): TodoSummary[] {
  return items.map(toTodoSummary).filter((item): item is TodoSummary => item !== null);
}

function buildTruncatedMetadata(
  metadata: Record<string, unknown> | undefined,
  total: number,
  limit: number,
): Record<string, unknown> {
  return {
    ...metadata,
    truncated: true,
    total_count: total,
    returned_count: limit,
  };
}

function limitResponseArray(response: ToolResponse, items: unknown[]): ToolResponse {
  if (items.length <= MAX_TOOL_RESULT_ITEMS) return response;

  const truncated = items.slice(0, MAX_TOOL_RESULT_ITEMS);
  return {
    ...response,
    summary: response.summary
      ? `${response.summary} (showing first ${MAX_TOOL_RESULT_ITEMS} of ${items.length})`
      : response.summary,
    data: truncated,
    pagination: {
      count: truncated.length,
      limit: MAX_TOOL_RESULT_ITEMS,
      has_more: true,
    },
    metadata: buildTruncatedMetadata(response.metadata, items.length, truncated.length),
  };
}

function limitSearchResults(response: ToolResponse, data: Record<string, unknown>): ToolResponse {
  const results = Array.isArray(data.results) ? data.results : null;
  if (!results || results.length <= MAX_TOOL_RESULT_ITEMS) return response;

  const truncated = results.slice(0, MAX_TOOL_RESULT_ITEMS).map((item) => {
    const record = item as Record<string, unknown>;
    const todo = record.todo ?? record;
    const summary = toTodoSummary(todo);
    return summary ? { _score: record._score, ...summary } : item;
  });

  return {
    ...response,
    summary: response.summary
      ? `${response.summary} (showing first ${MAX_TOOL_RESULT_ITEMS} of ${results.length})`
      : response.summary,
    data: {
      ...data,
      results: truncated,
    },
    metadata: buildTruncatedMetadata(response.metadata, results.length, truncated.length),
  };
}

function limitToolResponse(toolName: string, response: ToolResponse): ToolResponse {
  if (toolName === 'listTodos' && Array.isArray(response.data)) {
    const summarized = summarizeTodoList(response.data as unknown[]);
    return limitResponseArray({ ...response, data: summarized }, summarized);
  }

  if (toolName === 'searchTodos' && response.data && typeof response.data === 'object') {
    return limitSearchResults(response, response.data as Record<string, unknown>);
  }

  if (Array.isArray(response.data)) {
    return limitResponseArray(response, response.data as unknown[]);
  }

  return response;
}

function buildToolResultMessage(toolName: string, toolResult: unknown): string {
  const resultText = extractToolResultText(toolResult);
  if (!resultText) {
    return truncateText(JSON.stringify(toolResult), MAX_TOOL_RESULT_CHARS);
  }

  const parsed = parseToolResponse(resultText);
  if (!parsed) {
    return truncateText(resultText, MAX_TOOL_RESULT_CHARS);
  }

  const limited = limitToolResponse(toolName, parsed);
  return truncateText(JSON.stringify(limited), MAX_TOOL_RESULT_CHARS);
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

    const toolResultMessage = buildToolResultMessage(toolCall.name, toolResult);

    logger.info('✅ Tool Execution Success', {
      iterationId,
      toolName: toolCall.name,
      resultPreview: truncateText(toolResultMessage, 200),
    });

    state.history.push({
      role: 'user',
      content: `Tool "${toolCall.name}" result: ${toolResultMessage}`,
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
