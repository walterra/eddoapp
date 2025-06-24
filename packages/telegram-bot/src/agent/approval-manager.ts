import { logger } from '../utils/logger.js';
import type { ApprovalRequest } from './types/workflow-types.js';

/**
 * Global approval manager for handling user approval requests
 */
class ApprovalManager {
  private pendingRequests: Map<string, ApprovalRequest> = new Map();
  private userRequests: Map<string, string[]> = new Map(); // userId -> requestIds

  /**
   * Add a pending approval request
   */
  addRequest(userId: string, request: ApprovalRequest): void {
    this.pendingRequests.set(request.id, request);

    // Track by user
    const userRequestIds = this.userRequests.get(userId) || [];
    userRequestIds.push(request.id);
    this.userRequests.set(userId, userRequestIds);

    logger.info('Approval request added', {
      userId,
      requestId: request.id,
      stepId: request.stepId,
    });
  }

  /**
   * Get pending approval requests for a user
   */
  getPendingRequests(userId: string): ApprovalRequest[] {
    const requestIds = this.userRequests.get(userId) || [];
    return requestIds
      .map((id) => this.pendingRequests.get(id))
      .filter(
        (req): req is ApprovalRequest =>
          req !== undefined && req.approved === undefined,
      );
  }

  /**
   * Get all approval requests for a user (including resolved ones)
   */
  getAllRequests(userId: string): ApprovalRequest[] {
    const requestIds = this.userRequests.get(userId) || [];
    return requestIds
      .map((id) => this.pendingRequests.get(id))
      .filter((req): req is ApprovalRequest => req !== undefined);
  }

  /**
   * Approve a request
   */
  approveRequest(userId: string, requestId?: string): ApprovalRequest | null {
    const pendingRequests = this.getPendingRequests(userId);

    if (pendingRequests.length === 0) {
      return null;
    }

    // If no specific request ID, approve the most recent one
    const request = requestId
      ? pendingRequests.find((r) => r.id === requestId)
      : pendingRequests[pendingRequests.length - 1];

    if (!request) {
      return null;
    }

    request.approved = true;
    request.response = 'User approved via command';

    logger.info('Approval request approved', {
      userId,
      requestId: request.id,
      stepId: request.stepId,
    });

    return request;
  }

  /**
   * Deny a request
   */
  denyRequest(userId: string, requestId?: string): ApprovalRequest | null {
    const pendingRequests = this.getPendingRequests(userId);

    if (pendingRequests.length === 0) {
      return null;
    }

    // If no specific request ID, deny the most recent one
    const request = requestId
      ? pendingRequests.find((r) => r.id === requestId)
      : pendingRequests[pendingRequests.length - 1];

    if (!request) {
      return null;
    }

    request.approved = false;
    request.response = 'User denied via command';

    logger.info('Approval request denied', {
      userId,
      requestId: request.id,
      stepId: request.stepId,
    });

    return request;
  }

  /**
   * Clean up expired requests
   */
  cleanupExpired(): void {
    const now = Date.now();
    let expiredCount = 0;

    for (const [requestId, request] of this.pendingRequests) {
      if (
        request.expiresAt &&
        now > request.expiresAt &&
        request.approved === undefined
      ) {
        request.approved = false;
        request.response = 'Auto-denied due to timeout';
        expiredCount++;

        logger.info('Approval request expired', {
          requestId,
          stepId: request.stepId,
        });
      }
    }

    if (expiredCount > 0) {
      logger.info('Cleaned up expired approval requests', {
        count: expiredCount,
      });
    }
  }
}

// Global instance
const approvalManager = new ApprovalManager();

// Auto-cleanup expired requests every minute
setInterval(() => {
  approvalManager.cleanupExpired();
}, 60000);

export { approvalManager };
