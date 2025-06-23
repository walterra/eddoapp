import { MultiTodoIntent, TodoIntent, getClaudeAI } from '../../ai/claude.js';
import { getMCPClient } from '../../mcp/client.js';
import { logger } from '../../utils/logger.js';
import { BotContext } from '../bot.js';

/**
 * Handle general text messages with AI processing
 */
export async function handleMessage(ctx: BotContext): Promise<void> {
  const messageText = ctx.message?.text;
  const userId = ctx.from?.id;

  if (!messageText || !userId) {
    return;
  }

  logger.info('Processing message with AI', { userId, messageText });

  const mcpClient = getMCPClient();
  const claude = getClaudeAI();

  try {
    // Parse user intent with AI
    let intent: TodoIntent | MultiTodoIntent | null = null;

    try {
      intent = await claude.parseUserIntent(messageText, ctx.session.lastBotMessage);
    } catch (parseError) {
      // Handle parsing errors (e.g., invalid enum values from Claude)
      logger.error('Intent parsing failed', { error: parseError, messageText });

      const errorResponse = await claude.generateResponse(
        userId.toString(),
        messageText,
        {
          mcpResponse: `Parsing Error: ${parseError instanceof Error ? parseError.message : String(parseError)}. Please rephrase your request.`,
          action: 'parsing_error',
        },
      );

      await ctx.reply(errorResponse.content, { parse_mode: 'Markdown' });
      ctx.session.lastBotMessage = errorResponse.content;
      return;
    }

    if (!intent) {
      // Not a todo request, just have a conversation
      const response = await claude.generateResponse(
        userId.toString(),
        messageText,
      );
      await ctx.reply(response.content, { parse_mode: 'Markdown' });
      ctx.session.lastBotMessage = response.content;
      return;
    }

    // Send acknowledgment
    const acknowledgment = claude.generateAcknowledgment(intent);
    await ctx.reply(acknowledgment);

    // Process the todo intent with MCP
    let mcpResponse = '';
    let actionDescription = '';

    try {
      // Ensure MCP client is connected
      if (!mcpClient.isClientConnected()) {
        await mcpClient.connect();
      }

      const result = await processToDoIntent(mcpClient, intent);
      mcpResponse = result.response;
      actionDescription = result.description;

      // Generate AI response with MCP context
      const aiResponse = await claude.generateResponse(
        userId.toString(),
        messageText,
        { mcpResponse, action: actionDescription },
      );

      await ctx.reply(aiResponse.content, { parse_mode: 'Markdown' });
      ctx.session.lastBotMessage = aiResponse.content;
    } catch (mcpError) {
      logger.error('MCP operation failed', { error: mcpError, intent });

      // Try to give a helpful error response
      const errorResponse = await claude.generateResponse(
        userId.toString(),
        messageText,
        {
          mcpResponse: `Error: ${mcpError instanceof Error ? mcpError.message : String(mcpError)}`,
          action: 'error',
        },
      );

      await ctx.reply(errorResponse.content, { parse_mode: 'Markdown' });
      ctx.session.lastBotMessage = errorResponse.content;
    }
  } catch (error) {
    logger.error('Error in message handler', { error, userId, messageText });
    const fallbackMessage = '🎩 My apologies, I encountered an issue processing your request. Please try again in a moment.';
    await ctx.reply(fallbackMessage);
    ctx.session.lastBotMessage = fallbackMessage;
  }
}

/**
 * Process todo intent(s) using MCP client
 */
async function processToDoIntent(
  mcpClient: ReturnType<typeof getMCPClient>,
  intent: TodoIntent | MultiTodoIntent,
): Promise<{ response: string; description: string }> {
  // Handle multi-intent
  if ('actions' in intent) {
    return await processMultipleActions(mcpClient, intent);
  }

  // Handle single intent
  const response = await processSingleAction(mcpClient, intent);
  const description = getSingleActionDescription(intent);

  return { response, description };
}

/**
 * Process multiple actions with dependency handling
 */
async function processMultipleActions(
  mcpClient: ReturnType<typeof getMCPClient>,
  multiIntent: MultiTodoIntent,
): Promise<{ response: string; description: string }> {
  const results: string[] = [];
  const descriptions: string[] = [];
  const actionContext: Map<string, unknown> = new Map(); // Store results for dependent actions

  for (let i = 0; i < multiIntent.actions.length; i++) {
    const action = multiIntent.actions[i];

    try {
      // Enhance action with context from previous actions if needed
      const enhancedAction = await enhanceActionWithContext(
        action,
        actionContext,
      );

      const response = await processSingleAction(mcpClient, enhancedAction);
      const description = getSingleActionDescription(enhancedAction);

      results.push(`Action ${i + 1}: ${response}`);
      descriptions.push(description);

      // Store result for potential use by subsequent actions
      actionContext.set(`action_${i}`, {
        action: enhancedAction,
        response,
        index: i,
      });

      // For list actions, store the todos for subsequent actions
      if (enhancedAction.action === 'list') {
        try {
          const listResult = JSON.parse(response.split(':\n')[1] || '[]');
          actionContext.set('last_search_results', listResult);
        } catch {
          // Ignore JSON parse errors
        }
      }
    } catch (error) {
      const errorMsg = `Action ${i + 1} failed: ${error instanceof Error ? error.message : String(error)}`;
      results.push(errorMsg);
      descriptions.push(`failed ${getSingleActionDescription(action)}`);

      // If sequential processing required and an action fails, stop
      if (multiIntent.requiresSequential) {
        break;
      }
    }
  }

  const combinedResponse = results.join('\n\n');
  const combinedDescription = `${descriptions.length} actions: ${descriptions.join(', ')}`;

  return { response: combinedResponse, description: combinedDescription };
}

/**
 * Enhance action with context from previous actions
 */
async function enhanceActionWithContext(
  action: TodoIntent,
  actionContext: Map<string, unknown>,
): Promise<TodoIntent> {
  // If action needs todoId and doesn't have one, try to find it from previous search results
  if (
    !action.todoId &&
    ['update', 'complete', 'delete', 'start_timer', 'stop_timer'].includes(
      action.action,
    )
  ) {
    const searchResults = actionContext.get('last_search_results');

    if (
      searchResults &&
      Array.isArray(searchResults) &&
      searchResults.length > 0
    ) {
      // Find todo by title if provided
      if (action.title) {
        const actionTitle = action.title.toLowerCase();
        const matchingTodo = searchResults.find(
          (todo: { title?: string; _id: string }) =>
            todo.title?.toLowerCase().includes(actionTitle),
        );
        if (matchingTodo) {
          return { ...action, todoId: matchingTodo._id };
        }
      }

      // Otherwise use the first result
      const firstResult = searchResults[0] as { _id: string };
      return { ...action, todoId: firstResult._id };
    }
  }

  return action;
}

/**
 * Process a single action
 */
async function processSingleAction(
  mcpClient: ReturnType<typeof getMCPClient>,
  intent: TodoIntent,
): Promise<string> {
  switch (intent.action) {
    case 'create': {
      if (!intent.title) {
        throw new Error('Todo title is required');
      }
      return await mcpClient.createTodo({
        title: intent.title,
        description: intent.description,
        context: intent.context || 'private',
        due: intent.due,
        tags: intent.tags,
      });
    }

    case 'list': {
      const todos = await mcpClient.listTodos(intent.filters || {});
      return `Found ${todos.length} todos:\n${JSON.stringify(todos, null, 2)}`;
    }

    case 'update': {
      if (!intent.todoId) {
        throw new Error('Todo ID is required for updates');
      }
      return await mcpClient.updateTodo({
        id: intent.todoId,
        title: intent.title,
        description: intent.description,
        context: intent.context,
        due: intent.due,
        tags: intent.tags,
      });
    }

    case 'complete': {
      if (!intent.todoId) {
        throw new Error('Todo ID is required to mark as complete');
      }
      return await mcpClient.toggleTodoCompletion(intent.todoId, true);
    }

    case 'delete': {
      if (!intent.todoId) {
        throw new Error('Todo ID is required for deletion');
      }
      return await mcpClient.deleteTodo(intent.todoId);
    }

    case 'start_timer': {
      if (!intent.todoId) {
        throw new Error('Todo ID is required to start timer');
      }
      return await mcpClient.startTimeTracking(intent.todoId);
    }

    case 'stop_timer': {
      if (!intent.todoId) {
        throw new Error('Todo ID is required to stop timer');
      }
      return await mcpClient.stopTimeTracking(intent.todoId);
    }

    case 'get_summary': {
      const activeTodos = await mcpClient.getActiveTimeTracking();
      const recentTodos = await mcpClient.listTodos({ limit: 10 });
      return `Active timers: ${activeTodos.length}\nRecent todos: ${recentTodos.length}`;
    }

    default:
      throw new Error(`Unsupported action: ${intent.action}`);
  }
}

/**
 * Get human-readable single action description
 */
function getSingleActionDescription(intent: TodoIntent): string {
  const descriptions = {
    create: 'creating todo',
    list: 'listing todos',
    update: 'updating todo',
    complete: 'completing todo',
    delete: 'deleting todo',
    start_timer: 'starting timer',
    stop_timer: 'stopping timer',
    get_summary: 'generating summary',
  };

  return descriptions[intent.action] || 'processing request';
}
