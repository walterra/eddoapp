import { getClaudeAI } from '../../ai/claude.js';
import { getMCPClient } from '../../mcp/client.js';
import type { TodoIntent } from '../../types/ai-types.js';
import { logger } from '../../utils/logger.js';
import type { WorkflowNode, WorkflowState } from '../types/workflow-types.js';

/**
 * Executes simple tasks using the existing single-step flow
 * This node wraps our current implementation for simple tasks
 */
export const executeSimpleTask: WorkflowNode = async (
  state: WorkflowState,
): Promise<Partial<WorkflowState>> => {
  logger.info('Executing simple task using existing flow', {
    userId: state.userId,
    message: state.userMessage,
  });

  try {
    const claudeAI = getClaudeAI();
    const mcpClient = getMCPClient();

    // Use existing intent parsing
    const intent = await claudeAI.parseUserIntent(
      state.userMessage,
      state.telegramContext.session.lastBotMessage,
    );

    if (!intent) {
      // Not a todo request, just have a conversation
      const response = await claudeAI.generateResponse(
        state.userId,
        state.userMessage,
      );

      await state.telegramContext.reply(response.content, {
        parse_mode: 'Markdown',
      });

      return {
        finalResponse: response.content,
        shouldExit: true,
        executionSummary: {
          planId: 'simple_conversation',
          userIntent: state.userMessage,
          totalSteps: 1,
          completedSteps: 1,
          failedSteps: 0,
          skippedSteps: 0,
          duration: Date.now() - (state.sessionContext.startTime || Date.now()),
          changes: [],
          suggestions: [],
          nextActions: [],
        },
      };
    }

    // Send acknowledgment
    const acknowledgment = claudeAI.generateAcknowledgment(intent);
    await state.telegramContext.reply(acknowledgment);

    // Execute single MCP action using existing logic
    // Handle multi-intent by using first action (simplified for POC)
    const singleIntent = 'actions' in intent ? intent.actions[0] : intent;
    const result = await executeSingleMCPAction(mcpClient, singleIntent);

    // Generate AI response
    const actionName =
      'actions' in intent ? intent.actions[0].action : intent.action;
    const aiResponse = await claudeAI.generateResponse(
      state.userId,
      state.userMessage,
      { mcpResponse: result, action: actionName },
    );

    await state.telegramContext.reply(aiResponse.content, {
      parse_mode: 'Markdown',
    });

    return {
      originalIntent: intent,
      finalResponse: aiResponse.content,
      shouldExit: true,
      executionSummary: {
        planId: 'simple_execution',
        userIntent: state.userMessage,
        totalSteps: 1,
        completedSteps: 1,
        failedSteps: 0,
        skippedSteps: 0,
        duration: Date.now() - (state.sessionContext.startTime || Date.now()),
        changes: [result],
        suggestions: [],
        nextActions: [],
      },
    };
  } catch (error) {
    logger.error('Simple task execution failed', {
      error,
      userId: state.userId,
      message: state.userMessage,
    });

    // Use fallback response from existing error handling
    const claudeAI = getClaudeAI();
    const persona = claudeAI.getCurrentPersona();
    const fallbackMessage = persona.fallbackMessage;

    await state.telegramContext.reply(fallbackMessage);

    return {
      error: error instanceof Error ? error : new Error(String(error)),
      finalResponse: fallbackMessage,
      shouldExit: true,
    };
  }
};

/**
 * Executes a single MCP action (extracted from existing message handler logic)
 */
async function executeSingleMCPAction(
  mcpClient: ReturnType<typeof getMCPClient>,
  intent: TodoIntent,
): Promise<string> {
  // Ensure MCP client is connected
  if (!mcpClient.isClientConnected()) {
    await mcpClient.connect();
  }

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
