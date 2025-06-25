import { ChatAnthropic } from '@langchain/anthropic';

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
      model: 'claude-3-5-sonnet-20241022',
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
    const aiReflection = JSON.parse(content);

    // Validate and enhance the reflection
    return validateReflection(aiReflection, executionData);
  } catch (parseError) {
    logger.warn('Failed to parse AI reflection, using fallback', {
      parseError,
      content: response.content,
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
