import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

import type { ActionRegistry } from '../services/action-registry.js';
import { appConfig } from '../utils/config.js';
import { logger } from '../utils/logger.js';

/**
 * Dynamic intent schema that adapts to available MCP actions
 */
export interface DynamicTodoIntent {
  action: string; // Dynamic - comes from ActionRegistry
  title?: string;
  description?: string;
  context?: string;
  due?: string;
  tags?: string[];
  filters?: {
    context?: string;
    completed?: boolean;
    dateFrom?: string;
    dateTo?: string;
  };
  todoId?: string;
}

export interface DynamicMultiTodoIntent {
  actions: DynamicTodoIntent[];
  requiresSequential?: boolean;
}

/**
 * Creates a dynamic intent parser that adapts to available MCP actions
 */
export function createDynamicIntentParser(
  apiKey: string,
  actionRegistry: ActionRegistry,
) {
  const client = new Anthropic({ apiKey });

  const parseUserIntent = async (
    message: string,
    lastBotMessage?: string,
  ): Promise<DynamicTodoIntent | DynamicMultiTodoIntent | null> => {
    try {
      // Get available actions dynamically
      const availableActions = actionRegistry.getAvailableActions();
      const actionList = actionRegistry.getActionListForPrompt('snake_case');

      const response = await client.messages.create({
        model: appConfig.LLM_MODEL,
        max_tokens: 1000,
        system: buildDynamicSystemPrompt(
          lastBotMessage,
          availableActions,
          actionList,
        ),
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

      // Validate the parsed intent using dynamic validation
      return validateDynamicIntent(parsed, actionRegistry);
    } catch (error) {
      logger.error('Failed to parse user intent', { error, message });

      // Enhanced error handling for dynamic actions
      if (
        error &&
        typeof error === 'object' &&
        'message' in error &&
        typeof error.message === 'string' &&
        error.message.includes('Invalid action')
      ) {
        const availableActions = actionRegistry.getAvailableActions();
        throw new Error(
          `Invalid action specified. Available actions are: ${availableActions.join(', ')}. Please rephrase your request.`,
        );
      }

      return null;
    }
  };

  const buildDynamicSystemPrompt = (
    lastBotMessage?: string,
    availableActions: string[] = [],
    actionList: string = '',
  ): string => {
    return `Parse the user's message to extract todo management intent(s). Return JSON only.

${
  lastBotMessage
    ? `CONTEXT: The bot's last response was: "${lastBotMessage}"

Consider this context when parsing the user's current message. If the user is responding with contextual phrases like "continue", "yes please", "do it", "proceed", "yes delete these todos", "confirm", "go ahead", etc., interpret their intent based on what the bot previously suggested or offered.`
    : ''
}

You can return either:
1. Single action: {"action": "action_name", "title": "task", ...}
2. Multiple actions: {"actions": [{"action": "action_name", "title": "task1"}, {"action": "action_name2", "title": "task2"}], "requiresSequential": true}

Use multiple actions format when:
- Creating multiple todos at once
- Need to search then update/complete/delete a todo
- Need to perform related actions in sequence
- Batch operations requested
- User confirms a bulk operation from previous context

Set "requiresSequential": true when actions depend on each other (e.g., search for ID then update that ID).
Set "requiresSequential": false (or omit) when actions are independent.

CRITICAL: You MUST only use these exact action values (discovered from MCP server):
${actionList}

${
  availableActions.length > 0
    ? `Available actions: ${availableActions.join(', ')}`
    : 'No actions currently available from MCP server'
}

DO NOT use any action values not listed above. The system dynamically discovers available actions from the MCP server.

IMPORTANT: When parsing dates, convert natural language to ISO format (YYYY-MM-DDTHH:mm:ss.sssZ):
- "tomorrow" → next day at 23:59:59.999Z
- "June 20th" or "June 20" → current/next year-06-20T23:59:59.999Z
- "next Friday" → calculate from current date
- "in 3 days" → current date + 3 days at 23:59:59.999Z
- "2025-06-25" → 2025-06-25T23:59:59.999Z
- If no time specified, default to 23:59:59.999Z

Current date for reference: ${new Date().toISOString()}

Available contexts: work, private, errands, shopping, calls, learning, health, home
Default context: private
Default due: end of current day (23:59:59.999Z)

If the message is not about todo management, return null.`;
  };

  /**
   * Validates dynamic intent against available actions
   */
  const validateDynamicIntent = (
    parsed: any,
    actionRegistry: ActionRegistry,
  ): DynamicTodoIntent | DynamicMultiTodoIntent => {
    // Check if it's a multi-intent
    if (parsed.actions && Array.isArray(parsed.actions)) {
      // Validate each action in the array
      const validatedActions = parsed.actions.map((action: any) =>
        validateSingleIntent(action, actionRegistry),
      );

      return {
        actions: validatedActions,
        requiresSequential: parsed.requiresSequential || false,
      };
    }

    // Single intent
    return validateSingleIntent(parsed, actionRegistry);
  };

  const validateSingleIntent = (
    intent: any,
    actionRegistry: ActionRegistry,
  ): DynamicTodoIntent => {
    if (!intent.action) {
      throw new Error('Action is required');
    }

    // Resolve action name through registry (handles aliases)
    const resolvedAction = actionRegistry.resolveActionName(intent.action);
    if (!resolvedAction) {
      const availableActions = actionRegistry.getAvailableActions();
      throw new Error(
        `Invalid action "${intent.action}". Available actions: ${availableActions.join(', ')}`,
      );
    }

    return {
      action: resolvedAction,
      title: intent.title,
      description: intent.description,
      context: intent.context,
      due: intent.due,
      tags: intent.tags,
      filters: intent.filters,
      todoId: intent.todoId,
    };
  };

  return {
    parseUserIntent,
  };
}