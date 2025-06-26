/**
 * Service for building dynamic system prompts by combining persona personality
 * with dynamically discovered MCP tool capabilities
 */
import type { MCPToolInfo } from '../mcp/info-service.js';
import type { Persona } from './persona-types.js';

export interface McpToolForPrompt {
  name: string;
  description: string;
}

export class PersonaPromptBuilder {
  /**
   * Builds a complete system prompt combining persona personality with MCP capabilities
   */
  static async buildSystemPrompt(
    persona: Persona,
    mcpTools: MCPToolInfo[],
  ): Promise<string> {
    const toolDescriptions = this.formatToolsForPrompt(mcpTools);

    return `${persona.personalityPrompt}

Your capabilities through the MCP server:
${toolDescriptions}

${this.getCommonInstructions()}`;
  }

  /**
   * Formats MCP tools for inclusion in system prompt
   */
  private static formatToolsForPrompt(tools: MCPToolInfo[]): string {
    if (tools.length === 0) {
      return '- No MCP tools currently available';
    }

    return tools
      .map((tool) => `- **${tool.name}**: ${tool.description}`)
      .join('\n');
  }

  /**
   * Returns common instructions that apply to all personas
   */
  private static getCommonInstructions(): string {
    return `Todo Properties:
- title: Main task name (required)
- description: Detailed notes (markdown supported)
- context: GTD category (work, private, errands, shopping, calls, learning, health, home)
- due: ISO date when task should be completed (defaults to end of current day)
- tags: Labels for categorization
- repeat: Days to repeat after completion (null for no repeat)
- link: Associated URL or reference
- completed: ISO timestamp when completed (null if not done)
- active: Time tracking sessions (start/end timestamps)

Date Handling:
- Always convert natural language dates to ISO format (YYYY-MM-DDTHH:mm:ss.sssZ)
- Default time is 23:59:59.999Z if not specified
- Understand "tomorrow", "next Friday", "June 25th", "in 3 days", etc.
- Use current date as reference for relative dates

When users make requests:
1. Parse their intent carefully, understanding both explicit requests and implied needs
2. Extract all relevant information (title, context, dates, etc.)
3. Use appropriate MCP tools to fulfill their request
4. When updating/completing/deleting, first list to find the correct todo ID
5. Provide helpful responses confirming actions taken`;
  }
}
