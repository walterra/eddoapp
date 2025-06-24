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
      return `Deleted todo with ID: ${step.parameters.id}`;

    case 'toggle_completion':
      return `${step.parameters.completed ? 'Completed' : 'Reopened'} todo with ID: ${step.parameters.id}`;

    case 'start_time_tracking':
      return `Started timer for todo with ID: ${step.parameters.id}`;

    case 'stop_time_tracking':
      return `Stopped timer for todo with ID: ${step.parameters.id}`;

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

  const prompt = `Based on the execution of this todo management workflow, provide 2-3 brief suggestions for improving the user's productivity or todo organization.

EXECUTION CONTEXT:
- User Request: ${state.userMessage}
- Plan: ${state.executionPlan?.userIntent}
- Completed Steps: ${state.executionSteps.filter((s) => s.status === 'completed').length}
- Failed Steps: ${state.executionSteps.filter((s) => s.status === 'failed').length}

STEP DETAILS:
${state.executionSteps.map((step) => `- ${step.status.toUpperCase()}: ${step.description}`).join('\n')}

Provide practical, actionable suggestions in a JSON array of strings. Focus on:
- Better todo organization
- Workflow optimization  
- Preventing similar issues
- Productivity improvements

Respond with ONLY a JSON array of 2-3 suggestion strings, no other text.`;

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

  // Fallback suggestions
  return [
    'Consider grouping related todos by context or project',
    'Set due dates for time-sensitive tasks',
    'Review and clean up completed todos regularly',
  ];
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

  // Suggest follow-up actions based on the original intent
  const userIntent = state.executionPlan?.userIntent.toLowerCase() || '';

  if (userIntent.includes('clean') || userIntent.includes('organize')) {
    nextActions.push('Set up regular cleanup reminders');
  }

  if (userIntent.includes('project') || userIntent.includes('plan')) {
    nextActions.push('Create milestone todos for project tracking');
  }

  if (userIntent.includes('overdue') || userIntent.includes('deadline')) {
    nextActions.push('Set up due date notifications');
  }

  // If no specific next actions, suggest general ones
  if (nextActions.length === 0) {
    nextActions.push('Review your todo list and update priorities');
    nextActions.push('Consider setting up recurring todos for routine tasks');
  }

  return nextActions.slice(0, 3); // Limit to 3 next actions
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
