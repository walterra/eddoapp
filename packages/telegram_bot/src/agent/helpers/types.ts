/**
 * Shared types for agent helpers
 */

export interface AgentState {
  input: string;
  history: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
  }>;
  done: boolean;
  output?: string;
  toolResults: Array<{ toolName: string; result: unknown; timestamp: number }>;
  systemPrompt?: string;
}

export interface ToolCall {
  name: string;
  parameters: Record<string, unknown>;
}

export interface ConversationalPart {
  text: string;
  isMarkdown: boolean;
}

export interface ToolResult {
  toolName: string;
  result: unknown;
  timestamp: number;
}
