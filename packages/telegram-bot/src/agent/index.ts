import type { BotContext } from '../bot/bot.js';
import { logger } from '../utils/logger.js';
import { BasicWorkflow } from './basic-workflow.js';
import { SimpleLangGraphWorkflow } from './simple-langgraph-workflow.js';
import type { WorkflowConfig, WorkflowResult } from './types/workflow-types.js';

/**
 * Main agent orchestrator - single entry point for all agent workflows
 */
export class EddoAgent {
  private workflow: SimpleLangGraphWorkflow | BasicWorkflow;
  private config: WorkflowConfig;
  private useLangGraph: boolean;

  constructor(config: Partial<WorkflowConfig> = {}) {
    this.config = {
      enableStreaming: true,
      enableApprovals: true,
      maxExecutionTime: 300000, // 5 minutes
      maxRetries: 3,
      checkpointInterval: 5000,
      ...config,
    };

    // Use LangGraph by default, fall back to BasicWorkflow if there are issues
    this.useLangGraph = process.env.USE_LANGGRAPH !== 'false';

    try {
      this.workflow = this.useLangGraph
        ? new SimpleLangGraphWorkflow()
        : new BasicWorkflow();

      logger.info('EddoAgent initialized', {
        version: '1.0.0',
        workflowType: this.useLangGraph ? 'SimpleLangGraph' : 'Basic',
        config: this.config,
      });
    } catch (error) {
      logger.warn(
        'Failed to initialize SimpleLangGraph workflow, falling back to BasicWorkflow',
        { error },
      );
      this.workflow = new BasicWorkflow();
      this.useLangGraph = false;
    }
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
  } {
    return {
      version: '1.0.0',
      workflowType: this.useLangGraph ? 'SimpleLangGraph' : 'Basic',
      config: this.config,
      uptime: process.uptime(),
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
