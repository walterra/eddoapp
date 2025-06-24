import { AIMessage, HumanMessage } from '@langchain/core/messages';
import { RunnableLambda } from '@langchain/core/runnables';
import {
  END,
  MessagesAnnotation,
  START,
  StateGraph,
} from '@langchain/langgraph';

import type { BotContext } from '../bot/bot.js';
import {
  setupEnhancedMCPIntegration,
  useEnhancedMCP,
} from '../mcp/enhanced-client.js';
import { logger } from '../utils/logger.js';
import { planComplexTask } from './nodes/complex-planner.js';
import { analyzeTaskComplexity } from './nodes/complexity-analyzer.js';
import { executeStepWithAdapters } from './nodes/enhanced-step-executor.js';
import { generateExecutionSummary } from './nodes/execution-summarizer.js';
import { executeSimpleTask } from './nodes/simple-executor.js';
import { executeStep } from './nodes/step-executor.js';
import type {
  ExecutionSummary as _ExecutionSummary,
  TaskComplexityAnalysis as _TaskComplexityAnalysis,
} from './types/workflow-types.js';
import { workflowStateManager } from './workflow-state-manager.js';

/**
 * Simplified LangGraph workflow that works around TypeScript definition limitations
 */
export class SimpleLangGraphWorkflow {
  private app: unknown; // Use unknown to bypass strict typing issues
  private activeContexts: Map<string, BotContext> = new Map(); // Store active contexts
  private contextCleanupTimers: Map<string, NodeJS.Timeout> = new Map(); // Cleanup timers
  private enhancedMCPSetup: any = null; // Enhanced MCP setup for @langchain/mcp-adapters

  constructor() {
    // Create workflow using the patterns from LangGraph examples
    const workflow = new StateGraph(MessagesAnnotation);

    // Add the main agent node
    const agentFunction = async (
      state: typeof MessagesAnnotation.State & Record<string, unknown>,
    ) => {
      return await this.runAgentLogic(state);
    };

    workflow
      .addNode('agent', new RunnableLambda({ func: agentFunction }))
      .addEdge(START, 'agent')
      .addEdge('agent', END);

    this.app = workflow.compile();

    // Initialize enhanced MCP if feature flag is enabled
    if (useEnhancedMCP()) {
      this.initializeEnhancedMCP();
    }

    logger.info('SimpleLangGraphWorkflow initialized successfully');
  }

  /**
   * Execute the workflow
   */
  async execute(
    userMessage: string,
    userId: string,
    telegramContext: BotContext,
  ): Promise<{ success: boolean; finalResponse?: string; error?: Error }> {
    const startTime = Date.now();

    logger.info('Starting SimpleLangGraph workflow execution', {
      userId,
      messageLength: userMessage.length,
    });

    try {
      // Store the telegram context in our instance map for retrieval later
      const contextKey = `${userId}-${startTime}`;
      this.activeContexts.set(contextKey, telegramContext);

      // Set a cleanup timer to prevent memory leaks (5 minute timeout)
      const cleanupTimer = setTimeout(
        () => {
          this.activeContexts.delete(contextKey);
          this.contextCleanupTimers.delete(contextKey);
          logger.warn('Cleaned up expired telegram context', { contextKey });
        },
        5 * 60 * 1000,
      );
      this.contextCleanupTimers.set(contextKey, cleanupTimer);

      // Store context in the message metadata to ensure it's preserved by LangGraph
      const messageWithContext = new HumanMessage({
        content: userMessage,
        additional_kwargs: {
          userId,
          userMessage,
          contextKey, // Store the key to retrieve the context later
          sessionContext: {
            startTime,
            todoCount: 0,
            commonContexts: ['work', 'personal', 'shopping', 'health'],
          },
        },
      });

      const initialState = {
        messages: [messageWithContext],
      };

      const result = await (
        this.app as {
          invoke: (state: unknown) => Promise<Record<string, unknown>>;
        }
      ).invoke(initialState);

      // Clean up the stored context and timer
      this.activeContexts.delete(contextKey);
      const timer = this.contextCleanupTimers.get(contextKey);
      if (timer) {
        clearTimeout(timer);
        this.contextCleanupTimers.delete(contextKey);
      }

      const duration = Date.now() - startTime;

      logger.info('SimpleLangGraph workflow completed successfully', {
        userId,
        duration,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        classification: (result as any).complexityAnalysis?.classification,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        hasResponse: !!(result as any).finalResponse,
      });

      return {
        success: true,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        finalResponse:
          (result as any).finalResponse || 'Workflow completed successfully',
      };
    } catch (error) {
      // Clean up the stored context in error case too
      const contextKey = `${userId}-${startTime}`;
      this.activeContexts.delete(contextKey);
      const timer = this.contextCleanupTimers.get(contextKey);
      if (timer) {
        clearTimeout(timer);
        this.contextCleanupTimers.delete(contextKey);
      }

      const duration = Date.now() - startTime;

      logger.error('SimpleLangGraph workflow failed', {
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
   * Main agent logic that handles the entire workflow
   */
  private async runAgentLogic(
    state: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    // Extract data from state with proper type handling
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messages = (state.messages as any[]) || [];

    if (messages.length === 0) {
      throw new Error('No messages found in state');
    }

    const lastMessage = messages[messages.length - 1];
    const userMessage = lastMessage?.content || '';
    const messageMetadata = lastMessage?.additional_kwargs || {};

    const userId = messageMetadata.userId || 'unknown';
    const contextKey = messageMetadata.contextKey;

    if (!contextKey) {
      throw new Error('Context key is required');
    }

    // Retrieve the actual telegram context from our instance map
    const telegramContext = this.activeContexts.get(contextKey);

    if (!telegramContext) {
      throw new Error('Telegram context not found - may have expired');
    }

    logger.info('Running SimpleLangGraph agent logic', {
      userId,
      messageLength: userMessage.length,
    });

    try {
      // Check if this is a special resume message or if there's a paused workflow to resume
      const isResumeMessage = userMessage === '__RESUME_WORKFLOW__';
      const resumedWorkflow = workflowStateManager.getPausedWorkflow(userId);

      if (resumedWorkflow) {
        logger.info('Resuming paused workflow', {
          userId,
          isResumeMessage,
          currentStep: resumedWorkflow.currentStepIndex,
          totalSteps: resumedWorkflow.executionPlan?.steps.length,
        });

        // Update telegram context for the resumed workflow
        resumedWorkflow.telegramContext = telegramContext;

        // Continue from where we left off
        let currentState = resumedWorkflow;
        workflowStateManager.clearPausedWorkflow(userId); // Remove from storage

        // Continue execution loop
        while (!currentState.shouldExit && currentState.executionPlan) {
          // Use enhanced step executor if available and feature flag is enabled
          const stepResult =
            await this.executeStepWithEnhancedMCP(currentState);
          currentState = { ...currentState, ...stepResult };

          // Handle approval requests - check if user has responded
          if (currentState.awaitingApproval) {
            logger.info('Workflow waiting for user approval during resume', {
              userId,
              stepIndex: currentState.currentStepIndex,
              pendingRequests: currentState.approvalRequests.length,
            });

            // Check if user has responded via global approval manager
            const pendingApproval =
              currentState.approvalRequests[
                currentState.approvalRequests.length - 1
              ];
            const currentStep = currentState.executionPlan
              ? currentState.executionPlan.steps[currentState.currentStepIndex]
              : undefined;

            // Import and check approval manager for this user's responses
            const { approvalManager } = await import('./approval-manager.js');
            const globalRequests = approvalManager.getAllRequests(userId);
            const globalResponse = globalRequests.find(
              (req) =>
                req.stepId === currentStep?.id && req.approved !== undefined,
            );

            if (globalResponse) {
              // User has responded - update local state and continue
              pendingApproval.approved = globalResponse.approved;
              pendingApproval.response = globalResponse.response;
              currentState.awaitingApproval = false;

              logger.info(
                'User approval received during resume, continuing workflow',
                {
                  userId,
                  approved: globalResponse.approved,
                  stepId: currentStep?.id,
                },
              );

              if (!globalResponse.approved) {
                // User denied - exit workflow
                currentState.shouldExit = true;
                await telegramContext.reply(
                  `⏭️ STEP DENIED\n\nStep "${currentStep?.description}" was denied. Workflow stopped.`,
                );
              }
            } else {
              // Still waiting - store and pause again
              workflowStateManager.storePausedWorkflow(userId, currentState);
              return {
                ...state,
                awaitingApproval: true,
                finalResponse: 'Workflow resumed but still pending approval.',
                messages: [
                  ...messages,
                  new AIMessage('Workflow resumed, awaiting approval'),
                ],
              };
            }
          }
        }

        // Generate execution summary for resumed workflow
        const summaryResult = await generateExecutionSummary(currentState);
        currentState = { ...currentState, ...summaryResult };

        return {
          ...state,
          finalResponse:
            currentState.finalResponse || 'Resumed workflow completed',
          executionSummary: currentState.executionSummary,
          complexityAnalysis: resumedWorkflow.complexityAnalysis,
          executionPlan: currentState.executionPlan,
          executionSteps: currentState.executionSteps,
          messages: [
            ...messages,
            new AIMessage(
              currentState.finalResponse || 'Resumed workflow completed',
            ),
          ],
        };
      }

      // Handle special resume message when no paused workflow exists
      if (isResumeMessage && !resumedWorkflow) {
        logger.warn('Resume message received but no paused workflow found', {
          userId,
        });
        return {
          ...state,
          finalResponse: 'No paused workflow found to resume.',
          messages: [
            ...messages,
            new AIMessage('No paused workflow found to resume.'),
          ],
        };
      }

      // Skip new workflow creation if this is just a resume message
      if (isResumeMessage) {
        return {
          ...state,
          finalResponse: 'Resume message processed.',
          messages: [...messages, new AIMessage('Resume message processed.')],
        };
      }

      // Step 1: Analyze complexity (for new workflows)
      const sessionContext = messageMetadata.sessionContext || {
        startTime: Date.now(),
      };
      const workflowState = {
        messages,
        userMessage,
        userId,
        telegramContext,
        sessionContext,
        currentStepIndex: 0,
        executionSteps: [],
        mcpResponses: [],
        approvalRequests: [],
        awaitingApproval: false,
        shouldExit: false,
      };

      const complexityResult = await analyzeTaskComplexity(workflowState);

      logger.info('Task complexity analyzed', {
        userId,
        classification: complexityResult.complexityAnalysis?.classification,
        confidence: complexityResult.complexityAnalysis?.confidence,
      });

      // Step 2: Execute based on complexity
      if (complexityResult.complexityAnalysis?.classification === 'simple') {
        // Execute simple task
        const executionResult = await executeSimpleTask({
          ...workflowState,
          complexityAnalysis: complexityResult.complexityAnalysis,
          sessionContext:
            complexityResult.sessionContext || workflowState.sessionContext,
        });

        return {
          ...state,
          finalResponse: executionResult.finalResponse,
          executionSummary: executionResult.executionSummary,
          complexityAnalysis: complexityResult.complexityAnalysis,
          messages: [
            ...messages,
            new AIMessage(executionResult.finalResponse || 'Task completed'),
          ],
        };
      } else {
        // Handle complex tasks with full Phase 2 implementation
        logger.info('Executing complex task workflow', {
          userId,
          classification: complexityResult.complexityAnalysis?.classification,
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let currentState: any = {
          ...workflowState,
          complexityAnalysis: complexityResult.complexityAnalysis,
          sessionContext:
            complexityResult.sessionContext || workflowState.sessionContext,
          currentStepIndex: 0,
          executionSteps: [],
          mcpResponses: [],
          approvalRequests: [],
          awaitingApproval: false,
          shouldExit: false,
        };

        // Step 2.1: Plan complex task
        const planResult = await planComplexTask(currentState);
        currentState = { ...currentState, ...planResult };

        if (planResult.error || planResult.shouldExit) {
          return {
            ...state,
            finalResponse: 'Complex task planning failed',
            complexityAnalysis: complexityResult.complexityAnalysis,
            error: planResult.error,
            messages: [
              ...messages,
              new AIMessage('Complex task planning failed'),
            ],
          };
        }

        // Step 2.2: Execute steps one by one
        while (!currentState.shouldExit && currentState.executionPlan) {
          // Use enhanced step executor if available and feature flag is enabled
          const stepResult =
            await this.executeStepWithEnhancedMCP(currentState);
          currentState = { ...currentState, ...stepResult };

          // Handle approval requests - check if user has responded
          if (currentState.awaitingApproval) {
            logger.info('Workflow waiting for user approval', {
              userId,
              stepIndex: currentState.currentStepIndex,
              pendingRequests: currentState.approvalRequests.length,
            });

            // Check if user has responded via global approval manager
            const pendingApproval =
              currentState.approvalRequests[
                currentState.approvalRequests.length - 1
              ];
            const currentStep = currentState.executionPlan
              ? currentState.executionPlan.steps[currentState.currentStepIndex]
              : undefined;

            // Import and check approval manager for this user's responses
            const { approvalManager } = await import('./approval-manager.js');
            const globalRequests = approvalManager.getAllRequests(userId);
            const globalResponse = globalRequests.find(
              (req) =>
                req.stepId === currentStep?.id && req.approved !== undefined,
            );

            if (globalResponse) {
              // User has responded - update local state and continue
              pendingApproval.approved = globalResponse.approved;
              pendingApproval.response = globalResponse.response;
              currentState.awaitingApproval = false;

              logger.info('User approval received, continuing workflow', {
                userId,
                approved: globalResponse.approved,
                stepId: currentStep?.id,
              });

              if (!globalResponse.approved) {
                // User denied - exit workflow
                currentState.shouldExit = true;
                await telegramContext.reply(
                  `⏭️ STEP DENIED\n\nStep "${currentStep?.description}" was denied. Workflow stopped.`,
                );
              }
            } else {
              // Still waiting - store workflow and pause
              logger.info(
                'Still waiting for user approval, storing and pausing workflow',
                {
                  userId,
                  stepId: currentStep?.id,
                },
              );

              // Store the paused workflow
              workflowStateManager.storePausedWorkflow(userId, currentState);

              // Return early without summary - workflow is paused
              return {
                ...state,
                awaitingApproval: true,
                finalResponse:
                  'Workflow paused pending user approval. Use /approve or /deny to continue.',
                complexityAnalysis: complexityResult.complexityAnalysis,
                executionPlan: currentState.executionPlan,
                executionSteps: currentState.executionSteps,
                approvalRequests: currentState.approvalRequests,
                messages: [
                  ...messages,
                  new AIMessage('Workflow paused pending approval'),
                ],
              };
            }
          }
        }

        // Step 2.3: Generate execution summary (only if workflow completed)
        const summaryResult = await generateExecutionSummary(currentState);
        currentState = { ...currentState, ...summaryResult };

        return {
          ...state,
          finalResponse:
            currentState.finalResponse || 'Complex task execution completed',
          executionSummary: currentState.executionSummary,
          complexityAnalysis: complexityResult.complexityAnalysis,
          executionPlan: currentState.executionPlan,
          executionSteps: currentState.executionSteps,
          messages: [
            ...messages,
            new AIMessage(
              currentState.finalResponse || 'Complex task completed',
            ),
          ],
        };
      }
    } catch (error) {
      logger.error('SimpleLangGraph agent logic failed', { error, userId });

      const errorMessage =
        '❌ Sorry, I encountered an error processing your request. Please try again.';

      // Clean up context on error
      const contextKey = messageMetadata.contextKey;
      if (contextKey) {
        this.activeContexts.delete(contextKey);
        const timer = this.contextCleanupTimers.get(contextKey);
        if (timer) {
          clearTimeout(timer);
          this.contextCleanupTimers.delete(contextKey);
        }
      }

      try {
        await telegramContext.reply(errorMessage);
      } catch (replyError) {
        logger.error('Failed to send error reply', { replyError });
      }

      return {
        ...state,
        finalResponse: errorMessage,
        messages: [...messages, new AIMessage(errorMessage)],
      };
    }
  }

  /**
   * Initialize enhanced MCP integration
   */
  private async initializeEnhancedMCP(): Promise<void> {
    try {
      logger.info(
        'Initializing enhanced MCP integration with @langchain/mcp-adapters',
      );
      this.enhancedMCPSetup = await setupEnhancedMCPIntegration();
      logger.info('Enhanced MCP integration initialized successfully', {
        toolCount: this.enhancedMCPSetup.tools.length,
        tools: this.enhancedMCPSetup.tools.map((t: any) => t.name),
      });
    } catch (error) {
      logger.error('Failed to initialize enhanced MCP integration', { error });
      this.enhancedMCPSetup = null;
    }
  }

  /**
   * Execute step with enhanced MCP if available, fallback to regular executor
   */
  private async executeStepWithEnhancedMCP(state: any): Promise<any> {
    // If enhanced MCP is enabled and available, use it
    if (useEnhancedMCP() && this.enhancedMCPSetup) {
      try {
        // Enhance the state with MCP tools and context
        const enhancedState = {
          ...state,
          mcpTools: this.enhancedMCPSetup.tools,
          activeServers: ['todo'], // Add more servers as they become available
          toolResults: state.toolResults || {},
        };

        logger.info('Using enhanced MCP step executor', {
          userId: state.userId,
          stepId: state.executionPlan?.steps[state.currentStepIndex]?.id,
          availableTools: this.enhancedMCPSetup.tools.length,
        });

        return await executeStepWithAdapters(enhancedState);
      } catch (error) {
        logger.warn(
          'Enhanced MCP step execution failed, falling back to regular executor',
          {
            error,
            userId: state.userId,
            stepId: state.executionPlan?.steps[state.currentStepIndex]?.id,
          },
        );

        // Fallback to regular step executor
        return await executeStep(state);
      }
    } else {
      // Use regular step executor
      logger.info('Using regular step executor', {
        userId: state.userId,
        enhancedMCPEnabled: useEnhancedMCP(),
        enhancedMCPAvailable: !!this.enhancedMCPSetup,
      });

      return await executeStep(state);
    }
  }
}
