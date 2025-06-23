import { BotContext } from '../bot.js';
import { logger } from '../../utils/logger.js';
import { getMCPClient } from '../../mcp/client.js';
import { getClaudeAI, TodoIntent } from '../../ai/claude.js';

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
    const intent = await claude.parseUserIntent(messageText);
    
    if (!intent) {
      // Not a todo request, just have a conversation
      const response = await claude.generateResponse(userId.toString(), messageText);
      await ctx.reply(response.content, { parse_mode: 'Markdown' });
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

      mcpResponse = await processToDoIntent(mcpClient, intent);
      actionDescription = getActionDescription(intent);

      // Generate AI response with MCP context
      const aiResponse = await claude.generateResponse(
        userId.toString(),
        messageText,
        { mcpResponse, action: actionDescription }
      );

      await ctx.reply(aiResponse.content, { parse_mode: 'Markdown' });

    } catch (mcpError) {
      logger.error('MCP operation failed', { error: mcpError, intent });
      
      // Try to give a helpful error response
      const errorResponse = await claude.generateResponse(
        userId.toString(),
        messageText,
        { 
          mcpResponse: `Error: ${mcpError instanceof Error ? mcpError.message : String(mcpError)}`,
          action: 'error'
        }
      );
      
      await ctx.reply(errorResponse.content, { parse_mode: 'Markdown' });
    }

  } catch (error) {
    logger.error('Error in message handler', { error, userId, messageText });
    await ctx.reply('🎩 My apologies, I encountered an issue processing your request. Please try again in a moment.');
  }
}

/**
 * Process todo intent using MCP client
 */
async function processToDoIntent(mcpClient: ReturnType<typeof getMCPClient>, intent: TodoIntent): Promise<string> {
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
 * Get human-readable action description
 */
function getActionDescription(intent: TodoIntent): string {
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
