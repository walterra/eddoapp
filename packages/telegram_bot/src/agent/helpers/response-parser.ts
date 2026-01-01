/**
 * Response parsing utilities for the agent
 */
import { logger } from '../../utils/logger.js';
import { hasMarkdownFormatting, validateTelegramMarkdown } from '../../utils/markdown.js';

import type { ConversationalPart, ToolCall } from './types.js';

/**
 * Parses a tool call from the LLM response
 */
export function parseToolCall(response: string): ToolCall | null {
  const toolCallMatch = response.match(/TOOL_CALL:\s*({.*})/);
  if (!toolCallMatch) {
    return null;
  }

  try {
    return JSON.parse(toolCallMatch[1]) as ToolCall;
  } catch (error) {
    logger.error('Failed to parse tool call', { response, error });
    return null;
  }
}

/**
 * Extracts the conversational part from an LLM response (excluding tool calls)
 */
export function extractConversationalPart(response: string): ConversationalPart | null {
  const conversationalPart = response
    .split('\n')
    .filter((line) => !line.trim().startsWith('TOOL_CALL'))
    .join('\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim();

  if (!conversationalPart) {
    return null;
  }

  const hasMarkdown = hasMarkdownFormatting(conversationalPart);
  let isValidMarkdown = false;

  if (hasMarkdown) {
    const validation = validateTelegramMarkdown(conversationalPart);
    isValidMarkdown = validation.isValid;

    if (!isValidMarkdown) {
      logger.debug('Invalid markdown detected in conversational part', {
        error: validation.error,
        text: conversationalPart.substring(0, 100) + '...',
      });
    }
  }

  return {
    text: conversationalPart,
    isMarkdown: hasMarkdown && isValidMarkdown,
  };
}
