import { Command, interrupt } from '@langchain/langgraph';
import { v4 as uuidv4 } from 'uuid';

import { logger } from '../../utils/logger.js';
import { enhancedApprovalManager } from '../enhanced-approval-manager.js';
import type {
  ApprovalRequest,
  EnhancedWorkflowStateType,
  PlanStep,
} from '../enhanced-workflow-state.js';
import { telegramContextManager } from '../enhanced-workflow-state.js';

/**
 * Human Approval Node - Handles user approvals with proper interrupt mechanism
 * Following LangGraph examples for human-in-the-loop patterns
 */
export function requestApproval(
  state: EnhancedWorkflowStateType,
): Command | Partial<EnhancedWorkflowStateType> {
  logger.info('Evaluating approval requirements', {
    userId: state.userId,
    planRequiresApproval: state.executionPlan?.requiresApproval,
    riskLevel: state.executionPlan?.riskLevel,
    stepCount: state.executionPlan?.steps.length,
  });

  // Skip approval if not required
  if (!state.executionPlan?.requiresApproval) {
    logger.info('No approval required, proceeding to execution', {
      userId: state.userId,
      planId: state.executionPlan?.id,
    });
    return new Command({ goto: 'execute_steps' });
  }

  // Create approval request
  const approvalRequest: ApprovalRequest = {
    id: uuidv4(),
    stepId: state.executionPlan.id,
    action: 'execute_plan',
    parameters: {
      planId: state.executionPlan.id,
      stepCount: state.executionPlan.steps.length,
    },
    description: `Execute plan: ${state.executionPlan.userIntent}`,
    riskLevel: state.executionPlan.riskLevel,
    message: createApprovalMessage(state),
    timestamp: Date.now(),
  };

  logger.info('Requesting user approval', {
    userId: state.userId,
    planId: state.executionPlan.id,
    riskLevel: state.executionPlan.riskLevel,
    approvalId: approvalRequest.id,
  });

  // Send approval request to user via Telegram
  sendApprovalToUser(state, approvalRequest);

  // Register with enhanced approval manager and use LangGraph interrupt
  let approvalResult: { approved: boolean; feedback?: string } | undefined;
  
  enhancedApprovalManager.registerPendingApproval(
    state.userId,
    approvalRequest,
    (result) => {
      approvalResult = result;
    }
  );

  // Use LangGraph interrupt to pause execution and wait for human input
  const interruptResult = interrupt({
    question: 'Do you want to execute this plan?',
    plan: {
      id: state.executionPlan.id,
      userIntent: state.executionPlan.userIntent,
      steps: state.executionPlan.steps.map((step) => ({
        description: step.description,
        action: step.action,
        riskLevel: step.riskLevel,
      })),
      riskLevel: state.executionPlan.riskLevel,
      estimatedDuration: state.executionPlan.estimatedDuration,
    },
    riskLevel: state.executionPlan.riskLevel,
    warning:
      state.executionPlan.riskLevel === 'high'
        ? 'This plan contains high-risk operations!'
        : undefined,
    approvalId: approvalRequest.id,
  });

  // Use the approval result from the enhanced manager if available, otherwise use interrupt result
  if (approvalResult) {
    // Use the result from enhanced approval manager (set by command handlers)
    approvalResult = approvalResult;
  } else {
    // Fall back to interrupt result (direct LangGraph response)
    approvalResult = interruptResult;
  }

  // Handle the approval result
  if (approvalResult?.approved) {
    logger.info('Plan approved by user', {
      userId: state.userId,
      planId: state.executionPlan.id,
      feedback: approvalResult.feedback,
    });

    const updatedRequest = {
      ...approvalRequest,
      approved: true,
      feedback: approvalResult.feedback,
    };

    return new Command({
      goto: 'execute_steps',
      update: {
        approvalRequests: [...(state.approvalRequests || []), updatedRequest],
        awaitingApproval: false,
      },
    });
  } else if (approvalResult?.approved === false) {
    logger.info('Plan denied by user', {
      userId: state.userId,
      planId: state.executionPlan.id,
      feedback: approvalResult.feedback,
    });

    const updatedRequest = {
      ...approvalRequest,
      approved: false,
      feedback: approvalResult.feedback,
    };

    // Send denial message to user
    sendDenialMessage(state, approvalResult.feedback);

    return new Command({
      goto: 'reflect',
      update: {
        approvalRequests: [...(state.approvalRequests || []), updatedRequest],
        awaitingApproval: false,
        finalResult: 'Plan execution denied by user',
        finalResponse: `❌ Plan execution cancelled.\n\n${approvalResult.feedback ? `Reason: ${approvalResult.feedback}` : ''}`,
      },
    });
  } else {
    // Still waiting for approval - this shouldn't happen with proper interrupt handling
    logger.warn('Approval result undefined, staying in approval state', {
      userId: state.userId,
      planId: state.executionPlan.id,
    });

    return {
      approvalRequests: [...(state.approvalRequests || []), approvalRequest],
      awaitingApproval: true,
    };
  }
}

/**
 * Creates a user-friendly approval message
 */
function createApprovalMessage(state: EnhancedWorkflowStateType): string {
  if (!state.executionPlan) return 'Approve plan execution?';

  const plan = state.executionPlan;
  const riskEmoji = getRiskEmoji(plan.riskLevel);
  const stepList = plan.steps
    .map((step, index) => `${index + 1}. ${step.description}`)
    .join('\n');

  return `${riskEmoji} **Plan Approval Required**

**Request:** ${plan.userIntent}
**Risk Level:** ${plan.riskLevel.toUpperCase()}
**Estimated Duration:** ${plan.estimatedDuration}
**Steps:** ${plan.steps.length}

**Execution Plan:**
${stepList}

Use /approve to proceed or /deny to cancel.`;
}

/**
 * Sends approval request to user via Telegram
 */
function sendApprovalToUser(
  state: EnhancedWorkflowStateType,
  request: ApprovalRequest,
): void {
  if (!state.telegramContextKey) {
    logger.error('No telegram context key for approval message', {
      userId: state.userId,
    });
    return;
  }

  const context = telegramContextManager.get(state.telegramContextKey);
  if (!context) {
    logger.error('Telegram context not found for approval', {
      userId: state.userId,
      contextKey: state.telegramContextKey,
    });
    return;
  }

  // Send the approval message asynchronously
  context
    .reply(request.message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Approve', callback_data: `approve:${request.id}` },
            { text: '❌ Deny', callback_data: `deny:${request.id}` },
          ],
        ],
      },
    })
    .catch((error) => {
      logger.error('Failed to send approval message', {
        error,
        userId: state.userId,
        approvalId: request.id,
      });
    });
}

/**
 * Sends denial confirmation message to user
 */
function sendDenialMessage(
  state: EnhancedWorkflowStateType,
  feedback?: string,
): void {
  if (!state.telegramContextKey) return;

  const context = telegramContextManager.get(state.telegramContextKey);
  if (!context) return;

  const message = `❌ **Plan Cancelled**

The execution plan has been cancelled as requested.${feedback ? `\n\nReason: ${feedback}` : ''}

You can send a new request anytime.`;

  context.reply(message, { parse_mode: 'Markdown' }).catch((error) => {
    logger.error('Failed to send denial message', {
      error,
      userId: state.userId,
    });
  });
}

/**
 * Gets emoji for risk level
 */
function getRiskEmoji(riskLevel: string): string {
  switch (riskLevel) {
    case 'high':
      return '🚨';
    case 'medium':
      return '⚠️';
    case 'low':
    default:
      return 'ℹ️';
  }
}

/**
 * Step-level approval handler for individual high-risk steps
 */
export function requestStepApproval(
  state: EnhancedWorkflowStateType,
): Command | Partial<EnhancedWorkflowStateType> {
  if (
    !state.executionPlan ||
    state.currentStepIndex >= state.executionPlan.steps.length
  ) {
    return new Command({ goto: 'reflect' });
  }

  const currentStep = state.executionPlan.steps[state.currentStepIndex];

  // Skip approval if step doesn't require it
  if (!currentStep.requiresApproval) {
    return new Command({ goto: 'execute_current_step' });
  }

  const approvalRequest: ApprovalRequest = {
    id: uuidv4(),
    stepId: currentStep.id,
    action: currentStep.action,
    parameters: currentStep.parameters,
    description: currentStep.description,
    riskLevel: currentStep.riskLevel,
    message: createStepApprovalMessage(
      currentStep,
      state.currentStepIndex + 1,
      state.executionPlan.steps.length,
    ),
    timestamp: Date.now(),
  };

  logger.info('Requesting step approval', {
    userId: state.userId,
    stepId: currentStep.id,
    stepIndex: state.currentStepIndex,
    riskLevel: currentStep.riskLevel,
  });

  // Send step approval request to user
  sendApprovalToUser(state, approvalRequest);

  // Register with enhanced approval manager and use LangGraph interrupt
  let approvalResult: { approved: boolean; feedback?: string } | undefined;
  
  enhancedApprovalManager.registerPendingApproval(
    state.userId,
    approvalRequest,
    (result) => {
      approvalResult = result;
    }
  );

  // Use interrupt for step approval
  const interruptResult = interrupt({
    question: `Approve step ${state.currentStepIndex + 1}?`,
    step: {
      description: currentStep.description,
      action: currentStep.action,
      parameters: currentStep.parameters,
      riskLevel: currentStep.riskLevel,
    },
    stepNumber: state.currentStepIndex + 1,
    totalSteps: state.executionPlan.steps.length,
    approvalId: approvalRequest.id,
  });

  // Use the approval result from the enhanced manager if available, otherwise use interrupt result
  if (approvalResult) {
    // Use the result from enhanced approval manager (set by command handlers)
    approvalResult = approvalResult;
  } else {
    // Fall back to interrupt result (direct LangGraph response)
    approvalResult = interruptResult;
  }

  if (approvalResult?.approved) {
    const updatedRequest = {
      ...approvalRequest,
      approved: true,
      feedback: approvalResult.feedback,
    };

    return new Command({
      goto: 'execute_current_step',
      update: {
        approvalRequests: [...(state.approvalRequests || []), updatedRequest],
      },
    });
  } else if (approvalResult?.approved === false) {
    const updatedRequest = {
      ...approvalRequest,
      approved: false,
      feedback: approvalResult.feedback,
    };

    return new Command({
      goto: 'reflect',
      update: {
        approvalRequests: [...(state.approvalRequests || []), updatedRequest],
        finalResult: 'Step execution denied by user',
        finalResponse: `❌ Step ${state.currentStepIndex + 1} cancelled: ${currentStep.description}`,
      },
    });
  }

  return {
    approvalRequests: [...(state.approvalRequests || []), approvalRequest],
    awaitingApproval: true,
  };
}

/**
 * Creates approval message for individual steps
 */
function createStepApprovalMessage(
  step: PlanStep,
  stepNumber: number,
  totalSteps: number,
): string {
  const riskEmoji = getRiskEmoji(step.riskLevel);

  return `${riskEmoji} **Step ${stepNumber}/${totalSteps} Approval**

**Action:** ${step.action}
**Description:** ${step.description}
**Risk Level:** ${step.riskLevel.toUpperCase()}

Use /approve to proceed or /deny to cancel this step.`;
}
