import { Annotation } from '@langchain/langgraph';

import type { BotContext } from '../bot/bot.js';

/**
 * Task analysis result following LangGraph examples pattern
 */
export interface TaskAnalysis {
  classification: 'simple' | 'compound' | 'complex';
  confidence: number;
  reasoning: string;
  requiresApproval: boolean;
  suggestedSteps?: string[];
  riskLevel: 'low' | 'medium' | 'high';
  estimatedSteps: number;
}

/**
 * Individual step in execution plan
 */
export interface PlanStep {
  id: string;
  action: string;
  parameters: Record<string, unknown>;
  description: string;
  dependencies: string[];
  requiresApproval: boolean;
  riskLevel: 'low' | 'medium' | 'high';
}

/**
 * Complete execution plan
 */
export interface ExecutionPlan {
  id: string;
  userIntent: string;
  steps: PlanStep[];
  requiresApproval: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  estimatedDuration: string;
}

/**
 * Execution step with status tracking
 */
export interface ExecutionStep extends PlanStep {
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  result?: unknown;
  error?: Error;
  timestamp?: number;
  duration?: number;
}

/**
 * Human approval request
 */
export interface ApprovalRequest {
  id: string;
  stepId: string;
  action: string;
  parameters: Record<string, unknown>;
  description: string;
  riskLevel: 'low' | 'medium' | 'high';
  message: string;
  approved?: boolean;
  feedback?: string;
  timestamp: number;
}

/**
 * Reflection and summary results
 */
export interface ReflectionResult {
  success: boolean;
  summary: string;
  changes: string[];
  errors: string[];
  suggestions: string[];
  nextActions?: string[];
  totalSteps: number;
  completedSteps: number;
  failedSteps: number;
  duration: number;
}

/**
 * Enhanced workflow state using LangGraph Annotation system
 * Following the Intent → Plan → Execute → Reflect pattern
 */
export const EnhancedWorkflowState = Annotation.Root({
  // Input and user context
  userIntent: Annotation<string>(),
  userId: Annotation<string>(),

  // Analysis phase
  taskAnalysis: Annotation<TaskAnalysis>(),

  // Planning phase
  executionPlan: Annotation<ExecutionPlan>(),

  // Execution phase
  executionSteps: Annotation<ExecutionStep[]>({
    reducer: (prev, current) => [...prev, ...current],
    default: () => [],
  }),
  currentStepIndex: Annotation<number>({
    reducer: (_, current) => current,
    default: () => 0,
  }),
  mcpResults: Annotation<Record<string, unknown>>({
    reducer: (prev, current) => ({ ...prev, ...current }),
    default: () => ({}),
  }),
  mcpResponses: Annotation<unknown[]>({
    reducer: (prev, current) => [...prev, ...current],
    default: () => [],
  }),
  toolResults: Annotation<Record<string, unknown>>({
    reducer: (prev, current) => ({ ...prev, ...current }),
    default: () => ({}),
  }),

  // Human-in-the-loop
  approvalRequests: Annotation<ApprovalRequest[]>({
    reducer: (prev, current) => [...prev, ...current],
    default: () => [],
  }),
  awaitingApproval: Annotation<boolean>({
    reducer: (_, current) => current,
    default: () => false,
  }),

  // Results and reflection
  finalResult: Annotation<unknown>(),
  reflectionResult: Annotation<ReflectionResult>(),
  finalResponse: Annotation<string>(),

  // Error handling
  error: Annotation<Error>(),
  retryCount: Annotation<number>({
    reducer: (_, current) => current,
    default: () => 0,
  }),

  // Telegram context (stored separately to avoid serialization issues)
  telegramContextKey: Annotation<string>(),

  // Session tracking
  sessionStartTime: Annotation<number>({
    reducer: (_, current) => current,
    default: () => Date.now(),
  }),
  sessionContext: Annotation<Record<string, unknown>>({
    reducer: (prev, current) => ({ ...prev, ...current }),
    default: () => ({}),
  }),
});

/**
 * Type alias for the enhanced workflow state
 */
export type EnhancedWorkflowStateType = typeof EnhancedWorkflowState.State;

/**
 * Context manager for storing Telegram contexts separately from LangGraph state
 */
export class TelegramContextManager {
  private contexts = new Map<string, BotContext>();
  private cleanupTimers = new Map<string, NodeJS.Timeout>();

  /**
   * Store a telegram context with automatic cleanup
   */
  store(key: string, context: BotContext, timeoutMs = 300000): void {
    this.contexts.set(key, context);

    // Clear any existing timer
    const existingTimer = this.cleanupTimers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new cleanup timer
    const timer = setTimeout(() => {
      this.contexts.delete(key);
      this.cleanupTimers.delete(key);
    }, timeoutMs);

    this.cleanupTimers.set(key, timer);
  }

  /**
   * Retrieve a stored telegram context
   */
  get(key: string): BotContext | undefined {
    return this.contexts.get(key);
  }

  /**
   * Remove a context and its cleanup timer
   */
  remove(key: string): void {
    this.contexts.delete(key);
    const timer = this.cleanupTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.cleanupTimers.delete(key);
    }
  }

  /**
   * Get statistics about stored contexts
   */
  getStats(): { activeContexts: number; timers: number } {
    return {
      activeContexts: this.contexts.size,
      timers: this.cleanupTimers.size,
    };
  }
}

// Singleton instance for telegram context management
export const telegramContextManager = new TelegramContextManager();
