import { getMCPClient } from '../../mcp/client.js';
import { getClaudeAI } from '../../ai/claude.js';
import { logger } from '../../utils/logger.js';
import { approvalManager } from '../approval-manager.js';
import type { WorkflowNode, ExecutionStep, WorkflowState, ApprovalRequest } from '../types/workflow-types.js';

/**
 * Step-by-step executor node - executes individual steps of a complex plan
 */
export const executeStep: WorkflowNode = async (state: WorkflowState): Promise<Partial<WorkflowState>> => {
  if (!state.executionPlan) {
    throw new Error('No execution plan found');
  }

  const currentStep = state.executionPlan.steps[state.currentStepIndex];
  if (!currentStep) {
    logger.info('All steps completed', { 
      userId: state.userId,
      planId: state.executionPlan.id,
      totalSteps: state.executionPlan.steps.length
    });
    return { shouldExit: true };
  }

  logger.info('Executing step', {
    userId: state.userId,
    planId: state.executionPlan.id,
    stepId: currentStep.id,
    stepIndex: state.currentStepIndex + 1,
    totalSteps: state.executionPlan.steps.length,
    action: currentStep.action
  });

  // Override incorrect approval requirements for safe operations
  if (currentStep.action === 'analysis' || currentStep.action === 'list_todos') {
    currentStep.requiresApproval = false;
  }

  // Check if step requires approval
  if (currentStep.requiresApproval && !state.awaitingApproval) {
    return await requestApproval(state, currentStep);
  }

  // If we're waiting for approval but haven't received it, skip execution for now
  if (state.awaitingApproval) {
    const pendingRequest = state.approvalRequests.find((req) => 
      req.stepId === currentStep.id && req.approved === undefined
    );
    
    if (pendingRequest) {
      // Check if request has expired (5 minutes) - just log but don't auto-deny
      if (pendingRequest.expiresAt && Date.now() > pendingRequest.expiresAt) {
        logger.warn('Approval request expired but keeping workflow paused', {
          stepId: currentStep.id,
          requestId: pendingRequest.id
        });
      }
      
      // Still waiting for approval, don't proceed
      logger.info('Still waiting for approval', {
        stepId: currentStep.id,
        requestId: pendingRequest.id
      });
      
      return { 
        shouldExit: true,
        awaitingApproval: true
      };
    }
    
    // Check if approval was granted or denied (both local state and global manager)
    const localApprovedRequest = state.approvalRequests.find((req) => 
      req.stepId === currentStep.id && req.approved !== undefined
    );
    
    // Also check global approval manager for recent approvals
    const globalAllRequests = approvalManager.getAllRequests(state.userId);
    const globalApprovedRequest = globalAllRequests.find((req) =>
      req.stepId === currentStep.id && req.approved !== undefined
    );
    
    const approvedRequest = localApprovedRequest || globalApprovedRequest;
    
    if (approvedRequest) {
      if (!approvedRequest.approved) {
        // Approval denied, skip step or exit
        logger.info('Step approval denied', {
          stepId: currentStep.id,
          response: approvedRequest.response
        });
        
        currentStep.status = 'skipped';
        currentStep.error = new Error(`User denied approval: ${approvedRequest.response || 'No reason provided'}`);
        
        await sendProgressUpdate(state, currentStep, 'skipped');
        await state.telegramContext.reply(
          `⏭️ STEP SKIPPED\n\nStep "${currentStep.description}" was denied and has been skipped.`
        );
        
        return {
          currentStepIndex: state.currentStepIndex + 1,
          executionSteps: [...state.executionSteps, currentStep],
          awaitingApproval: false
        };
      } else {
        // Approval granted, proceed with execution
        logger.info('Step approval granted', {
          stepId: currentStep.id,
          response: approvedRequest.response
        });
        
        await state.telegramContext.reply(
          `✅ APPROVED: ${currentStep.description}\n\nContinuing execution...`
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
      dependencies: currentStep.dependencies,
      missingDeps: dependencyCheck.missing,
      completedSteps: state.executionSteps.map((s) => ({ id: s.id, status: s.status }))
    });
    
    // For bulk operations, if previous list step completed, allow the delete step to proceed
    // This is a temporary workaround for dependency naming issues
    if (currentStep.action.includes('delete') && state.executionSteps.some((s) => s.action === 'list_todos' && s.status === 'completed')) {
      logger.info('Allowing delete step to proceed after successful list_todos', {
        stepId: currentStep.id
      });
    } else {
      // Skip step and mark as skipped
      currentStep.status = 'skipped';
      currentStep.error = new Error(`Dependencies not satisfied: ${dependencyCheck.missing.join(', ')}`);
      
      await sendProgressUpdate(state, currentStep, 'skipped');
      
      return {
        currentStepIndex: state.currentStepIndex + 1,
        executionSteps: [...state.executionSteps, currentStep]
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
      result: typeof stepResult
    });

    await sendProgressUpdate(state, currentStep, 'completed');

    return {
      currentStepIndex: state.currentStepIndex + 1,
      executionSteps: [...state.executionSteps, currentStep],
      mcpResponses: [...state.mcpResponses, stepResult]
    };

  } catch (error) {
    logger.error('Step execution failed', {
      error,
      userId: state.userId,
      stepId: currentStep.id,
      action: currentStep.action
    });

    // Mark step as failed
    currentStep.status = 'failed';
    currentStep.error = error instanceof Error ? error : new Error(String(error));
    currentStep.duration = Date.now() - (currentStep.timestamp || Date.now());

    await sendProgressUpdate(state, currentStep, 'failed');

    // Try fallback action if available
    if (currentStep.fallbackAction && currentStep.fallbackAction !== currentStep.action) {
      logger.info('Attempting fallback action', {
        stepId: currentStep.id,
        fallbackAction: currentStep.fallbackAction
      });

      try {
        const fallbackResult = await executeFallbackAction(currentStep, state);
        currentStep.status = 'completed';
        currentStep.result = fallbackResult;
        
        await sendProgressUpdate(state, currentStep, 'recovered');
        
        return {
          currentStepIndex: state.currentStepIndex + 1,
          executionSteps: [...state.executionSteps, currentStep],
          mcpResponses: [...state.mcpResponses, fallbackResult]
        };
      } catch (fallbackError) {
        logger.error('Fallback action also failed', {
          error: fallbackError,
          stepId: currentStep.id
        });
      }
    }

    // Decide whether to continue or abort
    const shouldContinue = decideContinueOnFailure(currentStep, state.executionPlan!);
    
    if (!shouldContinue) {
      await state.telegramContext.reply(
        `❌ EXECUTION STOPPED\n\nStep "${currentStep.description}" failed and I cannot continue safely. Please review the plan and try again.`
      );
      
      return {
        shouldExit: true,
        executionSteps: [...state.executionSteps, currentStep],
        error: currentStep.error
      };
    }

    // Continue with next step
    return {
      currentStepIndex: state.currentStepIndex + 1,
      executionSteps: [...state.executionSteps, currentStep]
    };
  }
};

/**
 * Requests user approval for a destructive step
 */
async function requestApproval(state: WorkflowState, step: ExecutionStep): Promise<Partial<WorkflowState>> {
  // Auto-approve safe operations like analysis steps
  if (step.action === 'analysis' || step.action === 'list_todos') {
    logger.info('Auto-approving safe operation', {
      stepId: step.id,
      action: step.action
    });
    
    const autoApprovalRequest: ApprovalRequest = {
      id: `auto_approval_${Date.now()}_${step.id}`,
      planId: state.executionPlan!.id,
      stepId: step.id,
      message: `Auto-approved safe operation: ${step.description}`,
      options: [],
      approved: true,
      response: 'Auto-approved (safe operation)',
      timestamp: Date.now()
    };
    
    await state.telegramContext.reply(
      `✅ AUTO-APPROVED: ${step.description}\n\nContinuing execution...`
    );
    
    return {
      awaitingApproval: false,
      approvalRequests: [...state.approvalRequests, autoApprovalRequest]
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
    expiresAt: Date.now() + (5 * 60 * 1000) // 5 minute timeout
  };

  await state.telegramContext.reply(approvalRequest.message, { 
    // Removed parse_mode to avoid markdown escaping issues
    // Note: In a real implementation, you'd add inline keyboard buttons here
  });

  logger.info('Approval requested', {
    userId: state.userId,
    approvalId,
    stepId: step.id
  });

  // Register with global approval manager
  approvalManager.addRequest(state.userId, approvalRequest);

  // Include instructions for user
  await state.telegramContext.reply(
    `💡 TIP: Use /approve to approve or /deny to deny this request.`
  );

  return {
    awaitingApproval: true,
    approvalRequests: [...state.approvalRequests, approvalRequest]
  };
}

/**
 * Gets risk description for approval message
 */
function getRiskDescription(step: ExecutionStep): string {
  const action = step.action.toLowerCase();
  
  if (action.includes('delete')) {
    return 'will permanently delete data';
  } else if (action.includes('update') && step.parameters && Object.keys(step.parameters).length > 1) {
    return 'will modify existing data';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } else if (action.includes('bulk') || (step.parameters && (step.parameters as any).limit && (step.parameters as any).limit > 5)) {
    return 'will affect multiple items';
  } else {
    return 'may have side effects';
  }
}

/**
 * Checks if step dependencies are satisfied
 */
function checkDependencies(step: ExecutionStep, completedSteps: ExecutionStep[]): { satisfied: boolean; missing: string[] } {
  if (!step.dependencies || step.dependencies.length === 0) {
    return { satisfied: true, missing: [] };
  }

  const completedStepIds = completedSteps
    .filter((s) => s.status === 'completed')
    .map((s) => s.id);

  const missing = step.dependencies.filter((dep) => !completedStepIds.includes(dep));
  
  return {
    satisfied: missing.length === 0,
    missing
  };
}

/**
 * Executes the main action for a step
 */
async function executeStepAction(step: ExecutionStep, state: WorkflowState): Promise<unknown> {
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
    
    case 'list_todos':
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return await mcpClient.listTodos(step.parameters as any);
    
    case 'create_todo':
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return await mcpClient.createTodo(step.parameters as any);
    
    case 'update_todo':
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return await mcpClient.updateTodo(step.parameters as any);
    
    case 'delete_todo':
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return await mcpClient.deleteTodo((step.parameters as any).id);
    
    case 'toggle_completion':
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return await mcpClient.toggleTodoCompletion((step.parameters as any).id, (step.parameters as any).completed);
    
    case 'start_time_tracking':
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return await mcpClient.startTimeTracking((step.parameters as any).id);
    
    case 'stop_time_tracking':
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return await mcpClient.stopTimeTracking((step.parameters as any).id);
    
    case 'get_active_timers':
      return await mcpClient.getActiveTimeTracking();
    
    default:
      throw new Error(`Unknown action: ${step.action}`);
  }
}

/**
 * Executes analysis steps using Claude
 */
async function executeAnalysisStep(step: ExecutionStep, state: WorkflowState): Promise<string> {
  const claudeAI = getClaudeAI();
  
  // Get current context for analysis
  const mcpClient = getMCPClient();
  const currentTodos = await mcpClient.listTodos({ limit: 50 });
  const activeTodos = currentTodos.filter((todo) => !todo.completed);
  
  const analysisPrompt = `Analyze the current todo state for the following request:
  
USER REQUEST: ${state.userMessage}
STEP DESCRIPTION: ${step.description}

CURRENT STATE:
- Total todos: ${currentTodos.length}
- Active todos: ${activeTodos.length}
- Contexts: ${[...new Set(currentTodos.map((t) => t.context))].join(', ')}

Provide a brief analysis of what was discovered and what this means for the execution plan.`;

  const response = await claudeAI.generateResponse(state.userId, analysisPrompt);
  return response.content;
}

/**
 * Executes fallback action when main action fails
 */
async function executeFallbackAction(step: ExecutionStep, state: WorkflowState): Promise<unknown> {
  logger.info('Executing fallback action', {
    stepId: step.id,
    fallbackAction: step.fallbackAction
  });

  // Create a modified step with the fallback action
  const fallbackStep: ExecutionStep = {
    ...step,
    action: step.fallbackAction || 'analysis',
    description: `Fallback: ${step.fallbackAction}`
  };

  return await executeStepAction(fallbackStep, state);
}

/**
 * Decides whether to continue execution after a step failure
 */
function decideContinueOnFailure(failedStep: ExecutionStep, plan: WorkflowState['executionPlan']): boolean {
  // Don't continue if it's a critical step (first step or has many dependencies)
  const dependentSteps = plan!.steps.filter((step) => 
    step.dependencies && step.dependencies.includes(failedStep.id)
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
  status: 'started' | 'completed' | 'failed' | 'skipped' | 'recovered'
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
function validateAndFixDates(parameters: Record<string, unknown>): Record<string, unknown> {
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
      fixed: fixed.due
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
 * Generates a visual progress bar
 */
function generateProgressBar(current: number, total: number): string {
  const percentage = Math.round((current / total) * 100);
  const filled = Math.round((current / total) * 10);
  const empty = 10 - filled;
  
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${percentage}%`;
}
