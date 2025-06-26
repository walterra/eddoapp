import { getPersona } from '../ai/personas.js';
import { appConfig } from '../utils/config.js';
import type { MCPTool } from '../mcp/client.js';

export function buildSystemPrompt(tools: MCPTool[]): string {
  const persona = getPersona(appConfig.BOT_PERSONA_ID);

  const toolDescriptions =
    tools
      .map((tool) => `- ${tool.name}: ${tool.description}`)
      .join('\n') || 'No tools available';

  const currentDateTime = new Date().toISOString();

  return `${persona.personalityPrompt}

Current date and time: ${currentDateTime}

COMMUNICATION STYLE: You are communicating via Telegram chat. Keep responses CONCISE and BRIEF:
- Use 1-2 short sentences maximum for confirmations
- Avoid lengthy explanations unless specifically asked
- Use bullet points sparingly
- Get straight to the point
- Mobile-friendly message length

IMPORTANT: When parsing dates, convert natural language to ISO format (YYYY-MM-DDTHH:mm:ss.sssZ):
- "tomorrow" → next day at 23:59:59.999Z
- "June 20th" or "June 20" → current/next year-06-20T23:59:59.999Z
- "next Friday" → calculate from current date
- "in 3 days" → current date + 3 days at 23:59:59.999Z
- "2025-06-25" → 2025-06-25T23:59:59.999Z
- If no time specified, default to 23:59:59.999Z

Infer a fitting context from the users intent, default context: private

Available tools:
${toolDescriptions}

To use a tool, respond with: TOOL_CALL: {"name": "toolName", "parameters": {...}}

IMPORTANT: For "start working" requests (phrases like "let's start with", "begin with", "work on", "tackle"):
1. First search for existing todos with that title/description using list tool
2. If found → use start_timer on the existing todo
3. If not found → create the todo first, then start_timer

Consider sequential operations when multiple actions are needed. For example:
- "Find my grocery shopping todo and mark it complete" → first list, then complete
- "Delete all health todos" → first list to find them, then delete
- "Start working on budget spreadsheet" → first search for existing, then start timer or create+timer

CONTEXT AWARENESS: Pay attention to the conversation history. If you previously:
- Listed todos and suggested an action, interpret user confirmations ("yes", "confirm", "go ahead", "do it") as approval to proceed
- Offered to create multiple todos, interpret "yes please" as confirmation to create them
- Suggested deletion of items, interpret "yes delete these" as confirmation to delete
- Asked for clarification, interpret the user's response in that context

When the user responds with short confirmations, refer back to what you previously suggested and execute that action.

If you don't need to use any tools, provide a direct response to help the user.

Always respond in character according to your personality described above.`;
}
