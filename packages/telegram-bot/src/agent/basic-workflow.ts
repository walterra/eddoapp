import { HumanMessage } from '@langchain/core/messages';

import type { BotContext } from '../bot/bot.js';
import { logger } from '../utils/logger.js';
import { analyzeTaskComplexity } from './nodes/complexity-analyzer.js';
import { executeSimpleTask } from './nodes/simple-executor.js';
import type { TaskComplexityAnalysis } from './types/workflow-types.js';

/**
 * Basic workflow implementation without LangGraph dependencies
 * This demonstrates the agent workflow concept while we resolve LangGraph compatibility
 */

interface BasicWorkflowState {
  userMessage: string;
  userId: string;
  telegramContext: BotContext;
  complexityAnalysis?: TaskComplexityAnalysis;
  finalResponse?: string;
  error?: Error;
  sessionContext: Record<string, unknown>;
}

/**
 * Basic workflow that demonstrates the agent pattern
 */
export class BasicWorkflow {
  constructor() {
    logger.info('BasicWorkflow initialized');
  }

  /**
   * Execute the workflow manually (without LangGraph)
   */
  async execute(
    userMessage: string,
    userId: string,
    telegramContext: BotContext,
  ): Promise<{ success: boolean; finalResponse?: string; error?: Error }> {
    const startTime = Date.now();

    logger.info('Starting basic workflow execution', {
      userId,
      messageLength: userMessage.length,
    });

    try {
      // Step 1: Initialize state
      const state: BasicWorkflowState = {
        userMessage,
        userId,
        telegramContext,
        sessionContext: {
          startTime,
          todoCount: 0,
          commonContexts: ['work', 'personal', 'shopping', 'health'],
        },
      };

      // Step 2: Analyze task complexity
      logger.info('Step 1: Analyzing task complexity', { userId });
      const analysisResult = await this.runAnalysisStep(state);

      if (analysisResult.error) {
        throw analysisResult.error;
      }

      state.complexityAnalysis = analysisResult.complexityAnalysis;
      state.sessionContext = {
        ...state.sessionContext,
        ...analysisResult.sessionContext,
      };

      // Step 3: Route based on complexity
      logger.info('Step 2: Routing based on complexity', {
        userId,
        classification: state.complexityAnalysis?.classification,
      });

      if (state.complexityAnalysis?.classification === 'simple') {
        // Execute simple task
        logger.info('Step 3: Executing simple task', { userId });
        const executionResult = await this.runSimpleExecutionStep(state);

        if (executionResult.error) {
          throw executionResult.error;
        }

        state.finalResponse = executionResult.finalResponse;
      } else {
        // Handle complex tasks (placeholder for Phase 2)
        logger.info('Step 3: Complex task detected - placeholder response', {
          userId,
          classification: state.complexityAnalysis?.classification,
        });

        await telegramContext.reply(
          `🚧 **Complex Task Detected**\n\nI've analyzed your request and classified it as "${state.complexityAnalysis?.classification || 'complex'}".\n\n` +
            `**Analysis:** ${state.complexityAnalysis?.reasoning || 'Requires multi-step planning'}\n\n` +
            `Complex task execution is coming in Phase 2! For now, please try breaking your request into simpler steps.`,
          { parse_mode: 'Markdown' },
        );

        state.finalResponse = 'Complex task execution not yet implemented';
      }

      const duration = Date.now() - startTime;

      logger.info('Basic workflow completed successfully', {
        userId,
        duration,
        classification: state.complexityAnalysis?.classification,
        hasResponse: !!state.finalResponse,
      });

      return {
        success: true,
        finalResponse: state.finalResponse || 'Workflow completed successfully',
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('Basic workflow failed', {
        error: error instanceof Error ? error.message : String(error),
        userId,
        duration,
      });

      // Send error message to user
      try {
        await telegramContext.reply(
          '❌ Sorry, I encountered an error processing your request. Please try again.',
        );
      } catch (replyError) {
        logger.error('Failed to send error message to user', { replyError });
      }

      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Run the complexity analysis step
   */
  private async runAnalysisStep(state: BasicWorkflowState): Promise<{
    complexityAnalysis?: TaskComplexityAnalysis;
    sessionContext?: Record<string, unknown>;
    error?: Error;
  }> {
    try {
      // Create WorkflowState for the analyzer
      const workflowState = {
        userMessage: state.userMessage,
        userId: state.userId,
        telegramContext: state.telegramContext,
        sessionContext: state.sessionContext,
        messages: [new HumanMessage(state.userMessage)],
        currentStepIndex: 0,
        executionSteps: [],
        mcpResponses: [],
        approvalRequests: [],
        awaitingApproval: false,
        shouldExit: false,
      };

      const result = await analyzeTaskComplexity(workflowState);

      return {
        complexityAnalysis: result.complexityAnalysis,
        sessionContext: result.sessionContext,
      };
    } catch (error) {
      logger.error('Analysis step failed', { error, userId: state.userId });
      return {
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Run the simple execution step
   */
  private async runSimpleExecutionStep(state: BasicWorkflowState): Promise<{
    finalResponse?: string;
    error?: Error;
  }> {
    try {
      // Create WorkflowState for the executor
      const workflowState = {
        userMessage: state.userMessage,
        userId: state.userId,
        telegramContext: state.telegramContext,
        sessionContext: state.sessionContext,
        messages: [new HumanMessage(state.userMessage)],
        currentStepIndex: 0,
        executionSteps: [],
        mcpResponses: [],
        approvalRequests: [],
        awaitingApproval: false,
        shouldExit: false,
        complexityAnalysis: state.complexityAnalysis,
      };

      const result = await executeSimpleTask(workflowState);

      return {
        finalResponse: result.finalResponse,
      };
    } catch (error) {
      logger.error('Simple execution step failed', {
        error,
        userId: state.userId,
      });
      return {
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }
}
