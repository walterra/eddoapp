import { logger } from '../utils/logger.js';
import type { ApprovalRequest } from './enhanced-workflow-state.js';

/**
 * Enhanced approval manager that interfaces with LangGraph interrupts
 * This bridges the gap between command handlers and the enhanced workflow system
 */
class EnhancedApprovalManager {
  private pendingApprovals: Map<string, ApprovalRequest[]> = new Map(); // userId -> requests
  private approvalCallbacks: Map<
    string,
    (result: { approved: boolean; feedback?: string }) => void
  > = new Map();

  /**
   * Register a pending approval request
   * Called by the enhanced workflow when it hits an interrupt
   */
  registerPendingApproval(
    userId: string,
    request: ApprovalRequest,
    callback: (result: { approved: boolean; feedback?: string }) => void,
  ): void {
    const userApprovals = this.pendingApprovals.get(userId) || [];
    userApprovals.push(request);
    this.pendingApprovals.set(userId, userApprovals);

    // Store callback for this specific request
    this.approvalCallbacks.set(request.id, callback);

    logger.info('Enhanced approval registered', {
      userId,
      requestId: request.id,
      stepId: request.stepId,
      pendingCount: userApprovals.length,
    });
  }

  /**
   * Get pending approval requests for a user
   */
  getPendingRequests(userId: string): ApprovalRequest[] {
    return this.pendingApprovals.get(userId) || [];
  }

  /**
   * Approve the most recent request for a user
   */
  approveRequest(userId: string, feedback?: string): ApprovalRequest | null {
    const pendingRequests = this.getPendingRequests(userId);

    if (pendingRequests.length === 0) {
      logger.warn('No pending approvals to approve', { userId });
      return null;
    }

    // Get the most recent request
    const request = pendingRequests[pendingRequests.length - 1];

    // Mark as approved
    request.approved = true;
    request.feedback = feedback;

    // Execute callback to resume workflow
    const callback = this.approvalCallbacks.get(request.id);
    if (callback) {
      callback({ approved: true, feedback });
      this.approvalCallbacks.delete(request.id);
    }

    // Remove from pending
    const updatedRequests = pendingRequests.filter(
      (req) => req.id !== request.id,
    );
    if (updatedRequests.length === 0) {
      this.pendingApprovals.delete(userId);
    } else {
      this.pendingApprovals.set(userId, updatedRequests);
    }

    logger.info('Enhanced approval approved', {
      userId,
      requestId: request.id,
      stepId: request.stepId,
      feedback,
    });

    return request;
  }

  /**
   * Deny the most recent request for a user
   */
  denyRequest(userId: string, feedback?: string): ApprovalRequest | null {
    const pendingRequests = this.getPendingRequests(userId);

    if (pendingRequests.length === 0) {
      logger.warn('No pending approvals to deny', { userId });
      return null;
    }

    // Get the most recent request
    const request = pendingRequests[pendingRequests.length - 1];

    // Mark as denied
    request.approved = false;
    request.feedback = feedback;

    // Execute callback to resume workflow
    const callback = this.approvalCallbacks.get(request.id);
    if (callback) {
      callback({ approved: false, feedback });
      this.approvalCallbacks.delete(request.id);
    }

    // Remove from pending
    const updatedRequests = pendingRequests.filter(
      (req) => req.id !== request.id,
    );
    if (updatedRequests.length === 0) {
      this.pendingApprovals.delete(userId);
    } else {
      this.pendingApprovals.set(userId, updatedRequests);
    }

    logger.info('Enhanced approval denied', {
      userId,
      requestId: request.id,
      stepId: request.stepId,
      feedback,
    });

    return request;
  }

  /**
   * Clean up expired approvals and callbacks
   */
  cleanup(timeoutMs: number = 300000): void {
    const now = Date.now();
    let cleanedCount = 0;

    // Clean expired approvals
    for (const [userId, requests] of this.pendingApprovals.entries()) {
      const validRequests = requests.filter((req) => {
        const isExpired = now - req.timestamp > timeoutMs;
        if (isExpired) {
          // Clean up callback
          this.approvalCallbacks.delete(req.id);
          cleanedCount++;
        }
        return !isExpired;
      });

      if (validRequests.length === 0) {
        this.pendingApprovals.delete(userId);
      } else if (validRequests.length !== requests.length) {
        this.pendingApprovals.set(userId, validRequests);
      }
    }

    if (cleanedCount > 0) {
      logger.info('Enhanced approval cleanup completed', {
        cleanedCount,
        remainingApprovals: Array.from(this.pendingApprovals.values()).flat()
          .length,
      });
    }
  }

  /**
   * Get status information
   */
  getStatus(): {
    totalPendingApprovals: number;
    usersPendingApproval: number;
    pendingCallbacks: number;
  } {
    const totalPendingApprovals = Array.from(
      this.pendingApprovals.values(),
    ).flat().length;

    return {
      totalPendingApprovals,
      usersPendingApproval: this.pendingApprovals.size,
      pendingCallbacks: this.approvalCallbacks.size,
    };
  }
}

// Singleton instance
export const enhancedApprovalManager = new EnhancedApprovalManager();

// Auto-cleanup every 5 minutes
setInterval(
  () => {
    enhancedApprovalManager.cleanup();
  },
  5 * 60 * 1000,
);
