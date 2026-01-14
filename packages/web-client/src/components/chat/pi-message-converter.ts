/**
 * Converts pi-coding-agent messages to assistant-ui ThreadMessageLike format.
 */

import type { ThreadMessageLike } from '@assistant-ui/react';

/** JSON-compatible object type */
type JSONObject = Record<string, unknown>;

/** pi-coding-agent content block types */
interface PiTextContent {
  type: 'text';
  text: string;
}

interface PiThinkingContent {
  type: 'thinking';
  thinking: string;
}

interface PiToolCallContent {
  type: 'toolCall';
  id: string;
  name: string;
  arguments: JSONObject;
}

/** Pi-coding-agent image content (direct base64 format) */
interface PiImageContent {
  type: 'image';
  data: string; // base64 encoded image data
  mimeType: string; // e.g., "image/jpeg", "image/png"
}

type PiContentBlock = PiTextContent | PiThinkingContent | PiToolCallContent | PiImageContent;

/** pi-coding-agent message types */
export interface PiUserMessage {
  role: 'user';
  content: string | PiContentBlock[];
  timestamp?: number;
}

export interface PiAssistantMessage {
  role: 'assistant';
  content: PiContentBlock[];
  timestamp?: number;
  stopReason?: string;
}

export interface PiToolResultMessage {
  role: 'toolResult';
  toolCallId: string;
  toolName: string;
  content: PiContentBlock[];
  isError: boolean;
  timestamp?: number;
}

export type PiMessage = PiUserMessage | PiAssistantMessage | PiToolResultMessage;

/** Convert pi text content to string */
function extractTextContent(content: string | PiContentBlock[]): string {
  if (typeof content === 'string') return content;
  return content
    .filter((c): c is PiTextContent => c.type === 'text')
    .map((c) => c.text)
    .join('\n');
}

/** Extract images from content blocks */
function extractImages(content: PiContentBlock[]): ImagePart[] {
  return content
    .filter((c): c is PiImageContent => c.type === 'image')
    .map(
      (img): ImagePart => ({
        type: 'image',
        image: `data:${img.mimeType};base64,${img.data}`,
      }),
    );
}

/** Image content part */
type ImagePart = { type: 'image'; image: string };

/** Assistant-ui content part type */
type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'reasoning'; text: string }
  | {
      type: 'tool-call';
      toolCallId: string;
      toolName: string;
      args: JSONObject;
      argsText: string;
      result?: string;
      resultImages?: ImagePart[];
      isError?: boolean;
    }
  | ImagePart;

/** Convert pi content block to assistant-ui format */
function convertContentBlock(
  block: PiContentBlock,
  toolResults: Map<string, PiToolResultMessage>,
): ContentPart | null {
  switch (block.type) {
    case 'text':
      return { type: 'text', text: block.text };

    case 'thinking':
      return { type: 'reasoning', text: block.thinking };

    case 'toolCall': {
      const result = toolResults.get(block.id);
      const resultImages = result ? extractImages(result.content) : [];
      return {
        type: 'tool-call',
        toolCallId: block.id,
        toolName: block.name,
        args: block.arguments,
        argsText: JSON.stringify(block.arguments, null, 2),
        result: result ? extractTextContent(result.content) : undefined,
        resultImages, // Images from tool result
        isError: result?.isError,
      };
    }

    case 'image':
      return {
        type: 'image',
        image: `data:${block.mimeType};base64,${block.data}`,
      };

    default:
      return null;
  }
}

/** Build a map of tool results by toolCallId */
function buildToolResultsMap(messages: PiMessage[]): Map<string, PiToolResultMessage> {
  const map = new Map<string, PiToolResultMessage>();
  for (const msg of messages) {
    if (msg.role === 'toolResult') {
      map.set(msg.toolCallId, msg);
    }
  }
  return map;
}

/** Convert user message to assistant-ui format */
function convertUserMessage(msg: PiUserMessage, id: string, createdAt: Date): ThreadMessageLike {
  const text = typeof msg.content === 'string' ? msg.content : extractTextContent(msg.content);
  return { id, role: 'user', content: [{ type: 'text', text }], createdAt };
}

/** Convert assistant message content blocks */
function convertAssistantContent(
  blocks: PiContentBlock[],
  toolResults: Map<string, PiToolResultMessage>,
): ContentPart[] {
  const content: ContentPart[] = [];

  for (const block of blocks) {
    const converted = convertContentBlock(block, toolResults);
    if (!converted) continue;

    content.push(converted);

    // Add tool result images after tool call
    if (converted.type === 'tool-call' && converted.resultImages?.length) {
      content.push(...converted.resultImages);
    }
  }

  return content;
}

/** Convert assistant message to assistant-ui format */
function convertAssistantMessage(
  msg: PiAssistantMessage,
  id: string,
  createdAt: Date,
  toolResults: Map<string, PiToolResultMessage>,
): ThreadMessageLike {
  const content = convertAssistantContent(msg.content, toolResults);
  return { id, role: 'assistant', content: content as ThreadMessageLike['content'], createdAt };
}

/** Convert a single pi message to assistant-ui format */
function convertMessage(
  msg: PiMessage,
  index: number,
  toolResults: Map<string, PiToolResultMessage>,
): ThreadMessageLike | null {
  if (msg.role === 'toolResult') return null;

  const id = `msg-${index}-${msg.timestamp ?? Date.now()}`;
  const createdAt = msg.timestamp ? new Date(msg.timestamp) : new Date();

  if (msg.role === 'user') return convertUserMessage(msg, id, createdAt);
  if (msg.role === 'assistant') return convertAssistantMessage(msg, id, createdAt, toolResults);

  return null;
}

/** Convert array of pi messages to assistant-ui format */
export function convertPiMessages(messages: PiMessage[]): ThreadMessageLike[] {
  const toolResults = buildToolResultsMap(messages);
  return messages
    .map((msg, index) => convertMessage(msg, index, toolResults))
    .filter((m): m is ThreadMessageLike => m !== null);
}

/** Convert a single message for the converter callback */
export function createMessageConverter(
  allMessages: PiMessage[],
): (msg: PiMessage, index: number) => ThreadMessageLike | null {
  const toolResults = buildToolResultsMap(allMessages);
  return (msg, index) => convertMessage(msg, index, toolResults);
}
