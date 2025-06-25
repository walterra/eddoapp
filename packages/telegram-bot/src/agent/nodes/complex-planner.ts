import Anthropic from '@anthropic-ai/sdk';

import type { ActionRegistry } from '../../services/action-registry.js';
import { appConfig } from '../../utils/config.js';
import { logger } from '../../utils/logger.js';
import type {
  ExecutionPlan,
  ExecutionStep,
  WorkflowState,
} from '../types/workflow-types.js';

/**
 * Complex task planner node - generates detailed execution plans for multi-step workflows
 */
export const planComplexTask =
  (actionRegistry?: ActionRegistry | null) =>
  async (state: WorkflowState): Promise<Partial<WorkflowState>> => {
    logger.info('Planning complex task', {
      userId: state.userId,
      message: state.userMessage,
      classification: state.complexityAnalysis?.classification,
    });

    try {
      const plan = await generateExecutionPlan(
        state.userMessage,
        state.complexityAnalysis,
        state.sessionContext,
        actionRegistry,
      );

      logger.info('Complex task plan generated', {
        userId: state.userId,
        planId: plan.id,
        totalSteps: plan.steps.length,
        estimatedDuration: plan.estimatedDuration,
        requiresApproval: plan.requiresApproval,
      });

      // Send plan preview to user
      const planPreview = generatePlanPreview(plan);
      await state.telegramContext.reply(planPreview, {
        parse_mode: 'Markdown',
      });

      return {
        executionPlan: plan,
        currentStepIndex: 0,
        sessionContext: {
          ...state.sessionContext,
          lastPlanId: plan.id,
        },
      };
    } catch (error) {
      logger.error('Failed to plan complex task', {
        error,
        userId: state.userId,
        message: state.userMessage,
      });

      // Fallback to simple execution
      const fallbackMessage = `❌ **Planning Failed**\n\nI couldn't create a detailed plan for your request. Let me try a simpler approach or please break down your request into smaller steps.`;
      await state.telegramContext.reply(fallbackMessage, {
        parse_mode: 'Markdown',
      });

      return {
        error: error instanceof Error ? error : new Error(String(error)),
        shouldExit: true,
      };
    }
  };

/**
 * Generates a detailed execution plan using Claude
 */
async function generateExecutionPlan(
  userMessage: string,
  complexityAnalysis: WorkflowState['complexityAnalysis'],
  sessionContext: WorkflowState['sessionContext'],
  actionRegistry?: ActionRegistry | null,
): Promise<ExecutionPlan> {
  const client = new Anthropic({ apiKey: appConfig.ANTHROPIC_API_KEY });

  const prompt = buildPlanningPrompt(
    userMessage,
    complexityAnalysis,
    sessionContext,
    actionRegistry,
  );

  const response = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 2000,
    temperature: 0.3, // Balanced creativity for planning
    system: prompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }

  return parseExecutionPlan(content.text, userMessage);
}

/**
 * Generate dynamic action list for complex planning prompts using snake_case
 */
function generateActionListForComplexPlanning(
  actionRegistry: ActionRegistry | null,
): string {
  if (!actionRegistry || !actionRegistry.isInitialized()) {
    // Fallback to hard-coded actions if registry is not available
    return `- list_todos(filters?) - Get todos with filters (context, completed, dateRange)
- create_todo(title, description?, context?, due?, tags?) - Create new todo
- update_todo(id, fields) - Update existing todo fields
- delete_todo(id) - Delete specific todo
- toggle_completion(id, completed) - Mark todo as complete/incomplete
- start_time_tracking(id) - Start timer for todo
- stop_time_tracking(id) - Stop timer for todo
- get_active_timers() - Get currently running timers`;
  }

  // Generate dynamic list from ActionRegistry using snake_case format
  const actions = actionRegistry.getAvailableActions();
  return actions
    .map((action) => {
      const metadata = actionRegistry.getActionMetadata(action);
      const snakeCaseAction = action
        .replace(/([a-z])([A-Z])/g, '$1_$2')
        .toLowerCase();
      return `- ${snakeCaseAction}() - ${metadata?.description || 'No description available'}`;
    })
    .join('\n');
}

/**
 * Builds the system prompt for execution planning
 */
function buildPlanningPrompt(
  userMessage: string,
  complexityAnalysis: WorkflowState['complexityAnalysis'],
  sessionContext: WorkflowState['sessionContext'],
  actionRegistry?: ActionRegistry | null,
): string {
  return `You are an execution planner for a todo management system with MCP server integration.

TASK ANALYSIS:
- Classification: ${complexityAnalysis?.classification || 'complex'}
- Reasoning: ${complexityAnalysis?.reasoning || 'Multi-step workflow required'}
- Confidence: ${complexityAnalysis?.confidence || 0.8}
- Risk Level: ${complexityAnalysis?.riskLevel || 'medium'}

CONTEXT:
- User has ${sessionContext.todoCount || 'unknown'} todos currently
- Common contexts: ${sessionContext.commonContexts?.join(', ') || 'work, personal, shopping, health'}
- Last activity: ${sessionContext.lastActivity || 'none'}

AVAILABLE MCP ACTIONS:
${generateActionListForComplexPlanning(actionRegistry || null)}

CRITICAL DATE FORMAT REQUIREMENT:
The 'due' field MUST be an ISO date string (e.g., "2025-06-24T09:00:00.000Z"), NOT human-readable text like "saturday" or "next week".

PLANNING RULES:
1. Break down the user's request into 2-8 logical steps
2. Each step should be atomic and have clear success criteria
3. Identify dependencies between steps (what must happen first)
4. IMPORTANT: Only mark DESTRUCTIVE steps as requiring approval (delete_todo, bulk operations). NEVER mark analysis or list_todos steps as requiring approval.
5. Estimate realistic timeframes for each step
6. Provide fallback actions for potential failures
7. Consider the user's context and existing todos
8. ALWAYS convert relative dates to ISO format:
   - "saturday" → calculate the next Saturday and format as "2025-06-28T09:00:00.000Z"
   - "next week" → calculate specific date and format as ISO string
   - "tomorrow at 3pm" → "2025-06-25T15:00:00.000Z"
9. CRITICAL BULK OPERATIONS RULE: For bulk operations affecting multiple todos (delete, update, toggle completion), you MUST:
   a) First include a list_todos step to get the todos matching the criteria
   b) Then create a SINGLE bulk operation step (delete_todo, update_todo, etc.) WITHOUT specific ID parameters
   c) The step executor will automatically handle individual operations for each todo found
   d) Example: For "delete all host todos" → step 1: list_todos({"context": "host"}), step 2: delete_todo({})

CRITICAL START_TIMER PATTERN: When user wants to work on a task by name (e.g., "start with the leaky faucet"), you MUST:
   a) First include a list_todos step to search for existing todos with that title
   b) Then include a start_timer step that will either start timer on existing todo OR create then start timer
   c) The step executor will automatically handle finding the ID or creating the todo first
   d) Example: "Let's start with the leaky faucet" → step 1: list_todos({"title": "leaky faucet"}), step 2: start_timer({"title": "leaky faucet"})

CRITICAL STOP_TIMER PATTERN: When user wants to stop time tracking (e.g., "stop timer", "stop tracking"), you can:
   a) Use stop_timer({}) with empty parameters to stop the most recent active timer
   b) Use stop_timer({"title": "task name"}) to stop a specific task's timer
   c) The step executor will automatically find active timers and stop the appropriate one
   d) Example: "stop timer" → stop_timer({}), "stop tracking the faucet" → stop_timer({"title": "faucet"})

CRITICAL TOGGLE_COMPLETION PATTERN: When user wants to mark a task as done/complete (e.g., "mark as done", "complete task"), you can:
   a) Use toggle_completion({"title": "task name", "completed": true}) to mark a specific task as complete
   b) Use toggle_completion({"title": "task name", "completed": false}) to mark a task as incomplete
   c) Use toggle_completion({"title": "task name"}) to toggle the current completion status
   d) The step executor will automatically find the todo by title
   e) Example: "mark the faucet task as done" → toggle_completion({"title": "faucet", "completed": true})

SAFE OPERATIONS (no approval needed):
- analysis - Data discovery and analysis steps
- list_todos - Reading/listing existing todos
- create_todo - Creating single new todos

DESTRUCTIVE OPERATIONS requiring approval:
- delete_todo - Deleting any todos (especially multiple)
- Bulk operations affecting multiple todos
- update_todo operations on multiple todos
- Operations affecting more than 3 items

CURRENT DATE/TIME: ${new Date().toISOString()} (${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })})

USER REQUEST: "${userMessage}"

BULK OPERATION EXAMPLE:
If user requests "delete all todos with context 'work'", create steps like:
1. list_todos with {"context": "work"} to find matching todos (MUST include context filter)
2. delete_todo with {} (empty parameters - executor will handle all found todos automatically)

CRITICAL SAFETY RULE: When user specifies a context filter (e.g., "with context 'travel'"), the list_todos step MUST include that exact context in its parameters. Never use empty parameters {} for list_todos when user specifies filtering criteria.

Generate a detailed execution plan in JSON format:

{
  "userIntent": "Clear description of what the user wants to achieve",
  "complexity": "compound|complex",
  "estimatedDuration": "Human readable estimate (e.g., '2-3 minutes')",
  "riskLevel": "low|medium|high",
  "requiresApproval": boolean,
  "steps": [
    {
      "action": "MCP action name or 'analysis' for discovery steps",
      "parameters": {"key": "value"} or {} for analysis steps,
      "description": "What this step accomplishes",
      "successCriteria": "How to know this step succeeded",
      "requiresApproval": boolean,
      "dependencies": ["step1", "step2"] or [],
      "fallbackAction": "What to do if this fails",
      "estimatedDuration": "30s" // realistic estimate
    }
  ]
}

Respond with ONLY the JSON - no markdown formatting or explanations.`;
}

/**
 * Resolves dependency references to actual step IDs
 */
function resolveDependencies(
  dependencies: string[],
  allSteps: Array<{ id: string; action: string }>,
  currentStepIndex: number,
): string[] {
  const resolvedDeps: string[] = [];

  for (const dep of dependencies) {
    // Try different resolution strategies
    let resolvedId: string | null = null;

    // Strategy 1: Direct step ID reference (e.g., "step_1")
    if (dep.startsWith('step_')) {
      resolvedId = dep;
    } else if (/^\d+$/.test(dep)) {
      // Strategy 2: Numeric reference (e.g., "1" -> "step_1")
      const stepNum = parseInt(dep);
      if (stepNum >= 1 && stepNum <= allSteps.length) {
        resolvedId = `step_${stepNum}`;
      }
    } else {
      // Strategy 3: Action name reference - find step with matching action
      const matchingStepIndex = allSteps.findIndex(
        (step, idx) => idx < currentStepIndex && step.action === dep,
      );
      if (matchingStepIndex !== -1) {
        resolvedId = `step_${matchingStepIndex + 1}`;
      }
    }

    // Strategy 4: Previous step if dependency is generic
    if (!resolvedId && currentStepIndex > 0) {
      resolvedId = `step_${currentStepIndex}`;
    }

    if (resolvedId) {
      resolvedDeps.push(resolvedId);
      logger.info('Resolved dependency', {
        originalDep: dep,
        resolvedId,
        currentStepIndex: currentStepIndex + 1,
      });
    } else {
      logger.warn('Could not resolve dependency', {
        dep,
        currentStepIndex: currentStepIndex + 1,
        availableSteps: allSteps.map((s, i) => ({
          id: `step_${i + 1}`,
          action: s.action,
        })),
      });
    }
  }

  return resolvedDeps;
}

/**
 * Parses the LLM response into an ExecutionPlan
 */
function parseExecutionPlan(
  responseText: string,
  userIntent: string,
): ExecutionPlan {
  try {
    // Clean the response text
    const cleanedText = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed = JSON.parse(cleanedText) as any;

    // Validate required fields
    if (!parsed.steps || !Array.isArray(parsed.steps)) {
      throw new Error('Invalid steps array');
    }

    // Generate unique IDs for plan and steps
    const planId = `plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const steps: ExecutionStep[] = parsed.steps.map(
      (
        step: {
          action?: string;
          parameters?: Record<string, unknown>;
          description?: string;
          dependencies?: string[];
          requiresApproval?: boolean;
          fallbackAction?: string;
          successCriteria?: string;
        },
        index: number,
      ) => {
        const originalDependencies = Array.isArray(step.dependencies)
          ? step.dependencies
          : [];
        const resolvedDependencies =
          originalDependencies.length > 0
            ? resolveDependencies(originalDependencies, parsed.steps, index)
            : [];

        const stepObj = {
          id: `step_${index + 1}`,
          action: step.action || 'unknown',
          parameters: step.parameters || {},
          description: step.description || 'No description',
          successCriteria: step.successCriteria || 'Step completed',
          requiresApproval: Boolean(step.requiresApproval),
          dependencies: resolvedDependencies,
          fallbackAction: step.fallbackAction || 'Retry or skip step',
          status: 'pending' as const,
          timestamp: Date.now(),
          duration: undefined,
        };

        logger.info('Generated step with dependencies', {
          stepId: stepObj.id,
          action: stepObj.action,
          description: stepObj.description,
          originalDependencies,
          processedDependencies: resolvedDependencies,
        });

        return stepObj;
      },
    );

    const plan: ExecutionPlan = {
      id: planId,
      userIntent: parsed.userIntent || userIntent,
      complexity: ['compound', 'complex'].includes(parsed.complexity)
        ? parsed.complexity
        : 'complex',
      steps,
      estimatedDuration: parsed.estimatedDuration || 'Unknown',
      riskLevel: ['low', 'medium', 'high'].includes(parsed.riskLevel)
        ? parsed.riskLevel
        : 'medium',
      requiresApproval: Boolean(
        parsed.requiresApproval || steps.some((s) => s.requiresApproval),
      ),
      createdAt: Date.now(),
    };

    return plan;
  } catch (error) {
    logger.warn('Failed to parse execution plan response', {
      error,
      responseText: responseText.substring(0, 500),
    });

    // Return fallback plan
    return createFallbackPlan(userIntent);
  }
}

/**
 * Creates a simple fallback plan when parsing fails
 */
function createFallbackPlan(userIntent: string): ExecutionPlan {
  const planId = `fallback_${Date.now()}`;

  return {
    id: planId,
    userIntent,
    complexity: 'complex',
    steps: [
      {
        id: 'step_1',
        action: 'analysis',
        parameters: {},
        description: 'Analyze current todos and requirements',
        successCriteria: 'Understanding of current state achieved',
        requiresApproval: false,
        dependencies: [],
        fallbackAction: 'Continue with best effort',
        status: 'pending',
        timestamp: Date.now(),
      },
      {
        id: 'step_2',
        action: 'create_todo',
        parameters: {
          title: 'Process complex request',
          description: userIntent,
        },
        description: 'Create todo to track this complex request',
        successCriteria: 'Todo created successfully',
        requiresApproval: false,
        dependencies: ['step_1'],
        fallbackAction: 'Continue without tracking todo',
        status: 'pending',
        timestamp: Date.now(),
      },
    ],
    estimatedDuration: '1-2 minutes',
    riskLevel: 'low',
    requiresApproval: false,
    createdAt: Date.now(),
  };
}

/**
 * Generates a user-friendly preview of the execution plan
 */
function generatePlanPreview(plan: ExecutionPlan): string {
  const approvalIcon = plan.requiresApproval ? '⚠️' : '✅';
  const riskIcon =
    plan.riskLevel === 'high'
      ? '🔴'
      : plan.riskLevel === 'medium'
        ? '🟡'
        : '🟢';

  let preview = `📋 **Execution Plan Created**\n\n`;
  preview += `**Goal:** ${plan.userIntent}\n`;
  preview += `**Complexity:** ${plan.complexity}\n`;
  preview += `**Estimated Time:** ${plan.estimatedDuration}\n`;
  preview += `**Risk Level:** ${riskIcon} ${plan.riskLevel}\n`;
  preview += `**Requires Approval:** ${approvalIcon} ${plan.requiresApproval ? 'Yes' : 'No'}\n\n`;

  preview += `**Steps (${plan.steps.length}):**\n`;
  plan.steps.forEach((step, index) => {
    const stepIcon = step.requiresApproval ? '⚠️' : '📝';
    preview += `${index + 1}. ${stepIcon} ${step.description}\n`;
  });

  if (plan.requiresApproval) {
    preview += `\n⚠️ **This plan includes destructive operations that require your approval before execution.**\n`;
  }

  preview += `\nReady to execute? The system will proceed step by step and provide updates.`;

  return preview;
}
