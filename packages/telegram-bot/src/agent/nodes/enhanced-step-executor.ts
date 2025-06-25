import type { Tool } from '@langchain/core/tools';

import { extractServerName } from '../../mcp/enhanced-client.js';
import { logger } from '../../utils/logger.js';
import { approvalManager } from '../approval-manager.js';
import type {
  ApprovalRequest,
  ExecutionStep,
  WorkflowState,
} from '../types/workflow-types.js';

/**
 * Enhanced workflow state with multi-server MCP tools
 */
interface EnhancedWorkflowState extends WorkflowState {
  mcpTools: Tool[];
  activeServers: string[];
  toolResults: Record<string, unknown>;
}

/**
 * Enhanced step executor using LangChain MCP adapters
 */
export const executeStepWithAdapters = async (
  state: EnhancedWorkflowState,
): Promise<Partial<EnhancedWorkflowState>> => {
  if (!state.executionPlan) {
    throw new Error('No execution plan found');
  }

  const currentStep = state.executionPlan.steps[state.currentStepIndex];
  if (!currentStep) {
    logger.info('All steps completed', {
      userId: state.userId,
      planId: state.executionPlan.id,
      totalSteps: state.executionPlan.steps.length,
    });
    return { shouldExit: true };
  }

  logger.info('Executing enhanced step', {
    userId: state.userId,
    planId: state.executionPlan.id,
    stepId: currentStep.id,
    stepIndex: state.currentStepIndex + 1,
    totalSteps: state.executionPlan.steps.length,
    action: currentStep.action,
    availableTools: state.mcpTools?.length || 0,
  });

  // Override incorrect approval requirements for safe operations
  if (
    currentStep.action === 'analysis' ||
    currentStep.action === 'list_todos'
  ) {
    currentStep.requiresApproval = false;
  }

  // Check if step requires approval
  if (currentStep.requiresApproval && !state.awaitingApproval) {
    // First check if there's already an approval for this step
    const existingApproval = approvalManager
      .getAllRequests(state.userId)
      .find(
        (req) => req.stepId === currentStep.id && req.approved !== undefined,
      );

    if (existingApproval) {
      logger.info('Found existing approval for enhanced step', {
        stepId: currentStep.id,
        approved: existingApproval.approved,
        userId: state.userId,
      });

      if (!existingApproval.approved) {
        // Step was denied, skip it
        currentStep.status = 'skipped';
        currentStep.error = new Error(
          `User denied approval: ${existingApproval.response || 'No reason provided'}`,
        );

        await sendEnhancedProgressUpdate(state, currentStep, 'skipped');

        return {
          currentStepIndex: state.currentStepIndex + 1,
          executionSteps: [...state.executionSteps, currentStep],
          awaitingApproval: false,
        };
      }
      // Step was approved, continue execution below
    } else {
      // No existing approval, request it
      return await requestEnhancedApproval(state, currentStep);
    }
  }

  // If we're waiting for approval but haven't received it, skip execution for now
  if (state.awaitingApproval) {
    const pendingRequest = state.approvalRequests.find(
      (req) => req.stepId === currentStep.id && req.approved === undefined,
    );

    if (pendingRequest) {
      // Check if request has expired (5 minutes) - just log but don't auto-deny
      if (pendingRequest.expiresAt && Date.now() > pendingRequest.expiresAt) {
        logger.warn(
          'Enhanced approval request expired but keeping workflow paused',
          {
            stepId: currentStep.id,
            requestId: pendingRequest.id,
          },
        );
      }

      // Still waiting, don't proceed with execution
      return { awaitingApproval: true };
    }
  }

  try {
    // Find the appropriate tool from MCP adapters
    const tool = findToolForAction(state.mcpTools, currentStep.action);

    if (!tool) {
      throw new Error(`Tool not found for action: ${currentStep.action}`);
    }

    // Execute using LangChain tool interface
    const result = await tool.invoke(currentStep.parameters);

    // Store result with standardized format
    const toolResults = {
      ...state.toolResults,
      [currentStep.id]: {
        content: result.content || result,
        artifact: result.artifact,
        metadata: {
          toolName: tool.name,
          server: extractServerName(tool.name),
          timestamp: Date.now(),
        },
      },
    };

    // Update step status
    currentStep.status = 'completed';
    currentStep.result = result;
    currentStep.duration = Date.now() - (currentStep.timestamp || Date.now());

    logger.info('Enhanced step completed', {
      stepId: currentStep.id,
      toolName: tool.name,
      server: extractServerName(tool.name),
      duration: currentStep.duration,
      userId: state.userId,
    });

    await sendEnhancedProgressUpdate(state, currentStep, 'completed');

    return {
      currentStepIndex: state.currentStepIndex + 1,
      executionSteps: [...state.executionSteps, currentStep],
      toolResults,
      mcpResponses: [...state.mcpResponses, result],
      awaitingApproval: false,
    };
  } catch (error) {
    return handleEnhancedStepError(error, currentStep, state);
  }
};

/**
 * Find appropriate tool for a given action with fuzzy matching
 */
function findToolForAction(tools: Tool[], action: string): Tool | null {
  if (!tools || tools.length === 0) {
    return null;
  }

  // Direct name match (prefixed with server name)
  let tool = tools.find(
    (t) =>
      t.name.includes(action) ||
      t.name.endsWith(`_${action}`) ||
      t.name.toLowerCase().includes(action.toLowerCase()),
  );

  if (tool) return tool;

  // Action-based mapping for common operations
  const actionMapping: Record<string, string[]> = {
    list_todos: ['listTodos', 'eddo__todo__listTodos'],
    create_todo: ['createTodo', 'eddo__todo__createTodo'],
    update_todo: ['updateTodo', 'eddo__todo__updateTodo'],
    delete_todo: ['deleteTodo', 'eddo__todo__deleteTodo'],
    toggle_completion: [
      'toggleTodoCompletion',
      'eddo__todo__toggleTodoCompletion',
    ],
    start_time_tracking: ['startTimeTracking', 'eddo__todo__startTimeTracking'],
    stop_time_tracking: ['stopTimeTracking', 'eddo__todo__stopTimeTracking'],
    get_active_timers: [
      'getActiveTimeTracking',
      'eddo__todo__getActiveTimeTracking',
    ],
    // Handle the legacy artificial actions by mapping them to real actions
    execute_simple_task: ['listTodos', 'eddo__todo__listTodos'],
    execute_fallback_task: ['listTodos', 'eddo__todo__listTodos'],
  };

  const possibleNames = actionMapping[action] || [action];

  for (const name of possibleNames) {
    tool = tools.find(
      (t) =>
        t.name.toLowerCase().includes(name.toLowerCase()) ||
        t.description?.toLowerCase().includes(name.toLowerCase()),
    );
    if (tool) return tool;
  }

  return null;
}

/**
 * Enhanced error handling with multi-server context and fallbacks
 */
async function handleEnhancedStepError(
  error: unknown,
  step: ExecutionStep,
  state: EnhancedWorkflowState,
): Promise<Partial<EnhancedWorkflowState>> {
  logger.error('Enhanced step execution failed', {
    error,
    stepId: step.id,
    action: step.action,
    availableTools: state.mcpTools?.map((t) => t.name) || [],
    activeServers: state.activeServers || [],
    userId: state.userId,
  });

  // Try alternative tools from different servers
  const alternativeTools =
    state.mcpTools?.filter(
      (tool) =>
        tool.description?.includes(step.action) ||
        tool.name.includes('fallback') ||
        tool.name.includes('backup') ||
        // Try similar actions
        (step.action === 'list_todos' && tool.name.includes('list')) ||
        (step.action === 'create_todo' && tool.name.includes('create')) ||
        (step.action.includes('timer') && tool.name.includes('timer')),
    ) || [];

  if (alternativeTools.length > 0) {
    logger.info('Attempting fallback with alternative tools', {
      stepId: step.id,
      alternatives: alternativeTools.map((t) => t.name),
      userId: state.userId,
    });

    // Try each alternative tool
    for (const altTool of alternativeTools) {
      try {
        const fallbackResult = await altTool.invoke(step.parameters);

        step.status = 'completed';
        step.result = fallbackResult;
        step.metadata = { ...step.metadata, usedFallback: altTool.name };

        logger.info('Fallback tool succeeded', {
          stepId: step.id,
          fallbackTool: altTool.name,
          userId: state.userId,
        });

        await sendEnhancedProgressUpdate(state, step, 'completed');

        return {
          currentStepIndex: state.currentStepIndex + 1,
          executionSteps: [...state.executionSteps, step],
          toolResults: {
            ...state.toolResults,
            [step.id]: {
              content: fallbackResult,
              metadata: {
                toolName: altTool.name,
                server: extractServerName(altTool.name),
                timestamp: Date.now(),
                wasFallback: true,
              },
            },
          },
          awaitingApproval: false,
        };
      } catch (fallbackError) {
        logger.warn('Fallback tool also failed', {
          tool: altTool.name,
          error: fallbackError,
          userId: state.userId,
        });
      }
    }
  }

  // Mark step as failed if no alternatives worked
  step.status = 'failed';
  step.error = error instanceof Error ? error : new Error(String(error));

  await sendEnhancedProgressUpdate(state, step, 'failed');

  return {
    currentStepIndex: state.currentStepIndex + 1,
    executionSteps: [...state.executionSteps, step],
    error: step.error,
    awaitingApproval: false,
  };
}

/**
 * Send enhanced progress update with multi-server context
 */
async function sendEnhancedProgressUpdate(
  state: EnhancedWorkflowState,
  step: ExecutionStep,
  status: 'completed' | 'failed' | 'skipped',
): Promise<void> {
  const stepNumber = state.currentStepIndex + 1;
  const totalSteps = state.executionPlan!.steps.length;

  let message = '';
  let icon = '';

  switch (status) {
    case 'completed':
      icon = '✅';
      message = `**Step ${stepNumber}/${totalSteps} Completed**\n${step.description}`;
      if (step.metadata?.usedFallback) {
        message += `\n💡 _Used fallback tool: ${step.metadata.usedFallback}_`;
      }
      break;
    case 'failed':
      icon = '❌';
      message = `**Step ${stepNumber}/${totalSteps} Failed**\n${step.description}\n⚠️ ${step.error?.message || 'Unknown error'}`;
      break;
    case 'skipped':
      icon = '⏭️';
      message = `**Step ${stepNumber}/${totalSteps} Skipped**\n${step.description}\n_User denied approval_`;
      break;
  }

  try {
    await state.telegramContext.reply(`${icon} ${message}`, {
      parse_mode: 'Markdown',
    });
  } catch (error) {
    logger.error('Failed to send enhanced progress update', {
      error,
      stepId: step.id,
      userId: state.userId,
    });
  }
}

/**
 * Request enhanced approval with better context
 */
async function requestEnhancedApproval(
  state: EnhancedWorkflowState,
  step: ExecutionStep,
): Promise<Partial<EnhancedWorkflowState>> {
  const approvalRequest: ApprovalRequest = {
    id: `approval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId: state.userId,
    stepId: step.id,
    action: step.action,
    parameters: step.parameters,
    description: step.description,
    riskLevel: determineRiskLevel(step),
    createdAt: Date.now(),
    expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
  };

  // Store the approval request
  approvalManager.addRequest(state.userId, approvalRequest);

  const riskIcon =
    approvalRequest.riskLevel === 'high'
      ? '🔴'
      : approvalRequest.riskLevel === 'medium'
        ? '🟡'
        : '🟢';

  const message = `⚠️ **Enhanced Approval Required**

**Step:** ${step.description}
**Action:** ${step.action}
**Risk Level:** ${riskIcon} ${approvalRequest.riskLevel}
**Server Context:** Multi-server operation with fallback support

${approvalRequest.riskLevel === 'high' ? '**⚠️ This operation will permanently modify or delete data**' : '**ℹ️ This operation requires confirmation**'}

Do you want to proceed?

Reply with:
• "yes" or "approve" to proceed
• "no" or "deny" to skip this step`;

  try {
    await state.telegramContext.reply(message, { parse_mode: 'Markdown' });
  } catch (error) {
    logger.error('Failed to send enhanced approval request', {
      error,
      approvalId: approvalRequest.id,
      userId: state.userId,
    });
  }

  return {
    awaitingApproval: true,
    approvalRequests: [...state.approvalRequests, approvalRequest],
  };
}

/**
 * Determine risk level for enhanced approval context
 */
function determineRiskLevel(step: ExecutionStep): 'low' | 'medium' | 'high' {
  const action = step.action.toLowerCase();
  const params = step.parameters || {};

  // High risk: Destructive operations
  if (action.includes('delete') || action.includes('remove')) {
    return 'high';
  }

  // Medium risk: Bulk operations or updates
  if (action.includes('update') && Object.keys(params).length > 1) {
    return 'medium';
  }

  // Low risk: Read operations or single item changes
  return 'low';
}
