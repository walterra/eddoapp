import { logger } from '../utils/logger.js';
import type { WorkflowState } from './types/workflow-types.js';

/**
 * Global workflow state manager for handling paused workflows
 */
class WorkflowStateManager {
  private pausedWorkflows: Map<string, WorkflowState> = new Map();
  private userWorkflows: Map<string, string> = new Map(); // userId -> workflowId

  /**
   * Store a paused workflow state
   */
  storePausedWorkflow(userId: string, state: WorkflowState): string {
    const workflowId = `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.pausedWorkflows.set(workflowId, state);
    this.userWorkflows.set(userId, workflowId);

    logger.info('Workflow paused and stored', {
      userId,
      workflowId,
      currentStep: state.currentStepIndex,
      totalSteps: state.executionPlan?.steps.length,
    });

    return workflowId;
  }

  /**
   * Get paused workflow for a user
   */
  getPausedWorkflow(userId: string): WorkflowState | null {
    const workflowId = this.userWorkflows.get(userId);
    if (!workflowId) {
      return null;
    }

    const workflow = this.pausedWorkflows.get(workflowId);
    return workflow || null;
  }

  /**
   * Resume and remove a paused workflow
   */
  resumeWorkflow(userId: string): WorkflowState | null {
    const workflowId = this.userWorkflows.get(userId);
    if (!workflowId) {
      return null;
    }

    const workflow = this.pausedWorkflows.get(workflowId);
    if (!workflow) {
      return null;
    }

    // Clean up stored state
    this.pausedWorkflows.delete(workflowId);
    this.userWorkflows.delete(userId);

    logger.info('Workflow resumed', {
      userId,
      workflowId,
      currentStep: workflow.currentStepIndex,
      totalSteps: workflow.executionPlan?.steps.length,
    });

    return workflow;
  }

  /**
   * Check if user has a paused workflow
   */
  hasPausedWorkflow(userId: string): boolean {
    const workflowId = this.userWorkflows.get(userId);
    return workflowId ? this.pausedWorkflows.has(workflowId) : false;
  }

  /**
   * Clear paused workflow for a user
   */
  clearPausedWorkflow(userId: string): void {
    const workflowId = this.userWorkflows.get(userId);
    if (workflowId) {
      this.pausedWorkflows.delete(workflowId);
      this.userWorkflows.delete(userId);

      logger.info('Paused workflow cleared', { userId, workflowId });
    }
  }

  /**
   * Clean up expired workflows (older than 1 hour)
   */
  cleanupExpired(): void {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    let cleanedCount = 0;

    for (const [workflowId, state] of this.pausedWorkflows) {
      const workflowTime = state.sessionContext.startTime || 0;
      if (workflowTime < oneHourAgo) {
        this.pausedWorkflows.delete(workflowId);

        // Find and remove user mapping
        for (const [userId, mappedWorkflowId] of this.userWorkflows) {
          if (mappedWorkflowId === workflowId) {
            this.userWorkflows.delete(userId);
            break;
          }
        }

        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info('Cleaned up expired workflows', { count: cleanedCount });
    }
  }
}

// Global instance
const workflowStateManager = new WorkflowStateManager();

// Auto-cleanup expired workflows every 30 minutes
setInterval(
  () => {
    workflowStateManager.cleanupExpired();
  },
  30 * 60 * 1000,
);

export { workflowStateManager };
