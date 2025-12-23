import type { BotContext } from '../../bot/bot.js';

/**
 * Workflow execution result
 */
export interface WorkflowResult {
  success: boolean;
  error?: Error;
  finalState: {
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    userMessage: string;
    userId: string;
    currentStepIndex: number;
    executionSteps: unknown[];
    mcpResponses: unknown[];
    approvalRequests: unknown[];
    awaitingApproval: boolean;
    shouldExit: boolean;
    finalResponse?: string;
    error?: Error;
    sessionContext: {
      startTime?: number;
    };
    telegramContext: BotContext;
  };
}

/**
 * Workflow configuration options
 */
export interface WorkflowConfig {
  enableStreaming: boolean;
  enableApprovals: boolean;
  maxExecutionTime: number;
  maxRetries: number;
  checkpointInterval: number;
}
