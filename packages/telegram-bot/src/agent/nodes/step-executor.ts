import { getClaudeAI } from '../../ai/claude.js';
import { getMCPClient } from '../../mcp/client.js';
import { logger } from '../../utils/logger.js';
import { approvalManager } from '../approval-manager.js';
import type {
  ApprovalRequest,
  ExecutionStep,
  WorkflowNode,
  WorkflowState,
} from '../types/workflow-types.js';

/**
 * Step-by-step executor node - executes individual steps of a complex plan
 */
export const executeStep: WorkflowNode = async (
  state: WorkflowState,
): Promise<Partial<WorkflowState>> => {
  if (!state.executionPlan) {
    throw new Error('No execution plan found');
  }

  const currentStep = state.executionPlan.steps[state.currentStepIndex];
  if (!currentStep) {
    logger.info('All steps completed', {
      userId: state.userId,
      planId: state.executionPlan.id,
      totalSteps: state.executionPlan.steps.length,
    });
    return { shouldExit: true };
  }

  logger.info('Executing step', {
    userId: state.userId,
    planId: state.executionPlan.id,
    stepId: currentStep.id,
    stepIndex: state.currentStepIndex + 1,
    totalSteps: state.executionPlan.steps.length,
    action: currentStep.action,
  });

  // Override incorrect approval requirements for safe operations
  if (
    currentStep.action === 'analysis' ||
    currentStep.action === 'list_todos'
  ) {
    currentStep.requiresApproval = false;
  }

  // Check if step requires approval
  if (currentStep.requiresApproval && !state.awaitingApproval) {
    // First check if there's already an approval for this step
    const existingApproval = approvalManager
      .getAllRequests(state.userId)
      .find(
        (req) => req.stepId === currentStep.id && req.approved !== undefined,
      );

    if (existingApproval) {
      logger.info('Found existing approval for step', {
        stepId: currentStep.id,
        approved: existingApproval.approved,
        userId: state.userId,
      });

      if (!existingApproval.approved) {
        // Step was denied, skip it
        currentStep.status = 'skipped';
        currentStep.error = new Error(
          `User denied approval: ${existingApproval.response || 'No reason provided'}`,
        );

        await sendProgressUpdate(state, currentStep, 'skipped');

        return {
          currentStepIndex: state.currentStepIndex + 1,
          executionSteps: [...state.executionSteps, currentStep],
          awaitingApproval: false,
        };
      }
      // Step was approved, continue execution below
    } else {
      // No existing approval, request it
      return await requestApproval(state, currentStep);
    }
  }

  // If we're waiting for approval but haven't received it, skip execution for now
  if (state.awaitingApproval) {
    const pendingRequest = state.approvalRequests.find(
      (req) => req.stepId === currentStep.id && req.approved === undefined,
    );

    if (pendingRequest) {
      // Check if request has expired (5 minutes) - just log but don't auto-deny
      if (pendingRequest.expiresAt && Date.now() > pendingRequest.expiresAt) {
        logger.warn('Approval request expired but keeping workflow paused', {
          stepId: currentStep.id,
          requestId: pendingRequest.id,
        });
      }

      // Still waiting for approval, don't proceed
      logger.info('Still waiting for approval', {
        stepId: currentStep.id,
        requestId: pendingRequest.id,
      });

      return {
        shouldExit: true,
        awaitingApproval: true,
      };
    }

    // Check if approval was granted or denied (both local state and global manager)
    const localApprovedRequest = state.approvalRequests.find(
      (req) => req.stepId === currentStep.id && req.approved !== undefined,
    );

    // Also check global approval manager for recent approvals
    const globalAllRequests = approvalManager.getAllRequests(state.userId);
    const globalApprovedRequest = globalAllRequests.find(
      (req) => req.stepId === currentStep.id && req.approved !== undefined,
    );

    const approvedRequest = localApprovedRequest || globalApprovedRequest;

    if (approvedRequest) {
      if (!approvedRequest.approved) {
        // Approval denied, skip step or exit
        logger.info('Step approval denied', {
          stepId: currentStep.id,
          response: approvedRequest.response,
        });

        currentStep.status = 'skipped';
        currentStep.error = new Error(
          `User denied approval: ${approvedRequest.response || 'No reason provided'}`,
        );

        await sendProgressUpdate(state, currentStep, 'skipped');
        await state.telegramContext.reply(
          `⏭️ STEP SKIPPED\n\nStep "${currentStep.description}" was denied and has been skipped.`,
        );

        return {
          currentStepIndex: state.currentStepIndex + 1,
          executionSteps: [...state.executionSteps, currentStep],
          awaitingApproval: false,
        };
      } else {
        // Approval granted, proceed with execution
        logger.info('Step approval granted', {
          stepId: currentStep.id,
          response: approvedRequest.response,
        });

        await state.telegramContext.reply(
          `✅ APPROVED: ${currentStep.description}\n\nContinuing execution...`,
        );

        // Reset approval state and continue
        state.awaitingApproval = false;
      }
    }
  }

  // Check dependencies
  const dependencyCheck = checkDependencies(currentStep, state.executionSteps);
  if (!dependencyCheck.satisfied) {
    logger.warn('Step dependencies not satisfied', {
      stepId: currentStep.id,
      stepAction: currentStep.action,
      dependencies: currentStep.dependencies,
      missingDeps: dependencyCheck.missing,
      allExecutionSteps: state.executionSteps.map((s) => ({
        id: s.id,
        action: s.action,
        status: s.status,
        result: s.result ? 'has result' : 'no result',
      })),
      completedSteps: state.executionSteps
        .filter((s) => s.status === 'completed')
        .map((s) => s.id),
    });

    // Smart dependency resolution fallbacks
    let allowExecution = false;

    // For analysis steps that depend on list_todos, allow execution if any list_todos completed
    if (
      currentStep.action === 'analysis' &&
      state.executionSteps.some(
        (s) => s.action === 'list_todos' && s.status === 'completed',
      )
    ) {
      logger.info(
        'Allowing analysis step to proceed after successful list_todos',
        {
          stepId: currentStep.id,
          dependencies: currentStep.dependencies,
        },
      );
      allowExecution = true;
    }

    // For bulk operations, if previous list step completed, allow the operation to proceed
    if (
      currentStep.action.includes('delete') &&
      state.executionSteps.some(
        (s) => s.action === 'list_todos' && s.status === 'completed',
      )
    ) {
      logger.info(
        'Allowing delete step to proceed after successful list_todos',
        {
          stepId: currentStep.id,
        },
      );
      allowExecution = true;
    }

    // For create_todo steps, check if they depend on analysis steps that completed
    // This handles cases where the planner uses different step naming conventions
    if (
      currentStep.action === 'create_todo' &&
      state.executionSteps.some(
        (s) => s.action === 'analysis' && s.status === 'completed',
      )
    ) {
      logger.info(
        'Allowing create_todo step to proceed after completed analysis',
        {
          stepId: currentStep.id,
          dependencies: currentStep.dependencies,
        },
      );
      allowExecution = true;
    }

    // For sequential create_todo steps (like step_2, step_3, etc.), allow them if previous steps completed
    // This handles naming mismatches between planner dependencies and actual step IDs
    if (currentStep.action === 'create_todo') {
      const currentStepNum = parseInt(currentStep.id.replace('step_', ''));
      const expectedPreviousStepId = `step_${currentStepNum - 1}`;

      if (
        state.executionSteps.some(
          (s) => s.id === expectedPreviousStepId && s.status === 'completed',
        )
      ) {
        logger.info(
          'Allowing create_todo step to proceed after previous sequential step',
          {
            stepId: currentStep.id,
            expectedPreviousStepId,
            dependencies: currentStep.dependencies,
          },
        );
        allowExecution = true;
      }
    }

    // For sequential steps with dependencies, check if the previous sequential step completed
    // This is a more general fallback for any action type
    if (currentStep.dependencies.length > 0 && !allowExecution) {
      const currentStepNum = parseInt(currentStep.id.replace('step_', ''));

      // Check if this step depends on the immediately previous step
      if (currentStep.dependencies.includes(`step_${currentStepNum - 1}`)) {
        // Check if the previous step in execution order completed successfully
        const previousStepIndex = state.currentStepIndex - 1;
        if (
          previousStepIndex >= 0 &&
          previousStepIndex < state.executionSteps.length
        ) {
          const previousStep = state.executionSteps[previousStepIndex];
          if (previousStep && previousStep.status === 'completed') {
            logger.info(
              'Allowing step to proceed after previous sequential step completed',
              {
                stepId: currentStep.id,
                previousStepId: previousStep.id,
                previousStepStatus: previousStep.status,
                dependencies: currentStep.dependencies,
              },
            );
            allowExecution = true;
          }
        }
      }
    }

    if (!allowExecution) {
      // Skip step and mark as skipped
      currentStep.status = 'skipped';
      currentStep.error = new Error(
        `Dependencies not satisfied: ${dependencyCheck.missing.join(', ')}`,
      );

      await sendProgressUpdate(state, currentStep, 'skipped');

      return {
        currentStepIndex: state.currentStepIndex + 1,
        executionSteps: [...state.executionSteps, currentStep],
      };
    }
  }

  try {
    // Mark step as in progress
    currentStep.status = 'in_progress';
    currentStep.timestamp = Date.now();

    await sendProgressUpdate(state, currentStep, 'started');

    // Execute the step
    const stepResult = await executeStepAction(currentStep, state);

    // Mark step as completed
    currentStep.status = 'completed';
    currentStep.result = stepResult;
    currentStep.duration = Date.now() - (currentStep.timestamp || Date.now());

    logger.info('Step completed successfully', {
      userId: state.userId,
      stepId: currentStep.id,
      duration: currentStep.duration,
      result: typeof stepResult,
    });

    await sendProgressUpdate(state, currentStep, 'completed');

    return {
      currentStepIndex: state.currentStepIndex + 1,
      executionSteps: [...state.executionSteps, currentStep],
      mcpResponses: [...state.mcpResponses, stepResult],
    };
  } catch (error) {
    logger.error('Step execution failed', {
      error,
      userId: state.userId,
      stepId: currentStep.id,
      action: currentStep.action,
    });

    // Mark step as failed
    currentStep.status = 'failed';
    currentStep.error =
      error instanceof Error ? error : new Error(String(error));
    currentStep.duration = Date.now() - (currentStep.timestamp || Date.now());

    await sendProgressUpdate(state, currentStep, 'failed');

    // Try fallback action if available
    if (
      currentStep.fallbackAction &&
      currentStep.fallbackAction !== currentStep.action
    ) {
      logger.info('Attempting fallback action', {
        stepId: currentStep.id,
        fallbackAction: currentStep.fallbackAction,
      });

      try {
        const fallbackResult = await executeFallbackAction(currentStep, state);
        currentStep.status = 'completed';
        currentStep.result = fallbackResult;

        await sendProgressUpdate(state, currentStep, 'recovered');

        return {
          currentStepIndex: state.currentStepIndex + 1,
          executionSteps: [...state.executionSteps, currentStep],
          mcpResponses: [...state.mcpResponses, fallbackResult],
        };
      } catch (fallbackError) {
        logger.error('Fallback action also failed', {
          error: fallbackError,
          stepId: currentStep.id,
        });
      }
    }

    // Decide whether to continue or abort
    const shouldContinue = decideContinueOnFailure(
      currentStep,
      state.executionPlan!,
    );

    if (!shouldContinue) {
      await state.telegramContext.reply(
        `❌ EXECUTION STOPPED\n\nStep "${currentStep.description}" failed and I cannot continue safely. Please review the plan and try again.`,
      );

      return {
        shouldExit: true,
        executionSteps: [...state.executionSteps, currentStep],
        error: currentStep.error,
      };
    }

    // Continue with next step
    return {
      currentStepIndex: state.currentStepIndex + 1,
      executionSteps: [...state.executionSteps, currentStep],
    };
  }
};

/**
 * Requests user approval for a destructive step
 */
async function requestApproval(
  state: WorkflowState,
  step: ExecutionStep,
): Promise<Partial<WorkflowState>> {
  // Auto-approve safe operations like analysis steps
  if (step.action === 'analysis' || step.action === 'list_todos') {
    logger.info('Auto-approving safe operation', {
      stepId: step.id,
      action: step.action,
    });

    const autoApprovalRequest: ApprovalRequest = {
      id: `auto_approval_${Date.now()}_${step.id}`,
      planId: state.executionPlan!.id,
      stepId: step.id,
      message: `Auto-approved safe operation: ${step.description}`,
      options: [],
      approved: true,
      response: 'Auto-approved (safe operation)',
      timestamp: Date.now(),
    };

    await state.telegramContext.reply(
      `✅ AUTO-APPROVED: ${step.description}\n\nContinuing execution...`,
    );

    return {
      awaitingApproval: false,
      approvalRequests: [...state.approvalRequests, autoApprovalRequest],
    };
  }

  const approvalId = `approval_${Date.now()}_${step.id}`;

  const approvalRequest: ApprovalRequest = {
    id: approvalId,
    planId: state.executionPlan!.id,
    stepId: step.id,
    message: `⚠️ APPROVAL REQUIRED\n\nStep: ${step.description}\nAction: ${step.action}\nRisk: This operation ${getRiskDescription(step)}\n\nDo you want to proceed?`,
    options: ['✅ Approve', '❌ Deny', '⏭️ Skip'],
    timestamp: Date.now(),
    expiresAt: Date.now() + 5 * 60 * 1000, // 5 minute timeout
  };

  await state.telegramContext.reply(approvalRequest.message, {
    // Removed parse_mode to avoid markdown escaping issues
    // Note: In a real implementation, you'd add inline keyboard buttons here
  });

  logger.info('Approval requested', {
    userId: state.userId,
    approvalId,
    stepId: step.id,
  });

  // Register with global approval manager
  approvalManager.addRequest(state.userId, approvalRequest);

  // Include instructions for user
  await state.telegramContext.reply(
    `💡 TIP: Use /approve to approve or /deny to deny this request.`,
  );

  return {
    awaitingApproval: true,
    approvalRequests: [...state.approvalRequests, approvalRequest],
  };
}

/**
 * Gets risk description for approval message
 */
function getRiskDescription(step: ExecutionStep): string {
  const action = step.action.toLowerCase();

  if (action.includes('delete')) {
    return 'will permanently delete data';
  } else if (
    action.includes('update') &&
    step.parameters &&
    Object.keys(step.parameters).length > 1
  ) {
    return 'will modify existing data';
  } else if (
    action.includes('bulk') ||
    (step.parameters &&
      'limit' in step.parameters &&
      typeof step.parameters.limit === 'number' &&
      step.parameters.limit > 5)
  ) {
    return 'will affect multiple items';
  } else {
    return 'may have side effects';
  }
}

/**
 * Checks if step dependencies are satisfied
 */
function checkDependencies(
  step: ExecutionStep,
  completedSteps: ExecutionStep[],
): { satisfied: boolean; missing: string[] } {
  if (!step.dependencies || step.dependencies.length === 0) {
    logger.debug('Step has no dependencies, allowing execution', {
      stepId: step.id,
      action: step.action,
    });
    return { satisfied: true, missing: [] };
  }

  const completedStepIds = completedSteps
    .filter((s) => s.status === 'completed')
    .map((s) => s.id);

  const missing = step.dependencies.filter(
    (dep) => !completedStepIds.includes(dep),
  );

  logger.info('Dependency check details', {
    stepId: step.id,
    action: step.action,
    stepDependencies: step.dependencies,
    completedStepIds,
    completedStepCount: completedSteps.length,
    completedStepStatuses: completedSteps.map((s) => ({
      id: s.id,
      status: s.status,
    })),
    missingDependencies: missing,
    satisfied: missing.length === 0,
  });

  return {
    satisfied: missing.length === 0,
    missing,
  };
}

/**
 * Executes the main action for a step
 */
async function executeStepAction(
  step: ExecutionStep,
  state: WorkflowState,
): Promise<unknown> {
  const mcpClient = getMCPClient();

  // Ensure MCP client is connected
  if (!mcpClient.isClientConnected()) {
    await mcpClient.connect();
  }

  // Validate and fix date formats for todo operations
  if (['create_todo', 'update_todo'].includes(step.action)) {
    step.parameters = validateAndFixDates(step.parameters);
  }

  switch (step.action) {
    case 'analysis':
      return await executeAnalysisStep(step, state);

    case 'list_todos': {
      logger.info('Executing list_todos with parameters', {
        stepId: step.id,
        parameters: step.parameters,
      });
      const listResult = await mcpClient.listTodos(step.parameters as Parameters<typeof mcpClient.listTodos>[0]);
      logger.info('list_todos completed', {
        stepId: step.id,
        resultType: typeof listResult,
        resultLength: Array.isArray(listResult) ? listResult.length : 'N/A',
      });
      return listResult;
    }

    case 'create_todo':
      return await mcpClient.createTodo(step.parameters as Parameters<typeof mcpClient.createTodo>[0]);

    case 'update_todo':
      return await executeBulkOrSingleUpdate(step, state);

    case 'delete_todo':
      return await executeBulkOrSingleDelete(step, state);

    case 'toggle_completion': {
      const params = step.parameters as { id: string; completed: boolean };
      return await mcpClient.toggleTodoCompletion(params.id, params.completed);
    }

    case 'start_time_tracking': {
      const params = step.parameters as { id?: string; title?: string };
      
      if (params.id) {
        // Direct ID provided, start timer immediately
        return await mcpClient.startTimeTracking(params.id);
      } else if (params.title) {
        // Only title provided, need to find or create the todo first
        return await startTimeTrackingByTitle(params.title, state);
      } else {
        throw new Error('Either todoId or title is required to start timer');
      }
    }

    case 'stop_time_tracking': {
      const params = step.parameters as { id: string };
      return await mcpClient.stopTimeTracking(params.id);
    }

    case 'get_active_timers':
      return await mcpClient.getActiveTimeTracking();

    default:
      throw new Error(`Unknown action: ${step.action}`);
  }
}

/**
 * Executes analysis steps using Claude
 */
async function executeAnalysisStep(
  step: ExecutionStep,
  state: WorkflowState,
): Promise<string> {
  const claudeAI = getClaudeAI();

  // Get current context for analysis - use same parameters as the associated list_todos step if available
  const mcpClient = getMCPClient();
  
  // Look for a related list_todos step to get the specific filtering parameters
  let listTodosParams = { limit: 50 };
  const recentListStep = state.executionSteps
    .filter((s) => s.action === 'list_todos' && s.status === 'completed')
    .pop();
  
  if (recentListStep && recentListStep.parameters) {
    listTodosParams = { ...listTodosParams, ...recentListStep.parameters };
  }
  
  const currentTodos = await mcpClient.listTodos(listTodosParams);
  const activeTodos = currentTodos.filter((todo) => !todo.completed);
  
  // Group todos by context for better analysis
  const todosByContext = activeTodos.reduce((acc: Record<string, Array<typeof activeTodos[0]>>, todo) => {
    if (!acc[todo.context]) acc[todo.context] = [];
    acc[todo.context].push(todo);
    return acc;
  }, {});
  
  // Analyze due dates and priorities
  const overdueTodos = activeTodos.filter((t) => t.due && new Date(t.due) < new Date());
  const todayTodos = activeTodos.filter((t) => {
    if (!t.due) return false;
    const dueDate = new Date(t.due);
    const today = new Date();
    return dueDate.toDateString() === today.toDateString();
  });
  
  // Build detailed context information
  let contextDetails = '';
  if (Object.keys(todosByContext).length > 0) {
    contextDetails = `
DETAILED BREAKDOWN:
${Object.entries(todosByContext).map(([context, contextTodos]) => 
  `${context.toUpperCase()} Context (${contextTodos.length} active todos):
${contextTodos.slice(0, 3).map((todo) => 
  `  - "${todo.title}"${todo.due ? ` (due: ${new Date(todo.due).toLocaleDateString()})` : ''}${todo.tags && Array.isArray(todo.tags) && todo.tags.length > 0 ? ` [${todo.tags.join(', ')}]` : ''}`
).join('\n')}${contextTodos.length > 3 ? `\n  ... and ${contextTodos.length - 3} more todos` : ''}`
).join('\n\n')}`;
  }

  const analysisPrompt = `Analyze the current todo state for the following request and provide specific actionable insights:
  
USER REQUEST: ${state.userMessage}
STEP DESCRIPTION: ${step.description}

CURRENT STATE:
- Total todos: ${currentTodos.length}
- Active todos: ${activeTodos.length}
- Overdue todos: ${overdueTodos.length}
- Due today: ${todayTodos.length}
- Contexts: ${[...new Set(currentTodos.map((t) => t.context))].join(', ')}
${contextDetails}

Based on the user's request, determine if they are seeking recommendations about what to work on next. If so, you MUST make a decisive recommendation by picking ONE specific todo as the primary next action and explaining why.

Analyze the todos and provide a concrete recommendation based on:
1. Due dates and urgency (overdue items first)
2. Items due today
3. Items with earlier due dates
4. Logical workflow and dependencies
5. Quick wins or high-impact tasks

Structure your response as:
"RECOMMENDATION: Start with '[specific todo title]' because [brief reason]. This task [additional context about urgency/importance]."

Then provide brief additional context about the overall state of this context.

Be decisive and specific - always pick one task to unblock the user.`;

  const response = await claudeAI.generateResponse(
    state.userId,
    analysisPrompt,
  );
  return response.content;
}

/**
 * Executes fallback action when main action fails
 */
async function executeFallbackAction(
  step: ExecutionStep,
  state: WorkflowState,
): Promise<unknown> {
  logger.info('Executing fallback action', {
    stepId: step.id,
    fallbackAction: step.fallbackAction,
  });

  // Create a modified step with the fallback action
  const fallbackStep: ExecutionStep = {
    ...step,
    action: step.fallbackAction || 'analysis',
    description: `Fallback: ${step.fallbackAction}`,
  };

  return await executeStepAction(fallbackStep, state);
}

/**
 * Decides whether to continue execution after a step failure
 */
function decideContinueOnFailure(
  failedStep: ExecutionStep,
  plan: WorkflowState['executionPlan'],
): boolean {
  // Don't continue if it's a critical step (first step or has many dependencies)
  const dependentSteps = plan!.steps.filter(
    (step) => step.dependencies && step.dependencies.includes(failedStep.id),
  );

  if (dependentSteps.length > 2) {
    return false; // Too many steps depend on this one
  }

  // Don't continue for high-risk operations
  if (plan!.riskLevel === 'high' && failedStep.requiresApproval) {
    return false;
  }

  // Continue for analysis steps or low-risk operations
  return failedStep.action === 'analysis' || plan!.riskLevel === 'low';
}

/**
 * Sends progress updates to the user
 */
async function sendProgressUpdate(
  state: WorkflowState,
  step: ExecutionStep,
  status: 'started' | 'completed' | 'failed' | 'skipped' | 'recovered',
): Promise<void> {
  const stepNumber = state.currentStepIndex + 1;
  const totalSteps = state.executionPlan!.steps.length;
  const progressBar = generateProgressBar(stepNumber, totalSteps);

  let message = '';
  let icon = '';

  switch (status) {
    case 'started':
      icon = '🔄';
      message = `${icon} Step ${stepNumber}/${totalSteps}: ${step.description}\n${progressBar}`;
      break;
    case 'completed':
      icon = '✅';
      message = `${icon} Completed: ${step.description}\n${progressBar}`;
      break;
    case 'failed':
      icon = '❌';
      message = `${icon} Failed: ${step.description}\n${progressBar}\nError: ${step.error?.message}`;
      break;
    case 'skipped':
      icon = '⏭️';
      message = `${icon} Skipped: ${step.description}\n${progressBar}\nReason: Dependencies not met`;
      break;
    case 'recovered':
      icon = '🔄';
      message = `${icon} Recovered: ${step.description}\n${progressBar}\nFallback action succeeded`;
      break;
  }

  // Send update to user (in a real implementation, you might throttle these)
  if (status === 'completed' || status === 'failed' || status === 'recovered') {
    await state.telegramContext.reply(message);
  }
}

/**
 * Validates and fixes date formats in step parameters
 */
function validateAndFixDates(
  parameters: Record<string, unknown>,
): Record<string, unknown> {
  const fixed = { ...parameters };

  if (fixed.due && typeof fixed.due === 'string') {
    const due = fixed.due.toLowerCase();

    // If it's already an ISO string, keep it
    if (due.includes('t') && due.includes('z')) {
      return fixed;
    }

    // Convert common relative dates to ISO format
    const now = new Date();
    let targetDate: Date;

    if (due.includes('saturday')) {
      targetDate = getNextWeekday(now, 6); // Saturday = 6
    } else if (due.includes('sunday')) {
      targetDate = getNextWeekday(now, 0); // Sunday = 0
    } else if (due.includes('monday')) {
      targetDate = getNextWeekday(now, 1);
    } else if (due.includes('tuesday')) {
      targetDate = getNextWeekday(now, 2);
    } else if (due.includes('wednesday')) {
      targetDate = getNextWeekday(now, 3);
    } else if (due.includes('thursday')) {
      targetDate = getNextWeekday(now, 4);
    } else if (due.includes('friday')) {
      targetDate = getNextWeekday(now, 5);
    } else if (due.includes('tomorrow')) {
      targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() + 1);
    } else if (due.includes('today')) {
      targetDate = new Date(now);
    } else {
      // Try to parse as a date string, fallback to end of today
      try {
        targetDate = new Date(fixed.due as string);
        if (isNaN(targetDate.getTime())) {
          targetDate = new Date(now);
          targetDate.setHours(23, 59, 59, 999);
        }
      } catch {
        targetDate = new Date(now);
        targetDate.setHours(23, 59, 59, 999);
      }
    }

    // Set time to end of day if no specific time mentioned
    if (!due.includes(':') && !due.includes('am') && !due.includes('pm')) {
      targetDate.setHours(23, 59, 59, 999);
    }

    fixed.due = targetDate.toISOString();

    logger.info('Fixed date format', {
      original: parameters.due,
      fixed: fixed.due,
    });
  }

  return fixed;
}

/**
 * Gets the next occurrence of a specific weekday
 */
function getNextWeekday(from: Date, targetDay: number): Date {
  const result = new Date(from);
  const currentDay = result.getDay();

  // Calculate days until target weekday
  let daysUntil = targetDay - currentDay;
  if (daysUntil <= 0) {
    daysUntil += 7; // Next week
  }

  result.setDate(result.getDate() + daysUntil);
  return result;
}

/**
 * Executes bulk update operations by looking at previous list_todos results
 */
async function executeBulkOrSingleUpdate(
  step: ExecutionStep,
  state: WorkflowState,
): Promise<unknown> {
  const mcpClient = getMCPClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stepParams = step.parameters as any;

  // If step has a specific ID, it's a single update
  if (stepParams.id) {
    logger.info('Executing single todo update', { id: stepParams.id });
    return await mcpClient.updateTodo(stepParams);
  }

  // If no ID, it's a bulk operation - look for previous list_todos results
  const listStepIndex = state.executionSteps.findIndex(
    (s) => s.action === 'list_todos' && s.status === 'completed',
  );

  if (listStepIndex === -1) {
    throw new Error('Bulk update requires a completed list_todos step');
  }

  const listResult = state.mcpResponses[listStepIndex];
  let todos: Array<{ _id: string; title?: string; [key: string]: unknown }>;

  // Handle different response formats
  if (typeof listResult === 'string') {
    try {
      todos = JSON.parse(listResult);
    } catch {
      throw new Error('Could not parse todo list from previous step');
    }
  } else if (Array.isArray(listResult)) {
    todos = listResult;
  } else {
    throw new Error('Invalid todo list format from previous step');
  }

  if (!Array.isArray(todos) || todos.length === 0) {
    logger.info('No todos found to update');
    return { updated: 0, message: 'No todos found matching criteria' };
  }

  logger.info('Executing bulk update operation', {
    todoCount: todos.length,
    stepId: step.id,
  });

  // Update each todo individually
  const results = [];
  let successCount = 0;
  let errorCount = 0;

  // Extract update fields (exclude id from the parameters)
  const { id, ...updateFields } = stepParams;

  for (const todo of todos) {
    try {
      const updateParams = { id: todo._id, ...updateFields };
      const result = await mcpClient.updateTodo(updateParams);
      results.push({ id: todo._id, success: true, result });
      successCount++;

      logger.info('Todo updated successfully', {
        id: todo._id,
        title: todo.title,
      });
    } catch (error) {
      results.push({ id: todo._id, success: false, error: String(error) });
      errorCount++;

      logger.error('Failed to update todo', {
        id: todo._id,
        title: todo.title,
        error,
      });
    }
  }

  const summary = {
    total: todos.length,
    successful: successCount,
    failed: errorCount,
    updateFields,
    results,
  };

  logger.info('Bulk update completed', summary);

  return summary;
}

/**
 * Executes bulk delete operations by looking at previous list_todos results
 */
async function executeBulkOrSingleDelete(
  step: ExecutionStep,
  state: WorkflowState,
): Promise<unknown> {
  const mcpClient = getMCPClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stepParams = step.parameters as any;

  // If step has a specific ID, it's a single delete
  if (stepParams.id) {
    logger.info('Executing single todo delete', { id: stepParams.id });
    return await mcpClient.deleteTodo(stepParams.id);
  }

  // If no ID, it's a bulk operation - look for previous list_todos results
  // Find the MOST RECENT completed list_todos step (in case there are multiple)
  const listStepIndex = state.executionSteps
    .map((s, index) => ({ step: s, index }))
    .filter(
      ({ step }) => step.action === 'list_todos' && step.status === 'completed',
    )
    .pop()?.index; // Get the last (most recent) one

  if (listStepIndex === undefined) {
    throw new Error('Bulk delete requires a completed list_todos step');
  }

  const listStep = state.executionSteps[listStepIndex];
  const listResult = state.mcpResponses[listStepIndex];

  logger.info('Bulk delete using list_todos step', {
    stepId: listStep.id,
    stepIndex: listStepIndex,
    listParameters: listStep.parameters,
    resultType: typeof listResult,
  });
  let todos: Array<{ _id: string; title?: string; [key: string]: unknown }>;

  // Handle different response formats
  if (typeof listResult === 'string') {
    try {
      todos = JSON.parse(listResult);
    } catch {
      throw new Error('Could not parse todo list from previous step');
    }
  } else if (Array.isArray(listResult)) {
    todos = listResult;
  } else {
    throw new Error('Invalid todo list format from previous step');
  }

  if (!Array.isArray(todos) || todos.length === 0) {
    logger.info('No todos found to delete');
    return { deleted: 0, message: 'No todos found matching criteria' };
  }

  // SAFETY CHECK: Prevent deleting all todos if no proper filtering was applied
  const uniqueContexts = [...new Set(todos.map((t) => t.context))];
  const listStepParams = listStep.parameters as {
    context?: string;
    [key: string]: unknown;
  };

  // If we're deleting more than 10 todos, or todos span multiple contexts,
  // and no context filter was applied, this might be dangerous
  if (todos.length > 10 || uniqueContexts.length > 2) {
    if (!listStepParams.context) {
      logger.error(
        'SAFETY VIOLATION: Attempting bulk delete without context filter',
        {
          todoCount: todos.length,
          uniqueContexts,
          listStepParams,
          stepId: step.id,
        },
      );
      throw new Error(
        `Safety check failed: Cannot delete ${todos.length} todos across ${uniqueContexts.length} contexts without explicit context filter`,
      );
    }
  }

  logger.info('Executing bulk delete operation', {
    todoCount: todos.length,
    stepId: step.id,
    listStepParams,
    uniqueContexts,
    todoIds: todos.map((t) => t._id),
    todoTitles: todos.map((t) => t.title),
    todoContexts: todos.map((t) => t.context),
  });

  // Delete each todo individually
  const results = [];
  let successCount = 0;
  let errorCount = 0;

  for (const todo of todos) {
    try {
      const result = await mcpClient.deleteTodo(todo._id);
      results.push({ id: todo._id, success: true, result });
      successCount++;

      logger.info('Todo deleted successfully', {
        id: todo._id,
        title: todo.title,
      });
    } catch (error) {
      results.push({ id: todo._id, success: false, error: String(error) });
      errorCount++;

      logger.error('Failed to delete todo', {
        id: todo._id,
        title: todo.title,
        error,
      });
    }
  }

  const summary = {
    total: todos.length,
    successful: successCount,
    failed: errorCount,
    results,
  };

  logger.info('Bulk delete completed', summary);

  return summary;
}

/**
 * Generates a visual progress bar
 */
function generateProgressBar(current: number, total: number): string {
  const percentage = Math.round((current / total) * 100);
  const filled = Math.round((current / total) * 10);
  const empty = 10 - filled;

  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${percentage}%`;
}

/**
 * Starts time tracking for a todo by title - finds existing or creates new
 */
async function startTimeTrackingByTitle(
  title: string,
  state: WorkflowState,
): Promise<string> {
  const mcpClient = getMCPClient();
  
  logger.info('Starting time tracking by title', { title });
  
  // Look for previous list_todos results in this workflow that might contain the todo
  const listSteps = state.executionSteps.filter(
    (step) => step.action === 'list_todos' && step.status === 'completed'
  );
  
  let existingTodo = null;
  
  // Check if we already have the todo from a previous list operation
  for (const listStep of listSteps.reverse()) { // Start with most recent
    const listResult = state.mcpResponses[state.executionSteps.indexOf(listStep)];
    
    try {
      let todos: Array<{ _id: string; title: string; [key: string]: unknown }> = [];
      if (typeof listResult === 'string') {
        todos = JSON.parse(listResult);
      } else if (Array.isArray(listResult)) {
        todos = listResult;
      }
      
      // Find a todo that matches the title (case-insensitive partial match)
      existingTodo = todos.find((todo) => 
        todo.title.toLowerCase().includes(title.toLowerCase()) ||
        title.toLowerCase().includes(todo.title.toLowerCase())
      );
      
      if (existingTodo) {
        logger.info('Found existing todo in previous results', { 
          todoId: existingTodo._id, 
          todoTitle: existingTodo.title,
          searchTitle: title
        });
        break;
      }
    } catch (error) {
      logger.warn('Failed to parse previous list results', { error });
    }
  }
  
  // If not found in previous results, search explicitly
  if (!existingTodo) {
    logger.info('Todo not found in previous results, searching explicitly', { title });
    
    try {
      const searchResults = await mcpClient.listTodos({ limit: 50 });
      existingTodo = searchResults.find((todo) => 
        todo.title.toLowerCase().includes(title.toLowerCase()) ||
        title.toLowerCase().includes(todo.title.toLowerCase())
      );
      
      if (existingTodo) {
        logger.info('Found existing todo via search', { 
          todoId: existingTodo._id, 
          todoTitle: existingTodo.title,
          searchTitle: title
        });
      }
    } catch (error) {
      logger.error('Failed to search for existing todos', { error });
    }
  }
  
  if (existingTodo) {
    // Start timer on existing todo
    logger.info('Starting timer on existing todo', { 
      todoId: existingTodo._id, 
      title: existingTodo.title 
    });
    return await mcpClient.startTimeTracking(existingTodo._id);
  } else {
    // Create new todo and start timer
    logger.info('Creating new todo and starting timer', { title });
    
    const createResult = await mcpClient.createTodo({ 
      title,
      context: 'private' // Default context, can be enhanced later
    });
    
    // Extract the ID from the create result (format might vary)
    const idMatch = createResult.match(/[a-f0-9-]{36}|[a-f0-9]{24}/i);
    if (!idMatch) {
      throw new Error('Failed to extract todo ID from create result');
    }
    
    const newTodoId = idMatch[0];
    logger.info('Created todo and starting timer', { todoId: newTodoId, title });
    
    return await mcpClient.startTimeTracking(newTodoId);
  }
}
