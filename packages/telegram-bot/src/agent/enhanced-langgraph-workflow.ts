import type { Tool } from '@langchain/core/tools';
import { END, MemorySaver, START, StateGraph } from '@langchain/langgraph';
import { v4 as uuidv4 } from 'uuid';

import type { BotContext } from '../bot/bot.js';
import { getEnhancedMCPAdapter } from '../mcp/adapter.js';
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
      .addNode('analyze_intent', this.analyzeIntentNode.bind(this))
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
   * Intent analysis node wrapper that passes MCP client
   */
  private async analyzeIntentNode(
    state: EnhancedWorkflowStateType,
  ): Promise<Partial<EnhancedWorkflowStateType>> {
    // Get the MCPClient adapter (compatible with the analyzeIntent function)
    const mcpClient = getEnhancedMCPAdapter();
    return analyzeIntent(state, mcpClient);
  }

  /**
   * Enhanced step execution with MCP integration
   */
  private async executeStepNode(
    state: EnhancedWorkflowStateType,
  ): Promise<Partial<EnhancedWorkflowStateType>> {
    if (!this.enhancedMCPSetup) {
      logger.warn('Enhanced MCP not available, cannot execute steps');
      return {
        error: new Error('Enhanced MCP integration not available'),
        finalResponse: 'Unable to execute steps - MCP integration unavailable',
      };
    }

    if (
      !state.executionPlan ||
      state.currentStepIndex >= state.executionPlan.steps.length
    ) {
      logger.info('No more steps to execute', {
        userId: state.userId,
        currentIndex: state.currentStepIndex,
        totalSteps: state.executionPlan?.steps.length || 0,
      });
      return {
        finalResult: 'All steps completed',
      };
    }

    // Get the telegram context
    const telegramContext = telegramContextManager.get(
      state.telegramContextKey,
    );
    if (!telegramContext) {
      logger.error('Telegram context not found', {
        userId: state.userId,
        contextKey: state.telegramContextKey,
      });
      return {
        error: new Error('Telegram context not available'),
        finalResponse: 'Unable to execute steps - Telegram context unavailable',
      };
    }

    const currentStep = state.executionPlan.steps[state.currentStepIndex];

    logger.info('Executing step with enhanced MCP integration', {
      userId: state.userId,
      stepId: currentStep.id,
      stepIndex: state.currentStepIndex,
      action: currentStep.action,
      availableTools: this.enhancedMCPSetup.tools.length,
      toolNames: this.enhancedMCPSetup.tools.map((t) => t.name),
    });

    try {
      // Find the appropriate MCP tool for this action
      const tool = this.findToolForAction(
        this.enhancedMCPSetup.tools,
        currentStep.action,
      );

      if (!tool) {
        throw new Error(`Tool not found for action: ${currentStep.action}`);
      }

      logger.info('Found MCP tool for step', {
        stepId: currentStep.id,
        toolName: tool.name,
        userId: state.userId,
      });

      // Execute the tool with the step parameters
      const result = await tool.invoke(currentStep.parameters);

      // Validate tool execution result
      if (!result || (typeof result === 'string' && result.includes('error'))) {
        throw new Error(`Tool execution failed: ${result}`);
      }

      // Update step with results
      const executedStep = {
        ...currentStep,
        status: 'completed' as const,
        result,
        timestamp: Date.now(),
        duration: 0, // Will be calculated when step completes
      };

      logger.info('Tool executed successfully', {
        stepId: currentStep.id,
        toolName: tool.name,
        resultType: typeof result,
        userId: state.userId,
      });

      // Send progress update to user
      await telegramContext.reply(
        `✅ **Step ${state.currentStepIndex + 1}/${state.executionPlan.steps.length} Completed**\n${currentStep.description}`,
        {
          parse_mode: 'Markdown',
        },
      );

      return {
        executionSteps: [...state.executionSteps, executedStep],
        currentStepIndex: state.currentStepIndex + 1,
        mcpResponses: [...state.mcpResponses, result],
        toolResults: {
          ...state.toolResults,
          [currentStep.id]: {
            content: result,
            metadata: {
              toolName: tool.name,
              timestamp: Date.now(),
            },
          },
        },
      };
    } catch (error) {
      logger.error('Step execution failed', {
        error,
        userId: state.userId,
        stepId: currentStep.id,
        action: currentStep.action,
      });

      const failedStep = {
        ...currentStep,
        status: 'failed' as const,
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: Date.now(),
      };

      // Send error message to user
      await telegramContext.reply(
        `❌ **Step ${state.currentStepIndex + 1}/${state.executionPlan.steps.length} Failed**\n${currentStep.description}\n⚠️ ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          parse_mode: 'Markdown',
        },
      );

      return {
        executionSteps: [...state.executionSteps, failedStep],
        currentStepIndex: state.currentStepIndex + 1,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Find appropriate MCP tool for a given action
   */
  private findToolForAction(tools: Tool[], action: string): Tool | null {
    if (!tools || tools.length === 0) {
      logger.error('No tools available for action', { action, toolCount: 0 });
      return null;
    }

    logger.debug('Finding tool for action', {
      action,
      availableTools: tools.map((t) => t.name),
    });

    // Action-based mapping for common operations - with exact tool name matching
    const actionMapping: Record<string, string[]> = {
      // Core CRUD operations
      listTodos: ['listTodos'],
      createTodo: ['createTodo'],
      updateTodo: ['updateTodo'],
      deleteTodo: ['deleteTodo'],
      toggleTodoCompletion: ['toggleTodoCompletion'],

      // Time tracking
      startTimeTracking: ['startTimeTracking'],
      stopTimeTracking: ['stopTimeTracking'],
      getActiveTimeTracking: ['getActiveTimeTracking'],

      // Legacy action names for backward compatibility
      list_todos: ['listTodos'],
      create_todo: ['createTodo'],
      update_todo: ['updateTodo'],
      delete_todo: ['deleteTodo'],
      toggle_completion: ['toggleTodoCompletion'],
      start_time_tracking: ['startTimeTracking'],
      stop_time_tracking: ['stopTimeTracking'],
      get_active_timers: ['getActiveTimeTracking'],

      // Analysis and reporting actions
      daily_summary: ['listTodos'],
      analysis: ['listTodos'],

      // Handle artificial actions by mapping them to real actions
      execute_simple_task: ['listTodos'],
      execute_fallback_task: ['listTodos'],
    };

    const possibleNames = actionMapping[action] || [action];

    // First, try exact name matches with the tool base name
    for (const name of possibleNames) {
      const tool = tools.find((t) => {
        // Check if tool name ends with the expected name (handles prefixing)
        const toolBaseName =
          t.name.split('__').pop() || t.name.split('_').pop() || t.name;
        return toolBaseName === name || t.name === name;
      });

      if (tool) {
        logger.debug('Found exact tool match', {
          action,
          toolName: tool.name,
          searchName: name,
        });
        return tool;
      }
    }

    // Fallback: fuzzy matching
    for (const name of possibleNames) {
      const tool = tools.find(
        (t) =>
          t.name.toLowerCase().includes(name.toLowerCase()) ||
          t.description?.toLowerCase().includes(name.toLowerCase()),
      );

      if (tool) {
        logger.debug('Found fuzzy tool match', {
          action,
          toolName: tool.name,
          searchName: name,
        });
        return tool;
      }
    }

    logger.error('No tool found for action', {
      action,
      possibleNames,
      availableTools: tools.map((t) => t.name),
    });
    return null;
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
