/**
 * Generic persona interface and types
 */

export interface Persona {
  id: string;
  name: string;
  personalityPrompt: string; // Renamed from systemPrompt - contains only personality, not MCP tools
  acknowledgmentEmoji: string;
  acknowledgmentTemplates: {
    action: string; // Generic template: "{emoji} {action_phrase}! Let me {action_description}..."
    fallback: string;
  };
  messages: {
    roleDescription: string;
    welcomeContent: string;
    closingMessage: string;
  };
}
