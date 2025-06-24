import { StateGraph, MessagesAnnotation, START, END } from '@langchain/langgraph';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { RunnableLambda } from '@langchain/core/runnables';
import { logger } from '../utils/logger.js';
import type { BotContext } from '../bot/bot.js';
import { analyzeTaskComplexity } from './nodes/complexity-analyzer.js';
import { executeSimpleTask } from './nodes/simple-executor.js';
import type { TaskComplexityAnalysis as _TaskComplexityAnalysis, ExecutionSummary as _ExecutionSummary } from './types/workflow-types.js';

/**
 * Simplified LangGraph workflow that works around TypeScript definition limitations
 */
export class SimpleLangGraphWorkflow {
  private app: unknown; // Use unknown to bypass strict typing issues
  private activeContexts: Map<string, BotContext> = new Map(); // Store active contexts
  private contextCleanupTimers: Map<string, NodeJS.Timeout> = new Map(); // Cleanup timers

  constructor() {
    // Create workflow using the patterns from LangGraph examples
    const workflow = new StateGraph(MessagesAnnotation);
    
    // Add the main agent node
    const agentFunction = async (state: typeof MessagesAnnotation.State & Record<string, unknown>) => {
      return await this.runAgentLogic(state);
    };
    
    workflow
      .addNode('agent', new RunnableLambda({ func: agentFunction }))
      .addEdge(START, 'agent')
      .addEdge('agent', END);
    
    this.app = workflow.compile();
    
    logger.info('SimpleLangGraphWorkflow initialized successfully');
  }

  /**
   * Execute the workflow
   */
  async execute(
    userMessage: string,
    userId: string,
    telegramContext: BotContext
  ): Promise<{ success: boolean; finalResponse?: string; error?: Error }> {
    const startTime = Date.now();
    
    logger.info('Starting SimpleLangGraph workflow execution', { 
      userId, 
      messageLength: userMessage.length 
    });

    try {
      // Store the telegram context in our instance map for retrieval later
      const contextKey = `${userId}-${startTime}`;
      this.activeContexts.set(contextKey, telegramContext);
      
      // Set a cleanup timer to prevent memory leaks (5 minute timeout)
      const cleanupTimer = setTimeout(() => {
        this.activeContexts.delete(contextKey);
        this.contextCleanupTimers.delete(contextKey);
        logger.warn('Cleaned up expired telegram context', { contextKey });
      }, 5 * 60 * 1000);
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
            commonContexts: ['work', 'personal', 'shopping', 'health']
          }
        }
      });

      const initialState = {
        messages: [messageWithContext]
      };

      const result = await (this.app as { invoke: (state: unknown) => Promise<Record<string, unknown>> }).invoke(initialState);

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
        hasResponse: !!(result as any).finalResponse
      });

      return { 
        success: true, 
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        finalResponse: (result as any).finalResponse || 'Workflow completed successfully'
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
        duration
      });

      // Send error message to user
      try {
        await telegramContext.reply(
          '❌ Sorry, I encountered an error processing your request. Please try again.'
        );
      } catch (replyError) {
        logger.error('Failed to send error message to user', { replyError });
      }

      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  /**
   * Main agent logic that handles the entire workflow
   */
  private async runAgentLogic(state: Record<string, unknown>): Promise<Record<string, unknown>> {
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

    logger.info('Running SimpleLangGraph agent logic', { userId, messageLength: userMessage.length });

    try {
      // Step 1: Analyze complexity
      const sessionContext = messageMetadata.sessionContext || {};
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
        shouldExit: false
      };

      const complexityResult = await analyzeTaskComplexity(workflowState);
      
      logger.info('Task complexity analyzed', {
        userId,
        classification: complexityResult.complexityAnalysis?.classification,
        confidence: complexityResult.complexityAnalysis?.confidence
      });

      // Step 2: Execute based on complexity
      if (complexityResult.complexityAnalysis?.classification === 'simple') {
        // Execute simple task
        const executionResult = await executeSimpleTask({
          ...workflowState,
          complexityAnalysis: complexityResult.complexityAnalysis,
          sessionContext: complexityResult.sessionContext || workflowState.sessionContext
        });

        return {
          ...state,
          finalResponse: executionResult.finalResponse,
          executionSummary: executionResult.executionSummary,
          complexityAnalysis: complexityResult.complexityAnalysis,
          messages: [...messages, new AIMessage(executionResult.finalResponse || 'Task completed')],
        };
      } else {
        // Handle complex tasks (placeholder for Phase 2)
        const response = `🚧 **Complex Task Detected**\n\nI've analyzed your request and classified it as "${complexityResult.complexityAnalysis?.classification || 'complex'}".\n\n` +
          `**Analysis:** ${complexityResult.complexityAnalysis?.reasoning || 'Requires multi-step planning'}\n\n` +
          `Complex task execution is coming in Phase 2! For now, please try breaking your request into simpler steps.`;

        await telegramContext.reply(response, { parse_mode: 'Markdown' });

        return {
          ...state,
          finalResponse: 'Complex task execution not yet implemented',
          complexityAnalysis: complexityResult.complexityAnalysis,
          messages: [...messages, new AIMessage(response)],
        };
      }
    } catch (error) {
      logger.error('SimpleLangGraph agent logic failed', { error, userId });
      
      const errorMessage = '❌ Sorry, I encountered an error processing your request. Please try again.';
      
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
}
