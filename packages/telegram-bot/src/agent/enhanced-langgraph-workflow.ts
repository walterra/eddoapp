import { END, MemorySaver, START, StateGraph } from '@langchain/langgraph';
import { v4 as uuidv4 } from 'uuid';

import type { BotContext } from '../bot/bot.js';
import { setupEnhancedMCPIntegration } from '../mcp/enhanced-client.js';
import { logger } from '../utils/logger.js';
import {
  EnhancedWorkflowState,
  type EnhancedWorkflowStateType,
  telegramContextManager,
} from './enhanced-workflow-state.js';
import {
  requestApproval,
  requestStepApproval,
} from './nodes/enhanced-approval-handler.js';
import { analyzeIntent } from './nodes/enhanced-intent-analyzer.js';
import { generatePlan } from './nodes/enhanced-plan-generator.js';
import { reflectOnExecution } from './nodes/enhanced-reflection.js';

/**
 * Enhanced LangGraph Workflow implementing Intent → Plan → Execute → Reflect pattern
 * Following the examples from LANGGRAPH-IMPLEMENTATION-EXAMPLES.md
 */
export class EnhancedLangGraphWorkflow {
  private app: unknown; // Use unknown to bypass strict typing issues
  private enhancedMCPSetup: Awaited<
    ReturnType<typeof setupEnhancedMCPIntegration>
  > | null = null;

  constructor() {
    this.initializeWorkflow();
    this.initializeEnhancedMCP();
  }

  /**
   * Initializes the LangGraph workflow with proper state management and routing
   */
  private initializeWorkflow(): void {
    logger.info('Initializing Enhanced LangGraph Workflow');

    // Create the state graph using the enhanced annotation system
    const workflow = new StateGraph(EnhancedWorkflowState);

    // Add all workflow nodes and edges using method chaining (recommended approach)
    workflow
      .addNode('analyze_intent', analyzeIntent)
      .addNode('generate_plan', generatePlan)
      .addNode('request_approval', requestApproval)
      .addNode('execute_step', this.executeStepNode.bind(this))
      .addNode('request_step_approval', requestStepApproval)
      .addNode('reflect', reflectOnExecution)
      .addEdge(START, 'analyze_intent')
      .addEdge('analyze_intent', 'generate_plan')
      .addEdge('generate_plan', 'request_approval')
      .addConditionalEdges(
        'request_approval',
        this.routeAfterApproval.bind(this),
      )
      .addConditionalEdges('execute_step', this.routeAfterExecution.bind(this))
      .addConditionalEdges(
        'request_step_approval',
        this.routeAfterStepApproval.bind(this),
      )
      .addEdge('reflect', END);

    // Compile with memory for persistence
    const memory = new MemorySaver();
    this.app = workflow.compile({ checkpointer: memory }) as unknown;

    logger.info('Enhanced LangGraph Workflow initialized successfully');
  }

  /**
   * Initializes enhanced MCP integration
   */
  private async initializeEnhancedMCP(): Promise<void> {
    try {
      logger.info('Initializing enhanced MCP integration');
      this.enhancedMCPSetup = await setupEnhancedMCPIntegration();
      logger.info('Enhanced MCP integration initialized', {
        toolCount: this.enhancedMCPSetup?.tools.length || 0,
      });
    } catch (error) {
      logger.error('Failed to initialize enhanced MCP integration', { error });
      this.enhancedMCPSetup = null;
    }
  }

  /**
   * Executes the enhanced workflow for a user message
   */
  async execute(
    userMessage: string,
    userId: string,
    telegramContext: BotContext,
  ): Promise<{ success: boolean; finalResponse?: string; error?: Error }> {
    const startTime = Date.now();
    const contextKey = `${userId}-${startTime}-${uuidv4()}`;

    logger.info('Starting Enhanced LangGraph workflow execution', {
      userId,
      messageLength: userMessage.length,
      contextKey,
    });

    try {
      // Store telegram context for later retrieval
      telegramContextManager.store(contextKey, telegramContext);

      // Create initial state
      const initialState: Partial<EnhancedWorkflowStateType> = {
        userIntent: userMessage,
        userId,
        telegramContextKey: contextKey,
        sessionStartTime: startTime,
        sessionContext: {
          messageLength: userMessage.length,
          startTime,
        },
      };

      // Execute workflow with thread management
      const config = {
        configurable: {
          thread_id: `enhanced-${userId}-${Date.now()}`,
        },
      };

      const result = await (
        this.app as {
          invoke: (
            state: unknown,
            config: unknown,
          ) => Promise<EnhancedWorkflowStateType>;
        }
      ).invoke(initialState, config);

      // Clean up context
      telegramContextManager.remove(contextKey);

      const duration = Date.now() - startTime;

      logger.info('Enhanced LangGraph workflow completed successfully', {
        userId,
        duration,
        hasReflection: !!(result as EnhancedWorkflowStateType).reflectionResult,
        success: (result as EnhancedWorkflowStateType).reflectionResult
          ?.success,
      });

      return {
        success: true,
        finalResponse:
          (result as EnhancedWorkflowStateType).finalResponse ||
          'Workflow completed successfully',
      };
    } catch (error) {
      // Clean up context on error
      telegramContextManager.remove(contextKey);

      const duration = Date.now() - startTime;

      logger.error('Enhanced LangGraph workflow failed', {
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
   * Enhanced step execution with MCP integration
   */
  private async executeStepNode(
    _state: EnhancedWorkflowStateType,
  ): Promise<Partial<EnhancedWorkflowStateType>> {
    if (!this.enhancedMCPSetup) {
      logger.warn('Enhanced MCP not available, cannot execute steps');
      return {
        error: new Error('Enhanced MCP integration not available'),
        finalResponse: 'Unable to execute steps - MCP integration unavailable',
      };
    }

    // TODO: Integrate with the enhanced step executor
    // For now, return a placeholder
    return {
      finalResult: 'Step execution completed (placeholder)',
    };
  }

  /**
   * Routes workflow after plan approval
   */
  private routeAfterApproval(state: EnhancedWorkflowStateType): string {
    // Check if plan was denied
    const lastApproval =
      state.approvalRequests?.[state.approvalRequests.length - 1];
    if (lastApproval?.approved === false) {
      logger.info('Plan denied, routing to reflection', {
        userId: state.userId,
        approvalId: lastApproval.id,
      });
      return 'reflect';
    }

    // Plan approved or no approval needed, start execution
    logger.info('Plan approved, starting execution', {
      userId: state.userId,
      stepCount: state.executionPlan?.steps.length || 0,
    });
    return 'execute_step';
  }

  /**
   * Routes workflow after step execution
   */
  private routeAfterExecution(state: EnhancedWorkflowStateType): string {
    // Check if workflow should exit due to error
    if (state.error) {
      logger.info('Error detected, routing to reflection', {
        userId: state.userId,
        error: state.error.message,
      });
      return 'reflect';
    }

    // Check if there are more steps to execute
    if (
      state.executionPlan &&
      state.currentStepIndex < state.executionPlan.steps.length
    ) {
      const nextStep = state.executionPlan.steps[state.currentStepIndex];

      // Check if next step requires approval
      if (nextStep?.requiresApproval) {
        logger.info('Next step requires approval', {
          userId: state.userId,
          stepId: nextStep.id,
          stepIndex: state.currentStepIndex,
        });
        return 'request_step_approval';
      }

      // Continue with next step
      logger.info('Continuing to next step', {
        userId: state.userId,
        stepIndex: state.currentStepIndex,
        totalSteps: state.executionPlan.steps.length,
      });
      return 'execute_step';
    }

    // All steps completed, proceed to reflection
    logger.info('All steps completed, routing to reflection', {
      userId: state.userId,
      executedSteps: state.executionSteps.length,
    });
    return 'reflect';
  }

  /**
   * Routes workflow after step approval
   */
  private routeAfterStepApproval(state: EnhancedWorkflowStateType): string {
    const lastApproval =
      state.approvalRequests?.[state.approvalRequests.length - 1];

    if (lastApproval?.approved === false) {
      logger.info('Step denied, routing to reflection', {
        userId: state.userId,
        stepId: lastApproval.stepId,
      });
      return 'reflect';
    }

    // Step approved, continue execution
    logger.info('Step approved, continuing execution', {
      userId: state.userId,
      stepId: lastApproval?.stepId,
    });
    return 'execute_step';
  }

  /**
   * Gets workflow status and statistics
   */
  getStatus(): {
    version: string;
    mcpToolsAvailable: number;
    contextManagerStats: { activeContexts: number; timers: number };
  } {
    return {
      version: '2.0.0-enhanced',
      mcpToolsAvailable: this.enhancedMCPSetup?.tools.length || 0,
      contextManagerStats: telegramContextManager.getStats(),
    };
  }
}
