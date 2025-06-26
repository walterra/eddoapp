import { ChatAnthropic } from '@langchain/anthropic';

import { appConfig } from '../../utils/config.js';
import { logger } from '../../utils/logger.js';
import type {
  EnhancedWorkflowStateType,
  ReflectionResult,
} from '../enhanced-workflow-state.js';
import { telegramContextManager } from '../enhanced-workflow-state.js';

/**
 * Reflection Node - Final phase of Intent → Plan → Execute → Reflect
 * Analyzes execution results and provides comprehensive summary
 */
export async function reflectOnExecution(
  state: EnhancedWorkflowStateType,
): Promise<Partial<EnhancedWorkflowStateType>> {
  const startTime = Date.now();

  logger.info('Starting execution reflection', {
    userId: state.userId,
    planId: state.executionPlan?.id,
    executedSteps: state.executionSteps.length,
    hasError: !!state.error,
  });

  try {
    const model = new ChatAnthropic({
      model: appConfig.LLM_MODEL,
      temperature: 0.2,
      maxTokens: 1500,
    });

    const reflection = await generateReflection(state, model);

    // Send comprehensive summary to user
    await sendReflectionSummary(state, reflection);

    const duration = Date.now() - startTime;

    logger.info('Execution reflection completed', {
      userId: state.userId,
      success: reflection.success,
      completedSteps: reflection.completedSteps,
      failedSteps: reflection.failedSteps,
      duration,
    });

    // Generate final response based on reflection
    const finalResponse = generateFinalResponse(state, reflection);

    return {
      reflectionResult: reflection,
      finalResponse,
      finalResult: reflection.success
        ? 'Workflow completed successfully'
        : 'Workflow completed with issues',
    };
  } catch (error) {
    const duration = Date.now() - startTime;

    logger.error('Execution reflection failed', {
      error,
      userId: state.userId,
      duration,
    });

    // Generate fallback reflection
    const fallbackReflection = generateFallbackReflection(state);
    const finalResponse = generateFinalResponse(state, fallbackReflection);

    return {
      reflectionResult: fallbackReflection,
      finalResponse,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

/**
 * Generates AI-powered reflection on execution results
 */
async function generateReflection(
  state: EnhancedWorkflowStateType,
  model: ChatAnthropic,
): Promise<ReflectionResult> {
  // For simple tasks that are just data retrieval, skip the complex reflection
  if (
    state.taskAnalysis?.classification === 'simple' &&
    state.executionSteps.length === 1 &&
    state.executionSteps[0].status === 'completed' &&
    (state.executionSteps[0].action === 'list_todos' ||
      state.executionSteps[0].action === 'listTodos' ||
      state.executionSteps[0].action === 'get_active_timers' ||
      state.executionSteps[0].action === 'getActiveTimeTracking')
  ) {
    // Return a simple reflection that doesn't overshadow the actual data
    const duration = Date.now() - (state.sessionStartTime || Date.now());
    return {
      success: true,
      summary: 'Retrieved the requested information',
      changes: [],
      errors: [],
      suggestions: [],
      nextActions: [],
      totalSteps: 1,
      completedSteps: 1,
      failedSteps: 0,
      duration,
    };
  }

  const executionData = {
    userIntent: state.userIntent,
    planId: state.executionPlan?.id,
    totalSteps: state.executionPlan?.steps.length || 0,
    executedSteps: state.executionSteps.length,
    stepResults: state.executionSteps.map((step) => ({
      id: step.id,
      description: step.description,
      status: step.status,
      action: step.action,
      hasResult: !!step.result,
      hasError: !!step.error,
      errorMessage: step.error?.message,
      duration: step.duration,
    })),
    mcpResults: Object.keys(state.mcpResults || {}).length,
    approvals: state.approvalRequests.length,
    hasError: !!state.error,
    errorMessage: state.error?.message,
    totalDuration: Date.now() - (state.sessionStartTime || Date.now()),
  };

  const reflectionPrompt = `Analyze this todo management workflow execution and provide a comprehensive reflection.

Original User Intent: "${state.userIntent}"

Execution Summary:
- Plan ID: ${executionData.planId}
- Total Planned Steps: ${executionData.totalSteps}
- Steps Executed: ${executionData.executedSteps}
- MCP Tool Results: ${executionData.mcpResults}
- User Approvals: ${executionData.approvals}
- Total Duration: ${executionData.totalDuration}ms
- Has Errors: ${executionData.hasError}

Step-by-Step Results:
${executionData.stepResults
  .map(
    (step, index) => `
${index + 1}. ${step.description}
   - Action: ${step.action}
   - Status: ${step.status}
   - Duration: ${step.duration || 0}ms
   - Has Result: ${step.hasResult}
   - Error: ${step.errorMessage || 'None'}
`,
  )
  .join('')}

Overall Error: ${executionData.errorMessage || 'None'}

Analyze the execution and provide reflection in JSON format:
{
  "success": boolean,
  "summary": "Brief summary of what was accomplished",
  "changes": ["change1", "change2", ...],
  "errors": ["error1", "error2", ...],
  "suggestions": ["suggestion1", "suggestion2", ...],
  "nextActions": ["action1", "action2", ...],
  "totalSteps": number,
  "completedSteps": number,
  "failedSteps": number,
  "duration": number
}

Focus on:
1. What was successfully accomplished
2. What data was changed or created
3. Any errors or issues encountered
4. Suggestions for improvement
5. Recommended next actions for the user`;

  const response = await model.invoke([
    { role: 'user', content: reflectionPrompt },
  ]);

  try {
    const content = response.content as string;

    // Extract JSON from response content - handle cases where AI adds text before/after JSON
    let jsonContent = content.trim();

    // Find JSON boundaries
    const jsonStart = jsonContent.indexOf('{');
    const jsonEnd = jsonContent.lastIndexOf('}') + 1;

    if (jsonStart !== -1 && jsonEnd > jsonStart) {
      jsonContent = jsonContent.slice(jsonStart, jsonEnd);
    }

    const aiReflection = JSON.parse(jsonContent);

    // Validate and enhance the reflection
    return validateReflection(aiReflection, executionData);
  } catch (parseError) {
    logger.warn('Failed to parse AI reflection, using fallback', {
      parseError,
      content: response.content,
      contentType: typeof response.content,
    });

    return generateFallbackReflection(state);
  }
}

/**
 * Validates and enhances AI-generated reflection
 */
function validateReflection(
  aiReflection: Partial<ReflectionResult>,
  executionData: Record<string, unknown>,
): ReflectionResult {
  const completedSteps =
    (executionData.stepResults as Array<{ status: string }>)?.filter(
      (step) => step.status === 'completed',
    ).length || 0;
  const failedSteps =
    (executionData.stepResults as Array<{ status: string }>)?.filter(
      (step) => step.status === 'failed',
    ).length || 0;

  return {
    success: Boolean(
      aiReflection.success && completedSteps > 0 && failedSteps === 0,
    ),
    summary: aiReflection.summary || 'Workflow execution completed',
    changes: Array.isArray(aiReflection.changes) ? aiReflection.changes : [],
    errors: Array.isArray(aiReflection.errors) ? aiReflection.errors : [],
    suggestions: Array.isArray(aiReflection.suggestions)
      ? aiReflection.suggestions
      : [],
    nextActions: Array.isArray(aiReflection.nextActions)
      ? aiReflection.nextActions
      : [],
    totalSteps: Number(executionData.totalSteps) || 0,
    completedSteps,
    failedSteps,
    duration: Number(executionData.totalDuration) || 0,
  };
}

/**
 * Generates fallback reflection when AI analysis fails
 */
function generateFallbackReflection(
  state: EnhancedWorkflowStateType,
): ReflectionResult {
  const completedSteps = state.executionSteps.filter(
    (step) => step.status === 'completed',
  ).length;
  const failedSteps = state.executionSteps.filter(
    (step) => step.status === 'failed',
  ).length;
  const totalSteps = state.executionPlan?.steps.length || 0;

  return {
    success: completedSteps > 0 && failedSteps === 0 && !state.error,
    summary: `Executed ${completedSteps} of ${totalSteps} planned steps`,
    changes: completedSteps > 0 ? ['Todo management operations performed'] : [],
    errors: state.error ? [state.error.message] : [],
    suggestions:
      failedSteps > 0 ? ['Review failed steps and retry if needed'] : [],
    nextActions: ['Continue with your todo management tasks'],
    totalSteps,
    completedSteps,
    failedSteps,
    duration: Date.now() - (state.sessionStartTime || Date.now()),
  };
}

/**
 * Sends comprehensive reflection summary to user
 */
async function sendReflectionSummary(
  state: EnhancedWorkflowStateType,
  reflection: ReflectionResult,
): Promise<void> {
  if (!state.telegramContextKey) return;

  const context = telegramContextManager.get(state.telegramContextKey);
  if (!context) return;

  // For simple data retrieval tasks, generate contextual response using LLM
  if (
    state.taskAnalysis?.classification === 'simple' &&
    state.executionSteps.length === 1 &&
    state.executionSteps[0].status === 'completed' &&
    (state.executionSteps[0].action === 'list_todos' ||
      state.executionSteps[0].action === 'listTodos')
  ) {
    const contextualResponse = await generateContextualTodoResponse(
      state,
      context,
    );
    if (contextualResponse) {
      return; // Response was sent successfully
    }
    // Fall through to default reflection if contextual response failed
  }

  // Default workflow summary for non-simple tasks
  const successIcon = reflection.success ? '✅' : '⚠️';
  const efficiency =
    reflection.totalSteps > 0
      ? Math.round((reflection.completedSteps / reflection.totalSteps) * 100)
      : 0;

  let message = `${successIcon} **Workflow Complete**

**Summary:** ${reflection.summary}

**Results:**
• Steps: ${reflection.completedSteps}/${reflection.totalSteps} completed
• Efficiency: ${efficiency}%
• Duration: ${Math.round(reflection.duration / 1000)}s`;

  if (reflection.changes.length > 0) {
    message += `\n\n**Changes Made:**\n${reflection.changes.map((change) => `• ${change}`).join('\n')}`;
  }

  if (reflection.errors.length > 0) {
    message += `\n\n**Issues:**\n${reflection.errors.map((error) => `⚠️ ${error}`).join('\n')}`;
  }

  if (reflection.suggestions.length > 0) {
    message += `\n\n**Suggestions:**\n${reflection.suggestions.map((suggestion) => `💡 ${suggestion}`).join('\n')}`;
  }

  if (reflection.nextActions && reflection.nextActions.length > 0) {
    message += `\n\n**Next Actions:**\n${reflection.nextActions.map((action) => `➡️ ${action}`).join('\n')}`;
  }

  try {
    await context.reply(message, { parse_mode: 'Markdown' });
  } catch (error) {
    logger.error('Failed to send reflection summary', {
      error,
      userId: state.userId,
    });
  }
}

/**
 * Generates a contextual response for todo-related queries using LLM
 */
async function generateContextualTodoResponse(
  state: EnhancedWorkflowStateType,
  context: any,
): Promise<boolean> {
  try {
    // Extract todo data from MCP response
    const stepId = state.executionSteps[0].id;
    let stepResult = state.executionSteps[0].result;

    // Check multiple locations for the result data
    if (!stepResult && state.toolResults && state.toolResults[stepId]) {
      const toolResult = state.toolResults[stepId];
      if (typeof toolResult === 'object' && 'content' in toolResult) {
        stepResult = (toolResult as any).content;
      } else {
        stepResult = toolResult;
      }
    }

    if (!stepResult && state.mcpResponses && state.mcpResponses.length > 0) {
      stepResult = state.mcpResponses[0];
    }

    if (!stepResult) {
      logger.warn('No todo data found for contextual response', {
        userId: state.userId,
        stepId,
      });
      return false;
    }

    // Parse todo data
    let todos: Array<{
      _id: string;
      title: string;
      context: string;
      completed: string | null;
      due?: string;
      description?: string;
      tags?: string[];
    }> = [];

    if (typeof stepResult === 'string') {
      todos = JSON.parse(stepResult);
    } else if (Array.isArray(stepResult)) {
      todos = stepResult;
    } else if (typeof stepResult === 'object' && 'content' in stepResult) {
      const content = (stepResult as any).content;
      if (typeof content === 'string') {
        todos = JSON.parse(content);
      } else if (Array.isArray(content)) {
        todos = content;
      }
    }

    const activeTodos = todos.filter((todo) => !todo.completed);

    // Handle empty todo list
    if (activeTodos.length === 0) {
      await context.reply(
        '📭 **No pending todos**\n\nYour todo list is empty! Time to add some tasks or enjoy your free time.',
        { parse_mode: 'Markdown' },
      );
      return true;
    }

    // Use LLM to generate contextual response
    const model = new ChatAnthropic({
      model: 'claude-3-5-sonnet-20241022',
      apiKey: appConfig.ANTHROPIC_API_KEY,
      temperature: 0.3,
      maxTokens: 1000,
    });

    // Prepare todo data summary for LLM
    const todoSummary = activeTodos
      .map((todo) => {
        const dueInfo = todo.due
          ? ` (due: ${new Date(todo.due).toLocaleDateString()})`
          : '';
        const tagsInfo =
          todo.tags && todo.tags.length > 0 ? ` [${todo.tags.join(', ')}]` : '';
        const descInfo = todo.description ? ` - ${todo.description}` : '';
        return `- "${todo.title}" (${todo.context})${dueInfo}${tagsInfo}${descInfo}`;
      })
      .join('\n');

    const overdueTodos = activeTodos.filter(
      (todo) => todo.due && new Date(todo.due) < new Date(),
    );
    const todayTodos = activeTodos.filter((todo) => {
      if (!todo.due) return false;
      const dueDate = new Date(todo.due);
      const today = new Date();
      return dueDate.toDateString() === today.toDateString();
    });

    const contextPrompt = `You are helping a user with their todo management. The user asked: "${state.userIntent}"

Here are their current active todos:
${todoSummary}

Additional context:
- Total active todos: ${activeTodos.length}
- Overdue todos: ${overdueTodos.length}
- Due today: ${todayTodos.length}
- Contexts: ${[...new Set(activeTodos.map((t) => t.context))].join(', ')}

Generate a helpful, conversational response that directly answers their question using this todo data. Format using Markdown with appropriate emojis. Be specific and actionable.

Guidelines based on question type:
- For "daily summary" or "overview": Provide organized overview grouped by context/priority
- For "what should I pick up next" or "what to do": Recommend 1-2 specific todos with reasoning
- For "urgent" or "priority": Focus on overdue and time-sensitive items
- For context-specific questions: Filter and focus on relevant todos
- For general status: Give brief summary with key insights

Keep the response concise but informative. Always be encouraging and helpful.`;

    const response = await model.invoke([
      { role: 'user', content: contextPrompt },
    ]);

    const responseText = response.content as string;

    await context.reply(responseText, { parse_mode: 'Markdown' });

    logger.info('Generated contextual todo response', {
      userId: state.userId,
      userIntent: state.userIntent,
      todoCount: activeTodos.length,
      responseLength: responseText.length,
    });

    return true;
  } catch (error) {
    logger.error('Failed to generate contextual todo response', {
      error,
      userId: state.userId,
      userIntent: state.userIntent,
    });
    return false;
  }
}

/**
 * Generates final response based on reflection results
 */
function generateFinalResponse(
  state: EnhancedWorkflowStateType,
  reflection: ReflectionResult,
): string {
  if (reflection.success) {
    let response = `✅ **Success!** ${reflection.summary}`;

    if (reflection.changes.length > 0) {
      response += `\n\n**What I did:**\n${reflection.changes.map((change) => `• ${change}`).join('\n')}`;
    }

    if (reflection.nextActions && reflection.nextActions.length > 0) {
      response += `\n\n**Suggestions:**\n${reflection.nextActions
        .slice(0, 2)
        .map((action) => `💡 ${action}`)
        .join('\n')}`;
    }

    return response;
  } else {
    let response = `⚠️ **Completed with issues.** ${reflection.summary}`;

    if (reflection.completedSteps > 0) {
      response += `\n\n**Completed:** ${reflection.completedSteps}/${reflection.totalSteps} steps`;
    }

    if (reflection.errors.length > 0) {
      response += `\n\n**Issues:**\n${reflection.errors
        .slice(0, 2)
        .map((error) => `• ${error}`)
        .join('\n')}`;
    }

    if (reflection.suggestions.length > 0) {
      response += `\n\n**Recommendations:**\n${reflection.suggestions
        .slice(0, 2)
        .map((suggestion) => `💡 ${suggestion}`)
        .join('\n')}`;
    }

    return response;
  }
}
