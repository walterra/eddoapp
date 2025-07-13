/**
 * Generic persona interface and types
 */

export interface Persona {
  id: string;
  personalityPrompt: string; // Contains only personality, not MCP tools
  acknowledgmentEmoji: string;
  messages: {
    welcomeContent: string;
    closingMessage: string;
  };
}
