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
      intent = await claude.parseUserIntent(
        messageText,
        ctx.session.lastBotMessage,
      );
    } catch (parseError) {
      // Handle parsing errors (e.g., invalid enum values from Claude)
      logger.error('Intent parsing failed', { error: parseError, messageText });

      // If the error message is user-friendly (from our enhanced error handling), send it directly
      const errorMessage =
        parseError instanceof Error ? parseError.message : String(parseError);

      // Check if this is our user-friendly error message or a generic error
      if (
        errorMessage.includes('I tried to use') ||
        errorMessage.includes('I had trouble understanding')
      ) {
        // This is a user-friendly message, send it directly
        await ctx.reply(errorMessage, { parse_mode: 'Markdown' });
        ctx.session.lastBotMessage = errorMessage;
      } else {
        // This is a generic error, use AI to generate a helpful response
        const errorResponse = await claude.generateResponse(
          userId.toString(),
          messageText,
          {
            mcpResponse: `Parsing Error: ${errorMessage}. Please rephrase your request.`,
            action: 'parsing_error',
          },
        );

        await ctx.reply(errorResponse.content, { parse_mode: 'Markdown' });
        ctx.session.lastBotMessage = errorResponse.content;
      }
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

    // List planned actions before execution
    const plannedActions = getPlannedActionsDescription(intent);
    if (plannedActions) {
      await ctx.reply(`📋 **Planned actions:**\n${plannedActions}`);
    }

    // Process the todo intent with MCP
    try {
      // Ensure MCP client is connected
      if (!mcpClient.isClientConnected()) {
        await mcpClient.connect();
      }

      const result = await processToDoIntentWithUpdates(mcpClient, intent, ctx);

      // Create a clean summary without technical details for the final response
      const cleanSummary = createCleanSummary(result, intent);

      // Generate AI response with clean summary
      const aiResponse = await claude.generateResponse(
        userId.toString(),
        messageText,
        { mcpResponse: cleanSummary, action: 'summary' },
      );

      await ctx.reply(aiResponse.content, { parse_mode: 'Markdown' });
      ctx.session.lastBotMessage = aiResponse.content;
    } catch (mcpError) {
      logger.error('MCP operation failed', { error: mcpError, intent });

      const errorMessage =
        mcpError instanceof Error ? mcpError.message : String(mcpError);

      // Check if this is a user-friendly error message that should be sent directly
      if (
        errorMessage.includes('Todo ID is required') ||
        errorMessage.includes('Todo title is required') ||
        errorMessage.includes('not found') ||
        errorMessage.includes('already exists')
      ) {
        // This is a clear, actionable error message - send it directly with minimal wrapper
        const directMessage = `❌ ${errorMessage}`;
        await ctx.reply(directMessage, { parse_mode: 'Markdown' });
        ctx.session.lastBotMessage = directMessage;
      } else {
        // This is a technical error, use AI to generate a helpful response
        const errorResponse = await claude.generateResponse(
          userId.toString(),
          messageText,
          {
            mcpResponse: `Error: ${errorMessage}`,
            action: 'error',
          },
        );

        await ctx.reply(errorResponse.content, { parse_mode: 'Markdown' });
        ctx.session.lastBotMessage = errorResponse.content;
      }
    }
  } catch (error) {
    logger.error('Error in message handler', { error, userId, messageText });
    const persona = claude.getCurrentPersona();
    const fallbackMessage = persona.fallbackMessage;
    await ctx.reply(fallbackMessage);
    ctx.session.lastBotMessage = fallbackMessage;
  }
}

/**
 * Process todo intent(s) with live updates to the chat
 */
async function processToDoIntentWithUpdates(
  mcpClient: ReturnType<typeof getMCPClient>,
  intent: TodoIntent | MultiTodoIntent,
  ctx: BotContext,
): Promise<{ response: string; description: string }> {
  // Handle multi-intent
  if ('actions' in intent) {
    return await processMultipleActionsWithUpdates(mcpClient, intent, ctx);
  }

  // Handle single intent
  await ctx.reply(`⚡ Processing: ${getSingleActionDescription(intent)}...`);
  const response = await processSingleAction(mcpClient, intent);
  const description = getSingleActionDescription(intent);
  await ctx.reply(`✅ Completed: ${description}`);

  return { response, description };
}

/**
 * Get planned actions description for preview
 */
function getPlannedActionsDescription(
  intent: TodoIntent | MultiTodoIntent,
): string | null {
  if ('actions' in intent) {
    const actionsList = intent.actions
      .map((action, index) => {
        const desc = getSingleActionDescription(action);
        const details = [];
        if (action.title) details.push(`title: "${action.title}"`);
        if (action.context) details.push(`context: "${action.context}"`);
        if (action.due) details.push(`due: ${action.due.split('T')[0]}`);

        return `${index + 1}. ${desc}${details.length > 0 ? ` (${details.join(', ')})` : ''}`;
      })
      .join('\n');

    return actionsList;
  } else {
    const desc = getSingleActionDescription(intent);
    const details = [];
    if (intent.title) details.push(`title: "${intent.title}"`);
    if (intent.context) details.push(`context: "${intent.context}"`);
    if (intent.due) details.push(`due: ${intent.due.split('T')[0]}`);

    return `1. ${desc}${details.length > 0 ? ` (${details.join(', ')})` : ''}`;
  }
}

/**
 * Process multiple actions with dependency handling and live updates
 */
async function processMultipleActionsWithUpdates(
  mcpClient: ReturnType<typeof getMCPClient>,
  multiIntent: MultiTodoIntent,
  ctx: BotContext,
): Promise<{ response: string; description: string }> {
  const results: string[] = [];
  const descriptions: string[] = [];
  const actionContext: Map<string, unknown> = new Map(); // Store results for dependent actions

  for (let i = 0; i < multiIntent.actions.length; i++) {
    const action = multiIntent.actions[i];

    try {
      // Check if this is a bulk delete action that needs expansion
      const expandedActions = await expandBulkActions(action, actionContext);

      if (expandedActions.length > 1) {
        // Process multiple expanded actions (e.g., bulk delete)
        await ctx.reply(
          `⚡ Processing bulk ${getSingleActionDescription(action)} for ${expandedActions.length} items...`,
        );

        let successCount = 0;
        for (let j = 0; j < expandedActions.length; j++) {
          const expandedAction = expandedActions[j];
          try {
            const response = await processSingleAction(
              mcpClient,
              expandedAction,
            );
            const description = getSingleActionDescription(expandedAction);

            results.push(`Action ${i + 1}.${j + 1}: ${response}`);
            descriptions.push(description);
            successCount++;
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            const errorMsg =
              errorMessage.includes('Todo ID is required') ||
              errorMessage.includes('Todo title is required') ||
              errorMessage.includes('not found') ||
              errorMessage.includes('already exists')
                ? `❌ ${errorMessage}`
                : `Action ${i + 1}.${j + 1} failed: ${errorMessage}`;
            results.push(errorMsg);
          }
        }

        await ctx.reply(
          `✅ Bulk ${getSingleActionDescription(action)} completed: ${successCount}/${expandedActions.length} successful`,
        );
        descriptions.push(
          `bulk ${getSingleActionDescription(action)} (${expandedActions.length} items)`,
        );
      } else {
        // Process single action
        const enhancedAction = expandedActions[0];
        await ctx.reply(
          `⚡ Processing: ${getSingleActionDescription(enhancedAction)}...`,
        );

        const response = await processSingleAction(mcpClient, enhancedAction);
        const description = getSingleActionDescription(enhancedAction);

        results.push(`Action ${i + 1}: ${response}`);
        descriptions.push(description);

        await ctx.reply(`✅ Completed: ${description}`);

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
            await ctx.reply(`📊 Found ${listResult.length} matching todos`);
          } catch {
            // Ignore JSON parse errors
          }
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // For user-friendly errors, preserve the original message
      const errorMsg =
        errorMessage.includes('Todo ID is required') ||
        errorMessage.includes('Todo title is required') ||
        errorMessage.includes('not found') ||
        errorMessage.includes('already exists')
          ? `❌ ${errorMessage}`
          : `Action ${i + 1} failed: ${errorMessage}`;

      results.push(errorMsg);
      descriptions.push(`failed ${getSingleActionDescription(action)}`);

      await ctx.reply(errorMsg);

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
 * Expand bulk actions into multiple individual actions
 */
async function expandBulkActions(
  action: TodoIntent,
  actionContext: Map<string, unknown>,
): Promise<TodoIntent[]> {
  // Check if this is a bulk operation that needs expansion
  if (
    action.action === 'delete' &&
    !action.todoId &&
    (action.context || action.title)
  ) {
    const searchResults = actionContext.get('last_search_results');

    if (
      searchResults &&
      Array.isArray(searchResults) &&
      searchResults.length > 0
    ) {
      // Filter todos by context or title
      let todosToDelete = searchResults;

      if (action.context) {
        todosToDelete = searchResults.filter(
          (todo: { context?: string }) => todo.context === action.context,
        );
      }

      if (action.title) {
        const actionTitle = action.title.toLowerCase();
        todosToDelete = todosToDelete.filter((todo: { title?: string }) =>
          todo.title?.toLowerCase().includes(actionTitle),
        );
      }

      // Create individual delete actions for each todo
      return todosToDelete.map((todo: { _id: string; title?: string }) => ({
        ...action,
        todoId: todo._id,
        title: todo.title, // Preserve the title for better descriptions
      }));
    }
  }

  // For non-bulk operations, enhance with context and return single action
  return [await enhanceActionWithContext(action, actionContext)];
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
          return {
            ...action,
            todoId: matchingTodo._id,
            title: matchingTodo.title,
          };
        }
      }

      // Otherwise use the first result
      const firstResult = searchResults[0] as { _id: string; title?: string };
      return { ...action, todoId: firstResult._id, title: firstResult.title };
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

  const baseDescription = descriptions[intent.action] || 'processing request';

  // Add todo title if available and relevant
  if (
    intent.title &&
    ['create', 'update', 'complete', 'delete'].includes(intent.action)
  ) {
    return `${baseDescription}: "${intent.title}"`;
  }

  // Add context filter for list/delete operations
  if (
    intent.context &&
    ['list', 'delete'].includes(intent.action) &&
    !intent.title
  ) {
    return `${baseDescription} (context: ${intent.context})`;
  }

  return baseDescription;
}

/**
 * Create a clean summary for the final AI response, removing technical details
 */
function createCleanSummary(
  result: { response: string; description: string },
  intent: TodoIntent | MultiTodoIntent,
): string {
  // For multi-intent
  if ('actions' in intent) {
    const actionCount = intent.actions.length;
    const actionTypes = [...new Set(intent.actions.map((a) => a.action))];

    // Extract success counts from bulk operations
    const bulkMatches = result.description.match(/(\d+)\/(\d+) successful/);
    if (bulkMatches) {
      const successful = bulkMatches[1];
      const total = bulkMatches[2];
      return `Successfully completed ${successful}/${total} ${actionTypes.join(' and ')} operations`;
    }

    return `Successfully completed ${actionCount} operations: ${actionTypes.join(', ')}`;
  }

  // For single intent
  const action = intent.action;
  switch (action) {
    case 'create':
      return `Successfully created todo: "${intent.title}"`;
    case 'delete':
      return 'Successfully deleted todo';
    case 'update':
      return `Successfully updated todo: "${intent.title}"`;
    case 'complete':
      return 'Successfully marked todo as complete';
    case 'list': {
      // Extract the count from the response
      const countMatch = result.response.match(/Found (\d+) todos/);
      const count = countMatch ? countMatch[1] : 'some';
      return `Found ${count} todos matching your criteria`;
    }
    case 'start_timer':
      return 'Successfully started time tracking';
    case 'stop_timer':
      return 'Successfully stopped time tracking';
    case 'get_summary':
      return 'Generated activity summary';
    default:
      return 'Successfully completed the requested action';
  }
}
