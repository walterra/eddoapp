import Anthropic from '@anthropic-ai/sdk';

import {
  MultiTodoIntent,
  MultiTodoIntentSchema,
  TodoIntent,
  TodoIntentSchema,
} from '../types/ai-types.js';
import { appConfig } from '../utils/config.js';
import { logger } from '../utils/logger.js';

/**
 * Creates an intent parser instance for extracting todo management intents from user messages
 */
export function createIntentParser(apiKey: string) {
  const client = new Anthropic({ apiKey });

  const parseUserIntent = async (
    message: string,
    lastBotMessage?: string,
  ): Promise<TodoIntent | MultiTodoIntent | null> => {
    try {
      const response = await client.messages.create({
        model: appConfig.LLM_MODEL,
        max_tokens: 1000,
        system: buildSystemPrompt(lastBotMessage),
        messages: [
          {
            role: 'user',
            content: message,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        return null;
      }

      const parsed = JSON.parse(content.text);
      if (parsed === null) {
        return null;
      }

      // Try to parse as multi-intent first, then fall back to single intent
      try {
        return MultiTodoIntentSchema.parse(parsed);
      } catch {
        return TodoIntentSchema.parse(parsed);
      }
    } catch (error) {
      logger.error('Failed to parse user intent', { error, message });

      // If it's a Zod validation error, it means Claude tried to parse a todo request but used invalid values
      if (
        error &&
        typeof error === 'object' &&
        'name' in error &&
        error.name === 'ZodError'
      ) {
        // Extract the specific validation issue for better error messaging
        const zodError = error as {
          issues?: Array<{
            message: string;
            received?: string;
            path?: string[];
          }>;
        };
        const firstIssue = zodError.issues?.[0];

        if (firstIssue?.received && firstIssue.path?.includes('action')) {
          throw new Error(
            `I tried to use "${firstIssue.received}" as an action, but that's not valid. I can only use: create, list, update, complete, delete, start_timer, stop_timer, get_summary. Please rephrase your request.`,
          );
        }

        throw new Error(
          `I had trouble understanding your todo request format. ${firstIssue?.message || 'Please try rephrasing your request.'}`,
        );
      }

      return null;
    }
  };

  const buildSystemPrompt = (lastBotMessage?: string): string => {
    return `Parse the user's message to extract todo management intent(s). Return JSON only.

${
  lastBotMessage
    ? `CONTEXT: The bot's last response was: "${lastBotMessage}"

Consider this context when parsing the user's current message. If the user is responding with contextual phrases like "continue", "yes please", "do it", "proceed", "yes delete these todos", "confirm", "go ahead", etc., interpret their intent based on what the bot previously suggested or offered.

For contextual confirmations:
- If the bot previously listed todos and suggested deletion, "yes delete these todos" → multiple delete actions
- If the bot previously offered to create multiple todos, "yes please" → multiple create actions  
- If the bot previously suggested an update, "confirm" → update action
- Extract the specific action details from the bot's previous message and create the appropriate intent(s)`
    : ''
}

You can return either:
1. Single action: {"action": "create", "title": "task", ...}
2. Multiple actions: {"actions": [{"action": "create", "title": "task1"}, {"action": "create", "title": "task2"}], "requiresSequential": true}

Use multiple actions format when:
- Creating multiple todos at once
- Need to search then update/complete/delete a todo
- Need to perform related actions in sequence
- Batch operations requested
- User confirms a bulk operation from previous context
- Starting work on a task that might already exist (search first, then start_timer or create)

Set "requiresSequential": true when actions depend on each other (e.g., search for ID then update that ID, or search for existing task then start timer).
Set "requiresSequential": false (or omit) when actions are independent.

IMPORTANT: When user expresses intent to START WORKING on a task (phrases like "let's start with", "begin with", "work on", "tackle"):
1. First search for existing todos with that title/description  
2. If found → start_timer on the existing todo
3. If not found → create the todo then start_timer
Use the multiple actions format: [{"action": "list", "filters": {"title": "task name"}}, {"action": "start_timer", "title": "task name"}] with requiresSequential: true

CRITICAL: You MUST only use these exact action values:
- create
- list  
- update
- complete
- delete
- start_timer
- stop_timer
- get_summary

DO NOT use variations like "create_multiple", "bulk_delete", "help", or any other values. Use the multiple actions format instead.

IMPORTANT: When parsing dates, convert natural language to ISO format (YYYY-MM-DDTHH:mm:ss.sssZ):
- "tomorrow" → next day at 23:59:59.999Z
- "June 20th" or "June 20" → current/next year-06-20T23:59:59.999Z
- "next Friday" → calculate from current date
- "in 3 days" → current date + 3 days at 23:59:59.999Z
- "2025-06-25" → 2025-06-25T23:59:59.999Z
- If no time specified, default to 23:59:59.999Z

Current date for reference: ${new Date().toISOString()}

Examples:
Single actions:
- "Add buy groceries to shopping for tomorrow" → {"action": "create", "title": "buy groceries", "context": "shopping", "due": "${new Date(Date.now() + 86400000).toISOString().split('T')[0]}T23:59:59.999Z"}
- "Show me my work tasks" → {"action": "list", "filters": {"context": "work"}}

Multiple actions:
- "Create buy groceries and walk dog todos" → {"actions": [{"action": "create", "title": "buy groceries"}, {"action": "create", "title": "walk dog"}], "requiresSequential": false}
- "Find my grocery shopping todo and mark it complete" → {"actions": [{"action": "list", "filters": {"title": "grocery shopping"}}, {"action": "complete", "title": "grocery shopping"}], "requiresSequential": true}
- "Delete all todos with health context" → {"actions": [{"action": "list", "filters": {"context": "health"}}, {"action": "delete", "context": "health"}], "requiresSequential": true}
- "Create 3 work todos: meeting prep, email review, and status report" → {"actions": [{"action": "create", "title": "meeting prep", "context": "work"}, {"action": "create", "title": "email review", "context": "work"}, {"action": "create", "title": "status report", "context": "work"}], "requiresSequential": false}
- "Let's start with the leaky faucet" → {"actions": [{"action": "list", "filters": {"title": "leaky faucet"}}, {"action": "start_timer", "title": "leaky faucet"}], "requiresSequential": true}
- "I want to work on my budget spreadsheet" → {"actions": [{"action": "list", "filters": {"title": "budget spreadsheet"}}, {"action": "start_timer", "title": "budget spreadsheet"}], "requiresSequential": true}

Contextual confirmations (when lastBotMessage contains context):
- If bot suggested: "I found 3 health todos. Should I delete them?" and user says "yes delete these todos" → {"actions": [{"action": "list", "filters": {"context": "health"}}, {"action": "delete", "context": "health"}], "requiresSequential": true}
- If bot offered: "Should I create these todos for you?" and user says "yes please" → extract the specific todos from lastBotMessage and create multiple create actions

Available contexts: work, private, errands, shopping, calls, learning, health, home
Default context: private
Default due: end of current day (23:59:59.999Z)

If the message is not about todo management, return null.`;
  };

  return {
    parseUserIntent,
  };
}
