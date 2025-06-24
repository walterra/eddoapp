import type { BaseMessage } from '@langchain/core/messages';

import type { BotContext } from '../../bot/bot.js';
import type { MultiTodoIntent, TodoIntent } from '../../types/ai-types.js';

/**
 * Task complexity levels for routing decisions
 */
export type TaskComplexity = 'simple' | 'compound' | 'complex';

/**
 * Task complexity analysis result
 */
export interface TaskComplexityAnalysis {
  classification: TaskComplexity;
  reasoning: string;
  confidence: number;
  suggestedSteps?: string[];
  requiresApproval: boolean;
  estimatedSteps: number;
  riskLevel: 'low' | 'medium' | 'high';
}

/**
 * Individual execution step in a plan
 */
export interface ExecutionStep {
  id: string;
  action: string;
  parameters: Record<string, unknown>;
  description: string;
  successCriteria: string;
  requiresApproval: boolean;
  dependencies: string[];
  fallbackAction?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  result?: unknown;
  error?: Error;
  timestamp?: number;
  duration?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Complete execution plan for complex tasks
 */
export interface ExecutionPlan {
  id: string;
  userIntent: string;
  complexity: TaskComplexity;
  steps: ExecutionStep[];
  estimatedDuration: string;
  riskLevel: 'low' | 'medium' | 'high';
  requiresApproval: boolean;
  createdAt: number;
}

/**
 * User approval request for destructive operations
 */
export interface ApprovalRequest {
  id: string;
  userId: string;
  planId?: string;
  stepId: string;
  action: string;
  parameters: Record<string, unknown>;
  description: string;
  riskLevel: 'low' | 'medium' | 'high';
  message?: string;
  options?: string[];
  approved?: boolean;
  response?: string;
  createdAt: number;
  timestamp?: number;
  expiresAt?: number;
}

/**
 * Execution summary generated after completion
 */
export interface ExecutionSummary {
  planId: string;
  userIntent: string;
  totalSteps: number;
  completedSteps: number;
  failedSteps: number;
  skippedSteps: number;
  duration: number;
  changes: string[];
  suggestions: string[];
  nextActions?: string[];
}

/**
 * Main state object shared across all workflow nodes
 */
export interface WorkflowState {
  // Input and conversation
  messages: BaseMessage[];
  userMessage: string;
  userId: string;

  // Analysis results
  complexityAnalysis?: TaskComplexityAnalysis;
  originalIntent?: TodoIntent | MultiTodoIntent;

  // Planning
  executionPlan?: ExecutionPlan;
  currentStepIndex: number;

  // Execution tracking
  executionSteps: ExecutionStep[];
  mcpResponses: unknown[];

  // User interaction
  approvalRequests: ApprovalRequest[];
  awaitingApproval: boolean;

  // Results
  executionSummary?: ExecutionSummary;
  finalResponse?: string;

  // Context
  sessionContext: {
    todoCount?: number;
    lastActivity?: string;
    commonContexts?: string[];
    startTime?: number;
    lastComplexityAnalysis?: string;
    lastPlanId?: string;
  };

  // Control flow
  shouldExit: boolean;
  error?: Error;

  // Telegram context (for responses)
  telegramContext: BotContext;
}

/**
 * Node function type for LangGraph nodes
 */
export type WorkflowNode = (
  state: WorkflowState,
) => Promise<Partial<WorkflowState>>;

/**
 * Routing function type for conditional edges
 */
export type RouteFunction = (state: WorkflowState) => string;

/**
 * Workflow execution result
 */
export interface WorkflowResult {
  success: boolean;
  summary?: ExecutionSummary;
  error?: Error;
  finalState: WorkflowState;
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
