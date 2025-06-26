import type { BotContext } from '../bot/bot.js';
import { logger } from '../utils/logger.js';
import { SimpleAgent } from './simple-agent.js';
import type { WorkflowConfig, WorkflowResult } from './types/workflow-types.js';

/**
 * Main agent orchestrator - single entry point for all agent workflows
 */
export class EddoAgent {
  private workflow: SimpleAgent;
  private config: WorkflowConfig;

  constructor(config: Partial<WorkflowConfig> = {}) {
    this.config = {
      enableStreaming: true,
      enableApprovals: true,
      maxExecutionTime: 300000, // 5 minutes
      maxRetries: 3,
      checkpointInterval: 5000,
      ...config,
    };

    this.workflow = new SimpleAgent();
    logger.info('EddoAgent initialized with Simple Agent workflow', {
      version: '3.0.0',
      workflowType: 'SimpleAgent',
      config: this.config,
    });
  }

  /**
   * Processes a user message through the agent workflow
   */
  async processMessage(
    userMessage: string,
    userId: string,
    telegramContext: BotContext,
  ): Promise<WorkflowResult> {
    const startTime = Date.now();

    logger.info('Agent processing message', {
      userId,
      messageLength: userMessage.length,
    });

    try {
      const result = await this.workflow.execute(
        userMessage,
        userId,
        telegramContext,
      );

      const duration = Date.now() - startTime;
      logger.info('Agent processing completed', {
        userId,
        duration,
        success: result.success,
        hasError: !!result.error,
      });

      // Convert simple workflow result to WorkflowResult format
      return {
        success: result.success,
        error: result.error,
        finalState: {
          messages: [],
          userMessage,
          userId,
          currentStepIndex: 0,
          executionSteps: [],
          mcpResponses: [],
          approvalRequests: [],
          awaitingApproval: false,
          shouldExit: true,
          finalResponse: result.finalResponse,
          sessionContext: {
            startTime,
          },
          telegramContext,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('Agent processing failed', {
        error,
        userId,
        duration,
        userMessage: userMessage.substring(0, 100), // Log first 100 chars
      });

      // Return error result
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        finalState: {
          messages: [],
          userMessage,
          userId,
          currentStepIndex: 0,
          executionSteps: [],
          mcpResponses: [],
          approvalRequests: [],
          awaitingApproval: false,
          shouldExit: true,
          error: error instanceof Error ? error : new Error(String(error)),
          sessionContext: {
            startTime: Date.now(),
          },
          telegramContext,
        },
      };
    }
  }

  /**
   * Gets agent status and statistics
   */
  getStatus(): {
    version: string;
    workflowType: string;
    config: WorkflowConfig;
    uptime: number;
    simpleFeatures: Record<string, unknown>;
  } {
    return {
      version: '3.0.0',
      workflowType: 'SimpleAgent',
      config: this.config,
      uptime: process.uptime(),
      simpleFeatures: this.workflow.getStatus(),
    };
  }
}

// Singleton instance for the application
let agentInstance: EddoAgent | null = null;

/**
 * Gets the singleton agent instance
 */
export function getEddoAgent(config?: Partial<WorkflowConfig>): EddoAgent {
  if (!agentInstance) {
    agentInstance = new EddoAgent(config);
  }
  return agentInstance;
}

/**
 * Resets the agent instance (useful for testing)
 */
export function resetEddoAgent(): void {
  agentInstance = null;
}

// Export types for external use
export type { WorkflowResult, WorkflowConfig } from './types/workflow-types.js';
