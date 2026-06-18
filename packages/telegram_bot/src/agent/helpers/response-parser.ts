/**
 * Response parsing utilities for the agent
 */
import { logger } from '../../utils/logger.js';
import { hasMarkdownFormatting, validateTelegramMarkdown } from '../../utils/markdown.js';

import type { ConversationalPart, ToolCall } from './types.js';

const TOOL_CALL_MARKER = 'TOOL_CALL:';

/** Removes Markdown code fences around tool JSON. */
function stripJsonCodeFence(value: string): string {
  return value
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
}

/** Finds the first balanced JSON object in text. */
function extractJsonObject(value: string): string | null {
  const start = value.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < value.length; index++) {
    const char = value[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '"') inString = !inString;
    if (inString) continue;
    if (char === '{') depth++;
    if (char === '}') depth--;
    if (depth === 0) return value.slice(start, index + 1);
  }

  return null;
}

/** Extracts raw tool JSON from a model response. */
function extractToolJson(response: string): string | null {
  const markerIndex = response.indexOf(TOOL_CALL_MARKER);
  if (markerIndex === -1) return null;

  const afterMarker = response.slice(markerIndex + TOOL_CALL_MARKER.length).trim();
  return extractJsonObject(stripJsonCodeFence(afterMarker));
}

/** Parses a tool call from the LLM response. */
export function parseToolCall(response: string): ToolCall | null {
  const toolJson = extractToolJson(response);
  if (!toolJson) return null;

  try {
    return JSON.parse(toolJson) as ToolCall;
  } catch (error) {
    logger.error('Failed to parse tool call', { response, toolJson, error });
    return null;
  }
}

/**
 * Extracts a STATUS message from the LLM response.
 * Format: STATUS: <short message>
 * This is used for intermediate feedback during tool calls.
 */
export function extractStatusMessage(response: string): string | null {
  const statusMatch = response.match(/^STATUS:\s*(.+)$/m);
  if (!statusMatch) {
    return null;
  }
  return statusMatch[1].trim();
}

/**
 * Extracts the conversational part from an LLM response (excluding tool calls and status)
 */
export function extractConversationalPart(response: string): ConversationalPart | null {
  const conversationalPart = response
    .split('\n')
    .filter((line) => !line.trim().startsWith('TOOL_CALL'))
    .filter((line) => !line.trim().startsWith('STATUS:'))
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
