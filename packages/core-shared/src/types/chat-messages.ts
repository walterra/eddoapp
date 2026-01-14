/**
 * Chat message types for AI agent conversations.
 */

/** Model provider identifier */
export type ModelProvider =
  | 'anthropic'
  | 'openai'
  | 'google'
  | 'bedrock'
  | 'vertex'
  | 'openrouter'
  | 'groq'
  | 'deepseek'
  | 'mistral'
  | 'ollama';

/** Message role in conversation */
export type MessageRole = 'user' | 'assistant' | 'toolResult' | 'bashExecution' | 'custom';

/** Stop reason for assistant messages */
export type StopReason = 'stop' | 'length' | 'toolUse' | 'error' | 'aborted';

/** Thinking level for reasoning models */
export type ThinkingLevel = 'off' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';

/** Text content block */
export interface TextContent {
  type: 'text';
  text: string;
}

/** Thinking content block */
export interface ThinkingContent {
  type: 'thinking';
  thinking: string;
}

/** Tool call content block */
export interface ToolCallContent {
  type: 'toolCall';
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/** Image content block */
export interface ImageContent {
  type: 'image';
  source: { type: 'base64'; mediaType: string; data: string } | { type: 'url'; url: string };
}

export type ContentBlock = TextContent | ThinkingContent | ToolCallContent | ImageContent;

/** Token usage statistics */
export interface TokenUsage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  cost?: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    total: number;
  };
}

/** Attachment in user message */
export interface MessageAttachment {
  id: string;
  type: 'image' | 'file';
  fileName: string;
  mimeType: string;
  size: number;
  content: string;
  extractedText?: string | null;
  preview?: string | null;
}

/** User message in conversation */
export interface UserMessage {
  role: 'user';
  content: string | ContentBlock[];
  timestamp?: number;
  attachments?: MessageAttachment[];
}

/** Assistant message in conversation */
export interface AssistantMessage {
  role: 'assistant';
  content: ContentBlock[];
  api?: string;
  provider?: ModelProvider;
  model?: string;
  usage?: TokenUsage;
  stopReason?: StopReason;
  timestamp?: number;
}

/** Tool result message */
export interface ToolResultMessage {
  role: 'toolResult';
  toolCallId: string;
  toolName: string;
  content: ContentBlock[];
  isError: boolean;
  timestamp?: number;
}

/** Bash execution message (from manual bash RPC command) */
export interface BashExecutionMessage {
  role: 'bashExecution';
  command: string;
  output: string;
  exitCode: number;
  cancelled: boolean;
  truncated: boolean;
  fullOutputPath?: string | null;
  timestamp?: number;
}

/** Custom message from extension */
export interface CustomMessage {
  role: 'custom';
  content: string | ContentBlock[];
  customType: string;
  display: boolean;
  details?: Record<string, unknown>;
  timestamp?: number;
}

/** Union of all message types */
export type ChatMessage =
  | UserMessage
  | AssistantMessage
  | ToolResultMessage
  | BashExecutionMessage
  | CustomMessage;

/** Type guard for user messages */
export function isUserMessage(message: ChatMessage): message is UserMessage {
  return message.role === 'user';
}

/** Type guard for assistant messages */
export function isAssistantMessage(message: ChatMessage): message is AssistantMessage {
  return message.role === 'assistant';
}

/** Type guard for tool result messages */
export function isToolResultMessage(message: ChatMessage): message is ToolResultMessage {
  return message.role === 'toolResult';
}
