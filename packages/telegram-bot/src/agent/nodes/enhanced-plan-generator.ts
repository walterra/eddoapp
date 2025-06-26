import { ChatAnthropic } from '@langchain/anthropic';
import { v4 as uuidv4 } from 'uuid';

import type { ActionRegistry } from '../../services/action-registry.js';
import { appConfig } from '../../utils/config.js';
import { logger } from '../../utils/logger.js';
import type {
  EnhancedWorkflowStateType,
  ExecutionPlan,
  PlanStep,
  TaskAnalysis,
} from '../enhanced-workflow-state.js';

/**
 * Generate dynamic action list for planning prompts
 */
function generateActionListForPrompt(
  actionRegistry: ActionRegistry | null,
): string {
  if (!actionRegistry || !actionRegistry.isInitialized()) {
    logger.warn('ActionRegistry not available for prompt generation, using minimal fallback');
    // Minimal fallback when registry is not available
    return `- listTodos: Get todos with optional filters
- createTodo: Create new todo with title and optional properties
- updateTodo: Update existing todo by ID
- toggleTodoCompletion: Mark todo as completed or incomplete
- startTimeTracking: Start time tracking for a todo
- stopTimeTracking: Stop active time tracking`;
  }

  // Generate dynamic list from ActionRegistry with proper parameter schemas
  const actions = actionRegistry.getAvailableActions();
  logger.debug('Generating action list from registry', { actionCount: actions.length });
  
  return actions
    .map((action) => {
      const metadata = actionRegistry.getActionMetadata(action);
      if (!metadata) return null;
      
      // Get tool name to understand parameters
      const toolName = actionRegistry.getToolNameForAction(action);
      let paramInfo = '';
      
      // Add basic parameter guidance based on action type
      if (action.toLowerCase().includes('list')) {
        paramInfo = ' (optional: context, completed, dateFrom, dateTo, limit)';
      } else if (action.toLowerCase().includes('create')) {
        paramInfo = ' (required: title; optional: description, context, due, tags, repeat, link)';
      } else if (action.toLowerCase().includes('update')) {
        paramInfo = ' (required: id; optional: title, description, context, due, tags, repeat, link)';
      } else if (action.toLowerCase().includes('delete') || action.toLowerCase().includes('toggle')) {
        paramInfo = ' (required: id)';
      } else if (action.toLowerCase().includes('tracking')) {
        paramInfo = ' (required: id for start/stop; none for getActive)';
      }
      
      return `- ${action}: ${metadata.description || 'No description'}${paramInfo}`;
    })
    .filter(Boolean)
    .join('\n');
}

/**
 * Plan Generation Node - Phase 2 of Intent → Plan → Execute → Reflect
 * Creates detailed execution plans for compound and complex tasks
 */
export async function generatePlan(
  state: EnhancedWorkflowStateType,
  actionRegistry?: ActionRegistry | null,
): Promise<Partial<EnhancedWorkflowStateType>> {
  const startTime = Date.now();

  logger.info('Starting plan generation', {
    userId: state.userId,
    classification: state.taskAnalysis?.classification,
    estimatedSteps: state.taskAnalysis?.estimatedSteps,
  });

  try {
    // Skip planning for simple tasks - use extracted parameters from intent analysis
    if (state.taskAnalysis?.classification === 'simple') {
      let mcpAction: {
        action: string;
        parameters: Record<string, unknown>;
        description: string;
      };

      // Use extracted parameters from intent analysis if available
      if (state.taskAnalysis.extractedParameters) {
        mcpAction = {
          action: state.taskAnalysis.extractedParameters.action,
          parameters: state.taskAnalysis.extractedParameters.parameters,
          description: `Execute ${state.taskAnalysis.extractedParameters.action} with LLM-extracted parameters`,
        };

        logger.info('Using LLM-extracted parameters for simple plan', {
          userId: state.userId,
          action: mcpAction.action,
          parameters: mcpAction.parameters,
        });
      } else {
        // Fallback to dynamic inference using ActionRegistry if extraction failed
        mcpAction = inferMCPActionFromIntentDynamic(
          state.userIntent || '',
          actionRegistry,
        );

        logger.warn('Falling back to dynamic intent inference', {
          userId: state.userId,
          userIntent: state.userIntent,
          hasActionRegistry: !!actionRegistry,
        });
      }

      const simplePlan: ExecutionPlan = {
        id: uuidv4(),
        userIntent: state.userIntent || '',
        steps: [
          {
            id: uuidv4(),
            action: mcpAction.action,
            parameters: mcpAction.parameters,
            description: mcpAction.description,
            dependencies: [],
            requiresApproval: false,
            riskLevel: 'low',
          },
        ],
        requiresApproval: false,
        riskLevel: 'low',
        estimatedDuration: '< 1 minute',
      };

      logger.info('Generated simple plan using enhanced intent analysis', {
        userId: state.userId,
        planId: simplePlan.id,
        action: mcpAction.action,
        usedExtractedParams: !!state.taskAnalysis.extractedParameters,
      });

      return { executionPlan: simplePlan };
    }

    const model = new ChatAnthropic({
      model: appConfig.LLM_MODEL,
      temperature: 0.3,
      maxTokens: 2000,
    });

    const actionList = generateActionListForPrompt(actionRegistry || null);

    const planningPrompt = `Create a detailed execution plan for this todo management task.

User Intent: "${state.userIntent}"
Task Analysis: ${JSON.stringify(state.taskAnalysis, null, 2)}

Available MCP Actions:
${actionList}

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
    const plan = validateAndEnhancePlan(planData, state.userIntent || '', actionRegistry);

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
        action: 'listTodos',
        parameters: {},
        description: 'List existing todos to understand current state',
        dependencies: [],
        requiresApproval: false,
        riskLevel: 'low',
      },
      {
        id: uuidv4(),
        action: 'listTodos',
        parameters: { completed: false },
        description: 'List current todos to provide context',
        dependencies: [],
        requiresApproval: false,
        riskLevel: 'low',
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
  actionRegistry?: ActionRegistry | null,
): ExecutionPlan {
  const planId = planData.id || uuidv4();

  // Validate and enhance steps
  const steps: PlanStep[] = (planData.steps || [])
    .map((step, index) => validateStep(step, index))
    .filter(Boolean) as PlanStep[];

  // Ensure we have at least one step
  if (steps.length === 0) {
    const fallbackAction = inferMCPActionFromIntentDynamic(
      userIntent,
      actionRegistry,
    );
    steps.push({
      id: uuidv4(),
      action: fallbackAction.action,
      parameters: fallbackAction.parameters,
      description: fallbackAction.description,
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

/**
 * Dynamically infers MCP action using ActionRegistry instead of hard-coded patterns
 */
function inferMCPActionFromIntentDynamic(
  userIntent: string,
  actionRegistry?: ActionRegistry | null,
): {
  action: string;
  parameters: Record<string, unknown>;
  description: string;
} {
  const intent = userIntent.toLowerCase();

  if (!actionRegistry || !actionRegistry.isInitialized()) {
    logger.warn('ActionRegistry not available, using basic fallback', {
      userIntent: userIntent.substring(0, 50),
    });
    
    // Very basic fallback when ActionRegistry is not available
    if (intent.includes('list') || intent.includes('show') || intent.includes('summary')) {
      return {
        action: 'listTodos',
        parameters: { completed: false },
        description: 'List incomplete todos',
      };
    }
    
    if (intent.includes('create') || intent.includes('add')) {
      return {
        action: 'createTodo',
        parameters: { title: userIntent.replace(/create|add|new|todo/gi, '').trim() || 'New todo' },
        description: 'Create new todo',
      };
    }
    
    // Default fallback
    return {
      action: 'listTodos',
      parameters: {},
      description: 'Default action: list todos',
    };
  }

  // Use ActionRegistry to dynamically resolve intent patterns
  const availableActions = actionRegistry.getAvailableActions();
  logger.debug('Available actions from registry', { availableActions });

  // Look for action patterns in user intent
  for (const action of availableActions) {
    const metadata = actionRegistry.getActionMetadata(action);
    if (!metadata) continue;

    // Check if any aliases match the intent
    const allNames = [action, ...metadata.aliases];
    for (const name of allNames) {
      const normalizedName = name.toLowerCase().replace(/[_-]/g, ' ');
      if (intent.includes(normalizedName)) {
        logger.debug('Found matching action via registry', {
          userIntent: intent,
          matchedAction: action,
          matchedName: name,
        });

        // Infer basic parameters based on action type
        let parameters: Record<string, unknown> = {};
        if (action.toLowerCase().includes('list')) {
          parameters = { completed: false };
        } else if (action.toLowerCase().includes('create')) {
          parameters = { 
            title: userIntent.replace(/create|add|new|todo/gi, '').trim() || 'New todo' 
          };
        }

        return {
          action,
          parameters,
          description: metadata.description || `Execute ${action}`,
        };
      }
    }
  }

  // If no specific action found, default to list
  const listAction = availableActions.find(a => a.toLowerCase().includes('list'));
  if (listAction) {
    return {
      action: listAction,
      parameters: { completed: false },
      description: 'Default: List todos',
    };
  }

  // Ultimate fallback
  return {
    action: 'listTodos',
    parameters: {},
    description: 'Fallback action',
  };
}

/**
 * @deprecated Use inferMCPActionFromIntentDynamic instead
 * Legacy hard-coded inference function - kept for compatibility
 */
function inferMCPActionFromIntent(userIntent: string): {
  action: string;
  parameters: Record<string, unknown>;
  description: string;
} {
  const intent = userIntent.toLowerCase();

  // Daily summary requests
  if (
    intent.includes('daily summary') ||
    intent.includes('summary') ||
    intent.includes("what's my day")
  ) {
    return {
      action: 'listTodos',
      parameters: {
        completed: false,
      },
      description: 'Get daily summary of pending todos',
    };
  }

  // Status/overview requests
  if (
    intent.includes('status') ||
    intent.includes('overview') ||
    intent.includes("what's up")
  ) {
    return {
      action: 'listTodos',
      parameters: { completed: false },
      description: 'Get current todo status',
    };
  }

  // Create todo requests - basic fallback (LLM should handle parameter extraction)
  if (
    intent.includes('create') ||
    intent.includes('add') ||
    intent.includes('new todo')
  ) {
    logger.warn(
      'Using fallback createTodo - LLM parameter extraction should have handled this',
      {
        userIntent,
      },
    );
    return {
      action: 'createTodo',
      parameters: {
        title: userIntent
          .replace(/^(create|add|new)\s+(todo|task)\s*/i, '')
          .trim(),
        context: 'private',
      },
      description: 'Create new todo (fallback - parameter extraction bypassed)',
    };
  }

  // List todos requests
  if (
    intent.includes('list') ||
    intent.includes('show') ||
    intent.includes('todos')
  ) {
    return {
      action: 'listTodos',
      parameters: {},
      description: 'List todos',
    };
  }

  // Time tracking requests
  if (
    intent.includes('timer') ||
    intent.includes('time') ||
    intent.includes('tracking')
  ) {
    return {
      action: 'getActiveTimeTracking',
      parameters: {},
      description: 'Get active time tracking information',
    };
  }

  // Default fallback - list todos to understand current state
  return {
    action: 'list_todos',
    parameters: { completed: false },
    description: 'List current todos to understand user context',
  };
}
