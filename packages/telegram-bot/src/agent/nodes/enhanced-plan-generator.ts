import { ChatAnthropic } from '@langchain/anthropic';
import { v4 as uuidv4 } from 'uuid';

import { logger } from '../../utils/logger.js';
import type {
  EnhancedWorkflowStateType,
  ExecutionPlan,
  PlanStep,
  TaskAnalysis,
} from '../enhanced-workflow-state.js';

/**
 * Plan Generation Node - Phase 2 of Intent → Plan → Execute → Reflect
 * Creates detailed execution plans for compound and complex tasks
 */
export async function generatePlan(
  state: EnhancedWorkflowStateType,
): Promise<Partial<EnhancedWorkflowStateType>> {
  const startTime = Date.now();

  logger.info('Starting plan generation', {
    userId: state.userId,
    classification: state.taskAnalysis?.classification,
    estimatedSteps: state.taskAnalysis?.estimatedSteps,
  });

  try {
    // Skip planning for simple tasks
    if (state.taskAnalysis?.classification === 'simple') {
      const simplePlan: ExecutionPlan = {
        id: uuidv4(),
        userIntent: state.userIntent || '',
        steps: [
          {
            id: uuidv4(),
            action: 'execute_simple_task',
            parameters: { userIntent: state.userIntent },
            description: 'Execute simple task directly',
            dependencies: [],
            requiresApproval: false,
            riskLevel: 'low',
          },
        ],
        requiresApproval: false,
        riskLevel: 'low',
        estimatedDuration: '< 1 minute',
      };

      logger.info('Generated simple plan (no AI planning needed)', {
        userId: state.userId,
        planId: simplePlan.id,
      });

      return { executionPlan: simplePlan };
    }

    const model = new ChatAnthropic({
      model: 'claude-3-sonnet-20240229',
      temperature: 0.3,
      maxTokens: 2000,
    });

    const planningPrompt = `Create a detailed execution plan for this todo management task.

User Intent: "${state.userIntent}"
Task Analysis: ${JSON.stringify(state.taskAnalysis, null, 2)}

Available MCP Actions:
- list_todos: Get todos with filters (context, status, tags, due_date)
  Parameters: { context?, status?, tags?, due_date?, limit? }
- create_todo: Create new todo
  Parameters: { title, description?, context?, due_date?, tags?, repeat? }
- update_todo: Update existing todo
  Parameters: { id, title?, description?, context?, due_date?, tags?, repeat? }
- delete_todo: Delete todo by ID
  Parameters: { id }
- toggle_completion: Mark todo complete/incomplete
  Parameters: { id }
- start_time_tracking: Start timer for todo
  Parameters: { id }
- stop_time_tracking: Stop timer for todo
  Parameters: { id }
- get_time_summary: Get time tracking summary
  Parameters: { context?, date_range? }

Guidelines:
1. Break down the task into atomic, sequential steps
2. Each step should use exactly one MCP action
3. Include clear success criteria for each step
4. Consider dependencies between steps
5. Flag destructive operations (deletions, bulk updates) for approval
6. Provide meaningful descriptions for each step

Create a step-by-step plan in JSON format:
{
  "id": "plan_uuid",
  "userIntent": "original user request",
  "steps": [
    {
      "id": "step_uuid",
      "action": "mcp_action_name",
      "parameters": {"key": "value"},
      "description": "Clear description of what this step does",
      "dependencies": ["previous_step_id"],
      "requiresApproval": boolean,
      "riskLevel": "low|medium|high"
    }
  ],
  "requiresApproval": boolean,
  "riskLevel": "low|medium|high",
  "estimatedDuration": "time estimate"
}`;

    const response = await model.invoke([
      { role: 'user', content: planningPrompt },
    ]);

    // Parse the JSON response
    let planData: Partial<ExecutionPlan>;
    try {
      const content = response.content as string;
      planData = JSON.parse(content);
    } catch (parseError) {
      logger.warn('Failed to parse plan JSON, creating fallback plan', {
        parseError,
        content: response.content,
      });

      // Create a fallback plan
      planData = createFallbackPlan(state.userIntent || '', state.taskAnalysis);
    }

    // Validate and enhance the plan
    const plan = validateAndEnhancePlan(planData, state.userIntent || '');

    const duration = Date.now() - startTime;

    logger.info('Plan generation completed', {
      userId: state.userId,
      planId: plan.id,
      stepCount: plan.steps.length,
      requiresApproval: plan.requiresApproval,
      riskLevel: plan.riskLevel,
      duration,
    });

    return {
      executionPlan: plan,
      sessionContext: {
        ...state.sessionContext,
        lastPlanId: plan.id,
        lastPlanTime: Date.now(),
      },
    };
  } catch (error) {
    const duration = Date.now() - startTime;

    logger.error('Plan generation failed', {
      error,
      userId: state.userId,
      duration,
      classification: state.taskAnalysis?.classification,
    });

    // Return fallback plan on error
    const fallbackPlan = createFallbackPlan(
      state.userIntent || '',
      state.taskAnalysis,
    );

    return {
      executionPlan: fallbackPlan,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

/**
 * Creates a fallback plan when AI planning fails
 */
function createFallbackPlan(
  userIntent: string,
  taskAnalysis?: TaskAnalysis,
): ExecutionPlan {
  const planId = uuidv4();

  return {
    id: planId,
    userIntent,
    steps: [
      {
        id: uuidv4(),
        action: 'list_todos',
        parameters: {},
        description: 'List existing todos to understand current state',
        dependencies: [],
        requiresApproval: false,
        riskLevel: 'low',
      },
      {
        id: uuidv4(),
        action: 'execute_fallback_task',
        parameters: { userIntent },
        description: 'Execute task using fallback method',
        dependencies: [],
        requiresApproval: taskAnalysis?.riskLevel === 'high',
        riskLevel: taskAnalysis?.riskLevel || 'low',
      },
    ],
    requiresApproval: taskAnalysis?.requiresApproval || false,
    riskLevel: taskAnalysis?.riskLevel || 'low',
    estimatedDuration: '2-3 minutes',
  };
}

/**
 * Validates and enhances a plan with proper IDs and safety checks
 */
function validateAndEnhancePlan(
  planData: Partial<ExecutionPlan>,
  userIntent: string,
): ExecutionPlan {
  const planId = planData.id || uuidv4();

  // Validate and enhance steps
  const steps: PlanStep[] = (planData.steps || [])
    .map((step, index) => validateStep(step, index))
    .filter(Boolean) as PlanStep[];

  // Ensure we have at least one step
  if (steps.length === 0) {
    steps.push({
      id: uuidv4(),
      action: 'execute_simple_task',
      parameters: { userIntent },
      description: 'Execute the requested task',
      dependencies: [],
      requiresApproval: false,
      riskLevel: 'low',
    });
  }

  // Determine overall plan risk and approval requirements
  const hasHighRiskSteps = steps.some((step) => step.riskLevel === 'high');
  const hasApprovalSteps = steps.some((step) => step.requiresApproval);

  return {
    id: planId,
    userIntent: planData.userIntent || userIntent,
    steps,
    requiresApproval: planData.requiresApproval || hasApprovalSteps,
    riskLevel: hasHighRiskSteps
      ? 'high'
      : steps.some((step) => step.riskLevel === 'medium')
        ? 'medium'
        : 'low',
    estimatedDuration: planData.estimatedDuration || estimateDuration(steps),
  };
}

/**
 * Validates and enhances an individual step
 */
function validateStep(step: Partial<PlanStep>, index: number): PlanStep | null {
  if (!step.action) {
    logger.warn('Step missing action, skipping', { step, index });
    return null;
  }

  return {
    id: step.id || uuidv4(),
    action: step.action,
    parameters: step.parameters || {},
    description:
      step.description || `Execute ${step.action} (step ${index + 1})`,
    dependencies: Array.isArray(step.dependencies) ? step.dependencies : [],
    requiresApproval: Boolean(step.requiresApproval),
    riskLevel:
      step.riskLevel && ['low', 'medium', 'high'].includes(step.riskLevel)
        ? step.riskLevel
        : 'low',
  };
}

/**
 * Estimates execution duration based on step count and complexity
 */
function estimateDuration(steps: PlanStep[]): string {
  const stepCount = steps.length;

  if (stepCount <= 1) return '< 1 minute';
  if (stepCount <= 3) return '1-2 minutes';
  if (stepCount <= 5) return '2-5 minutes';
  if (stepCount <= 10) return '5-10 minutes';

  return '> 10 minutes';
}
