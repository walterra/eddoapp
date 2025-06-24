import { getClaudeAI } from '../../ai/claude.js';
import { logger } from '../../utils/logger.js';
import type {
  ExecutionStep,
  ExecutionSummary,
  WorkflowNode,
  WorkflowState,
} from '../types/workflow-types.js';

/**
 * Execution summarizer node - generates comprehensive summaries and next actions
 */
export const generateExecutionSummary: WorkflowNode = async (
  state: WorkflowState,
): Promise<Partial<WorkflowState>> => {
  logger.info('Generating execution summary', {
    userId: state.userId,
    planId: state.executionPlan?.id,
    totalSteps: state.executionSteps.length,
  });

  try {
    const summary = await createExecutionSummary(state);
    const summaryMessage = await generateSummaryMessage(state, summary);

    // Send comprehensive summary to user
    await state.telegramContext.reply(summaryMessage, {
      parse_mode: 'Markdown',
    });

    logger.info('Execution summary generated', {
      userId: state.userId,
      planId: summary.planId,
      completedSteps: summary.completedSteps,
      failedSteps: summary.failedSteps,
      duration: summary.duration,
    });

    return {
      executionSummary: summary,
      finalResponse: 'Execution completed with summary',
      shouldExit: true,
    };
  } catch (error) {
    logger.error('Failed to generate execution summary', {
      error,
      userId: state.userId,
      planId: state.executionPlan?.id,
    });

    // Send basic summary even if detailed generation fails
    const basicSummary = createBasicSummary(state);
    const basicMessage = generateBasicSummaryMessage(basicSummary);

    await state.telegramContext.reply(basicMessage, { parse_mode: 'Markdown' });

    return {
      executionSummary: basicSummary,
      finalResponse: 'Execution completed',
      shouldExit: true,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
};

/**
 * Creates a comprehensive execution summary
 */
async function createExecutionSummary(
  state: WorkflowState,
): Promise<ExecutionSummary> {
  const plan = state.executionPlan!;
  const steps = state.executionSteps;
  const startTime = (state.sessionContext.startTime as number) || Date.now();

  // Calculate step statistics
  const completedSteps = steps.filter((s) => s.status === 'completed').length;
  const failedSteps = steps.filter((s) => s.status === 'failed').length;
  const skippedSteps = steps.filter((s) => s.status === 'skipped').length;

  // Collect changes made
  const changes = await summarizeChanges(state);

  // Generate AI-powered suggestions and next actions
  const suggestions = await generateSuggestions(state);
  const nextActions = await generateNextActions(state);

  const summary: ExecutionSummary = {
    planId: plan.id,
    userIntent: plan.userIntent,
    totalSteps: plan.steps.length,
    completedSteps,
    failedSteps,
    skippedSteps,
    duration: Date.now() - startTime,
    changes,
    suggestions,
    nextActions,
  };

  return summary;
}

/**
 * Summarizes the changes made during execution
 */
async function summarizeChanges(state: WorkflowState): Promise<string[]> {
  const changes: string[] = [];

  for (const step of state.executionSteps) {
    if (step.status === 'completed' && step.result) {
      const changeDescription = await describeStepChange(step);
      if (changeDescription) {
        changes.push(changeDescription);
      }
    }
  }

  return changes;
}

/**
 * Describes what change a step made
 */
async function describeStepChange(step: ExecutionStep): Promise<string | null> {
  switch (step.action) {
    case 'create_todo':
      return `Created todo: "${step.parameters.title}"`;

    case 'update_todo':
      return `Updated todo: "${step.parameters.title || 'Unknown'}"`;

    case 'delete_todo':
      // Check if this is a bulk delete operation
      if (
        !step.parameters.id &&
        step.result &&
        typeof step.result === 'object'
      ) {
        const result = step.result as {
          total?: number;
          successful?: number;
          failed?: number;
        };
        if (
          typeof result.total === 'number' &&
          typeof result.successful === 'number' &&
          typeof result.failed === 'number'
        ) {
          // This is a bulk delete result
          const parts = [
            `Deleted ${result.successful} todo${result.successful !== 1 ? 's' : ''}`,
          ];
          if (result.failed > 0) {
            parts.push(`(${result.failed} failed)`);
          }
          return parts.join(' ');
        }
      }
      // Single delete operation
      return `Deleted todo with ID: ${step.parameters.id || 'unknown'}`;

    case 'toggle_completion': {
      const params = step.parameters as { id?: string; completed?: boolean };
      const action = params.completed ? 'Completed' : 'Reopened';
      if (params.id) {
        return `${action} todo with ID: ${params.id}`;
      } else {
        return `${action} todo`;
      }
    }

    case 'start_timer':
    case 'start_time_tracking': {
      const params = step.parameters as { id?: string; title?: string };
      
      // Try to extract todo information from the result
      let todoInfo = '';
      if (step.result && typeof step.result === 'string') {
        // Look for todo title in the result message
        const titleMatch = step.result.match(/Started time tracking for:\s*(.+)/i);
        if (titleMatch) {
          todoInfo = `"${titleMatch[1]}"`;
        }
      }
      
      if (todoInfo) {
        return `Started timer for task: ${todoInfo}`;
      } else if (params.id) {
        return `Started timer for todo with ID: ${params.id}`;
      } else if (params.title) {
        return `Started timer for task: "${params.title}"`;
      } else {
        return 'Started timer for todo';
      }
    }

    case 'stop_timer':
    case 'stop_time_tracking': {
      const params = step.parameters as { id?: string; title?: string };
      
      // Try to extract todo information from the result
      let todoInfo = '';
      if (step.result && typeof step.result === 'string') {
        // Look for todo title in the result message
        const titleMatch = step.result.match(/Stopped time tracking for:\s*(.+)/i);
        if (titleMatch) {
          todoInfo = `"${titleMatch[1]}"`;
        }
      }
      
      if (todoInfo) {
        return `Stopped timer for task: ${todoInfo}`;
      } else if (params.id) {
        return `Stopped timer for todo with ID: ${params.id}`;
      } else if (params.title) {
        return `Stopped timer for task: "${params.title}"`;
      } else {
        return 'Stopped timer for todo';
      }
    }

    case 'list_todos':
      if (typeof step.result === 'object' && Array.isArray(step.result)) {
        return `Analyzed ${step.result.length} todos`;
      }
      return 'Retrieved todo list';

    case 'analysis':
      return `Performed analysis: ${step.description}`;

    default:
      return step.description;
  }
}

/**
 * Generates AI-powered suggestions for improvement
 */
async function generateSuggestions(state: WorkflowState): Promise<string[]> {
  const claudeAI = getClaudeAI();

  // Get actual todo data from completed list_todos steps for context-aware suggestions
  const listTodosSteps = state.executionSteps.filter(
    (step) => step.action === 'list_todos' && step.status === 'completed'
  );
  
  let todoContext = '';
  if (listTodosSteps.length > 0) {
    const latestListStep = listTodosSteps[listTodosSteps.length - 1];
    const listResult = state.mcpResponses[state.executionSteps.indexOf(latestListStep)];
    
    try {
      let todos: Array<{ _id: string; title?: string; context: string; completed?: string | null; due?: string; [key: string]: unknown }> = [];
      if (typeof listResult === 'string') {
        todos = JSON.parse(listResult);
      } else if (Array.isArray(listResult)) {
        todos = listResult;
      }
      
      if (todos.length > 0) {
        const activeTodos = todos.filter((t) => !t.completed);
        const todosByContext = activeTodos.reduce((acc: Record<string, Array<typeof todos[0]>>, todo) => {
          if (!acc[todo.context]) acc[todo.context] = [];
          acc[todo.context].push(todo);
          return acc;
        }, {});
        
        todoContext = `
CURRENT TODOS:
- Total active todos: ${activeTodos.length}
- Contexts: ${Object.keys(todosByContext).join(', ')}

TODOS BY CONTEXT:
${Object.entries(todosByContext).map(([context, contextTodos]) => 
  `\n${context.toUpperCase()} (${contextTodos.length} todos):
${contextTodos.slice(0, 5).map((todo) => 
  `  - "${todo.title}"${todo.due ? ` (due: ${new Date(todo.due).toLocaleDateString()})` : ''}`
).join('\n')}${contextTodos.length > 5 ? `\n  ... and ${contextTodos.length - 5} more` : ''}`
).join('\n')}`;
      }
    } catch (_error) {
      // If parsing fails, fall back to basic info
      todoContext = '\nTODO DATA: Available but could not parse for detailed analysis.';
    }
  }

  const prompt = `Based on the execution of this todo management workflow, provide 2-3 brief, specific suggestions for the user's next actions or productivity improvements.

EXECUTION CONTEXT:
- User Request: ${state.userMessage}
- Plan: ${state.executionPlan?.userIntent}
- Completed Steps: ${state.executionSteps.filter((s) => s.status === 'completed').length}
- Failed Steps: ${state.executionSteps.filter((s) => s.status === 'failed').length}

STEP DETAILS:
${state.executionSteps.map((step) => `- ${step.status.toUpperCase()}: ${step.description}`).join('\n')}
${todoContext}

Based on the user's request and available todo data, determine if they are seeking a specific recommendation about what to work on next. If so, you MUST make a decisive recommendation by picking ONE specific todo as the primary next action.

For recommendation-seeking requests, structure your response as:
1. FIRST suggestion: "Start with: [specific todo title]" - always pick the most logical next action
2. SECOND suggestion: Brief reasoning why this todo was chosen
3. THIRD suggestion: General productivity tip or follow-up action

For other types of requests, provide relevant suggestions based on what was accomplished.

Prioritize todos by:
1. Overdue items (most urgent first)
2. Items due today 
3. Items with earlier due dates
4. Items that logically come first in workflow
5. Quick wins or high-impact tasks

Be decisive and specific. Don't just analyze - make a clear recommendation.

Respond with ONLY a JSON array of exactly 3 suggestion strings, no other text.`;

  try {
    const response = await claudeAI.generateResponse(state.userId, prompt);
    const suggestions = JSON.parse(response.content);

    if (
      Array.isArray(suggestions) &&
      suggestions.every((s) => typeof s === 'string')
    ) {
      return suggestions.slice(0, 3); // Limit to 3 suggestions
    }
  } catch (error) {
    logger.warn('Failed to generate AI suggestions', { error });
  }

  // Fallback suggestions - try to be more specific if we have todo context
  const fallbackSuggestions = [
    'Start with: Create a new task to get momentum going',
    'Consider what needs to be done in this context and add it to your list',
    'Review other contexts to see if tasks can be moved here',
  ];
  
  // If we have todo context data, try to provide more specific fallback suggestions
  if (todoContext && todoContext.includes('CURRENT TODOS:')) {
    try {
      const listTodosSteps = state.executionSteps.filter(
        (step) => step.action === 'list_todos' && step.status === 'completed'
      );
      
      if (listTodosSteps.length > 0) {
        const latestListStep = listTodosSteps[listTodosSteps.length - 1];
        const listResult = state.mcpResponses[state.executionSteps.indexOf(latestListStep)];
        
        let todos: Array<{ _id: string; title?: string; context: string; completed?: string | null; due?: string; [key: string]: unknown }> = [];
        if (typeof listResult === 'string') {
          todos = JSON.parse(listResult);
        } else if (Array.isArray(listResult)) {
          todos = listResult;
        }
        
        const activeTodos = todos.filter((t) => !t.completed);
        const overdueTodos = activeTodos.filter((t) => t.due && new Date(t.due) < new Date());
        const todayTodos = activeTodos.filter((t) => {
          if (!t.due) return false;
          const dueDate = new Date(t.due);
          const today = new Date();
          return dueDate.toDateString() === today.toDateString();
        });
        
        const contextSpecificSuggestions = [];
        
        // Always pick a specific todo as the first recommendation
        let chosenTodo = null;
        let reason = '';
        
        if (overdueTodos.length > 0) {
          chosenTodo = overdueTodos[0];
          reason = `This task is overdue and needs immediate attention`;
        } else if (todayTodos.length > 0) {
          chosenTodo = todayTodos[0];
          reason = `This task is due today and should be prioritized`;
        } else if (activeTodos.length > 0) {
          // Pick the first active todo or one with earliest due date
          chosenTodo = activeTodos.sort((a, b) => {
            if (!a.due && !b.due) return 0;
            if (!a.due) return 1;
            if (!b.due) return -1;
            return new Date(a.due).getTime() - new Date(b.due).getTime();
          })[0];
          reason = chosenTodo.due 
            ? `This task has the earliest due date`
            : `This is the next task in your queue`;
        }
        
        if (chosenTodo && chosenTodo.title) {
          contextSpecificSuggestions.push(`Start with: "${chosenTodo.title}"`);
          contextSpecificSuggestions.push(reason);
          
          // Add a third suggestion about the overall context
          if (overdueTodos.length > 1) {
            contextSpecificSuggestions.push(`After this, address your other ${overdueTodos.length - 1} overdue tasks`);
          } else if (activeTodos.length > 1) {
            contextSpecificSuggestions.push(`You have ${activeTodos.length - 1} other tasks in this context to tackle next`);
          } else {
            contextSpecificSuggestions.push(`Great job staying on top of this context!`);
          }
        }
        
        if (contextSpecificSuggestions.length > 0) {
          return [...contextSpecificSuggestions, ...fallbackSuggestions].slice(0, 3);
        }
      }
    } catch (error) {
      logger.warn('Failed to generate context-specific fallback suggestions', { error });
    }
  }
  
  return fallbackSuggestions;
}

/**
 * Generates next action recommendations
 */
async function generateNextActions(state: WorkflowState): Promise<string[]> {
  const nextActions: string[] = [];

  // Check for failed steps that might need attention
  const failedSteps = state.executionSteps.filter((s) => s.status === 'failed');
  if (failedSteps.length > 0) {
    nextActions.push(`Review and retry ${failedSteps.length} failed step(s)`);
  }

  // Check for skipped steps
  const skippedSteps = state.executionSteps.filter(
    (s) => s.status === 'skipped',
  );
  if (skippedSteps.length > 0) {
    nextActions.push(
      `Address dependencies for ${skippedSteps.length} skipped step(s)`,
    );
  }

  // Use LLM to generate intelligent next actions based on context
  const claudeAI = getClaudeAI();
  
  const nextActionsPrompt = `Based on the execution results and user intent, suggest 2-3 practical next actions for the user.

EXECUTION CONTEXT:
- User Request: ${state.userMessage}
- Plan Intent: ${state.executionPlan?.userIntent}
- Completed Steps: ${state.executionSteps.filter((s) => s.status === 'completed').length}
- Failed Steps: ${state.executionSteps.filter((s) => s.status === 'failed').length}

COMPLETED ACTIONS:
${state.executionSteps.filter((s) => s.status === 'completed').map((step) => `- ${step.description}`).join('\n')}

If the user was seeking a recommendation about what to work on next (e.g., asked about todos in a context), prioritize action-oriented suggestions like:
- "Take action on the recommended task above"
- "Set a timer for focused work"
- "Mark the task as complete when finished"

For other types of requests, suggest relevant follow-up actions based on what was accomplished.

Provide 2-3 concise, actionable next steps in a JSON array of strings.
Respond with ONLY a JSON array, no other text.`;

  try {
    const response = await claudeAI.generateResponse(state.userId, nextActionsPrompt);
    const aiNextActions = JSON.parse(response.content);
    
    if (Array.isArray(aiNextActions) && aiNextActions.every((action) => typeof action === 'string')) {
      return aiNextActions.slice(0, 3);
    }
  } catch (error) {
    logger.warn('Failed to generate AI next actions', { error });
  }

  // Fallback next actions if AI generation fails
  return [
    'Take action on any recommendations provided above',
    'Update your todo list based on your progress',
    'Review your accomplishments and plan your next steps'
  ];
}

/**
 * Generates the comprehensive summary message for the user
 */
async function generateSummaryMessage(
  state: WorkflowState,
  summary: ExecutionSummary,
): Promise<string> {
  const duration = formatDuration(summary.duration);
  const successRate = Math.round(
    (summary.completedSteps / summary.totalSteps) * 100,
  );

  let message = `🎯 **Execution Complete**\n\n`;

  // Overview
  message += `**Goal:** ${summary.userIntent}\n`;
  message += `**Duration:** ${duration}\n`;
  message += `**Success Rate:** ${successRate}% (${summary.completedSteps}/${summary.totalSteps} steps)\n\n`;

  // Step breakdown
  if (summary.completedSteps > 0) {
    message += `✅ **Completed:** ${summary.completedSteps} steps\n`;
  }
  if (summary.failedSteps > 0) {
    message += `❌ **Failed:** ${summary.failedSteps} steps\n`;
  }
  if (summary.skippedSteps > 0) {
    message += `⏭️ **Skipped:** ${summary.skippedSteps} steps\n`;
  }

  message += '\n';

  // Changes made
  if (summary.changes.length > 0) {
    message += `📝 **Changes Made:**\n`;
    summary.changes.forEach((change) => {
      message += `• ${change}\n`;
    });
    message += '\n';
  }

  // Suggestions
  if (summary.suggestions.length > 0) {
    message += `💡 **Suggestions:**\n`;
    summary.suggestions.forEach((suggestion) => {
      message += `• ${suggestion}\n`;
    });
    message += '\n';
  }

  // Next actions
  if (summary.nextActions && summary.nextActions.length > 0) {
    message += `🎯 **Recommended Next Actions:**\n`;
    summary.nextActions.forEach((action) => {
      message += `• ${action}\n`;
    });
  }

  return message;
}

/**
 * Creates a basic summary when AI generation fails
 */
function createBasicSummary(state: WorkflowState): ExecutionSummary {
  const plan = state.executionPlan!;
  const steps = state.executionSteps;
  const startTime = (state.sessionContext.startTime as number) || Date.now();

  return {
    planId: plan.id,
    userIntent: plan.userIntent,
    totalSteps: plan.steps.length,
    completedSteps: steps.filter((s) => s.status === 'completed').length,
    failedSteps: steps.filter((s) => s.status === 'failed').length,
    skippedSteps: steps.filter((s) => s.status === 'skipped').length,
    duration: Date.now() - startTime,
    changes: [
      `Executed ${steps.filter((s) => s.status === 'completed').length} actions successfully`,
    ],
    suggestions: ['Review the results and continue with your todo management'],
    nextActions: ['Check your updated todo list'],
  };
}

/**
 * Generates basic summary message
 */
function generateBasicSummaryMessage(summary: ExecutionSummary): string {
  const duration = formatDuration(summary.duration);

  return `🎯 **Execution Complete**

**Goal:** ${summary.userIntent}
**Duration:** ${duration}
**Results:** ${summary.completedSteps} completed, ${summary.failedSteps} failed, ${summary.skippedSteps} skipped

Your todo management task has been processed!`;
}

/**
 * Formats duration in human-readable format
 */
function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);

  if (seconds < 60) {
    return `${seconds} seconds`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes < 60) {
    return remainingSeconds > 0
      ? `${minutes}m ${remainingSeconds}s`
      : `${minutes} minutes`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return remainingMinutes > 0
    ? `${hours}h ${remainingMinutes}m`
    : `${hours} hours`;
}
