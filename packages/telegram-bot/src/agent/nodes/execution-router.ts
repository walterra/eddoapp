import { logger } from '../../utils/logger.js';
import type { RouteFunction, WorkflowState } from '../types/workflow-types.js';

/**
 * Routes execution based on task complexity analysis
 */
export const routeByComplexity: RouteFunction = (state: WorkflowState): string => {
  const analysis = state.complexityAnalysis;
  
  if (!analysis) {
    logger.warn('No complexity analysis found, routing to simple execution', {
      userId: state.userId
    });
    return 'execute_simple';
  }

  logger.info('Routing based on complexity analysis', {
    userId: state.userId,
    classification: analysis.classification,
    confidence: analysis.confidence,
    requiresApproval: analysis.requiresApproval
  });

  // Route based on complexity
  switch (analysis.classification) {
    case 'simple':
      return 'execute_simple';
    
    case 'compound':
      // Compound tasks go to planning but with simplified flow
      return 'generate_plan';
    
    case 'complex':
      // Complex tasks always need planning
      return 'generate_plan';
    
    default:
      logger.warn('Unknown complexity classification, defaulting to simple', {
        userId: state.userId,
        classification: analysis.classification
      });
      return 'execute_simple';
  }
};

/**
 * Routes execution steps based on current step status and results
 */
export const routeByExecutionStatus: RouteFunction = (state: WorkflowState): string => {
  const plan = state.executionPlan;
  const currentIndex = state.currentStepIndex;
  
  if (!plan) {
    logger.error('No execution plan found during step routing', {
      userId: state.userId
    });
    return 'generate_error_response';
  }

  // Check if we're done with all steps
  if (currentIndex >= plan.steps.length) {
    logger.info('All execution steps completed', {
      userId: state.userId,
      planId: plan.id,
      totalSteps: plan.steps.length
    });
    return 'generate_summary';
  }

  const currentStep = plan.steps[currentIndex];
  const stepResults = state.executionSteps;
  const lastResult = stepResults[stepResults.length - 1];

  // Check if current step failed
  if (lastResult && lastResult.status === 'failed') {
    logger.warn('Execution step failed, checking for retry or fallback', {
      userId: state.userId,
      stepId: lastResult.id,
      error: lastResult.error?.message
    });

    // For now, continue to next step (could implement retry logic here)
    return 'execute_next_step';
  }

  // Check if current step requires approval
  if (currentStep.requiresApproval && !state.awaitingApproval) {
    logger.info('Step requires user approval', {
      userId: state.userId,
      stepId: currentStep.id,
      description: currentStep.description
    });
    return 'request_approval';
  }

  // Check if we're waiting for approval
  if (state.awaitingApproval) {
    const lastApproval = state.approvalRequests[state.approvalRequests.length - 1];
    
    if (!lastApproval) {
      logger.error('Awaiting approval but no approval request found', {
        userId: state.userId
      });
      return 'generate_error_response';
    }

    if (lastApproval.approved === undefined) {
      // Still waiting for user response
      logger.info('Still awaiting user approval', {
        userId: state.userId,
        approvalId: lastApproval.id
      });
      return 'wait_for_approval';
    }

    if (!lastApproval.approved) {
      logger.info('User rejected approval, aborting execution', {
        userId: state.userId,
        approvalId: lastApproval.id
      });
      return 'handle_rejection';
    }

    // Approval granted, continue execution
    logger.info('User approved, continuing execution', {
      userId: state.userId,
      approvalId: lastApproval.id
    });
  }

  // Normal execution flow - execute next step
  return 'execute_next_step';
};

/**
 * Routes based on approval status
 */
export const routeByApproval: RouteFunction = (state: WorkflowState): string => {
  const lastApproval = state.approvalRequests[state.approvalRequests.length - 1];
  
  if (!lastApproval) {
    logger.error('No approval request found when routing by approval', {
      userId: state.userId
    });
    return 'generate_error_response';
  }

  if (lastApproval.approved === undefined) {
    logger.info('Still waiting for approval response', {
      userId: state.userId,
      approvalId: lastApproval.id
    });
    return 'wait_for_approval';
  }

  if (lastApproval.approved) {
    logger.info('Approval granted, continuing execution', {
      userId: state.userId,
      approvalId: lastApproval.id
    });
    return 'execute_next_step';
  } else {
    logger.info('Approval denied, handling rejection', {
      userId: state.userId,
      approvalId: lastApproval.id
    });
    return 'handle_rejection';
  }
};

/**
 * Routes based on error conditions
 */
export const routeByError: RouteFunction = (state: WorkflowState): string => {
  if (state.error) {
    logger.error('Error detected in workflow state', {
      userId: state.userId,
      error: state.error.message
    });
    return 'generate_error_response';
  }

  if (state.shouldExit) {
    logger.info('Exit flag set, ending workflow', {
      userId: state.userId
    });
    return 'generate_summary';
  }

  // No error, continue normal flow
  return 'continue_execution';
};

/**
 * Determines if workflow should continue or exit
 */
export const shouldContinueExecution = (state: WorkflowState): boolean => {
  // Exit conditions
  if (state.shouldExit) return false;
  if (state.error) return false;
  
  // If we have a plan, check if all steps are complete
  if (state.executionPlan) {
    const completedSteps = state.executionSteps.filter((step) => 
      step.status === 'completed'
    ).length;
    
    return completedSteps < state.executionPlan.steps.length;
  }

  // If no plan, we can continue (might be simple execution)
  return true;
};
