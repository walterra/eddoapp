import Anthropic from '@anthropic-ai/sdk';

import { appConfig } from '../../utils/config.js';
import { logger } from '../../utils/logger.js';
import type {
  TaskComplexityAnalysis,
  WorkflowNode,
  WorkflowState,
} from '../types/workflow-types.js';

/**
 * LLM-based task complexity analyzer node
 */
export const analyzeTaskComplexity: WorkflowNode = async (
  state: WorkflowState,
): Promise<Partial<WorkflowState>> => {
  logger.info('Analyzing task complexity', {
    userId: state.userId,
    message: state.userMessage,
  });

  try {
    const analysis = await performComplexityAnalysis(
      state.userMessage,
      state.sessionContext,
    );

    logger.info('Task complexity analysis completed', {
      userId: state.userId,
      classification: analysis.classification,
      confidence: analysis.confidence,
      requiresApproval: analysis.requiresApproval,
    });

    return {
      complexityAnalysis: analysis,
      // Update session context based on analysis
      sessionContext: {
        ...state.sessionContext,
        lastComplexityAnalysis: analysis.classification,
      },
    };
  } catch (error) {
    logger.error('Failed to analyze task complexity', {
      error,
      userId: state.userId,
      message: state.userMessage,
    });

    // Fallback to simple classification on error
    const fallbackAnalysis: TaskComplexityAnalysis = {
      classification: 'simple',
      reasoning: 'Failed to analyze complexity, defaulting to simple execution',
      confidence: 0.5,
      requiresApproval: false,
      estimatedSteps: 1,
      riskLevel: 'low',
    };

    return {
      complexityAnalysis: fallbackAnalysis,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
};

/**
 * Performs LLM-based complexity analysis
 */
async function performComplexityAnalysis(
  userMessage: string,
  sessionContext: WorkflowState['sessionContext'],
): Promise<TaskComplexityAnalysis> {
  const client = new Anthropic({ apiKey: appConfig.ANTHROPIC_API_KEY });

  const prompt = buildComplexityAnalysisPrompt(userMessage, sessionContext);

  const response = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 500,
    temperature: 0.2, // Low temperature for consistent classification
    system: prompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }

  return parseComplexityResponse(content.text);
}

/**
 * Builds the system prompt for complexity analysis
 */
function buildComplexityAnalysisPrompt(
  userMessage: string,
  sessionContext: WorkflowState['sessionContext'],
): string {
  return `You are a task complexity analyzer for a todo management system with MCP server integration.

TASK CLASSIFICATION RULES:

**SIMPLE**: Single atomic action, no dependencies or planning needed
- Examples: "Add buy milk to shopping list", "Mark dentist appointment complete", "Show my work todos"
- Characteristics: One clear action, immediate execution possible, no coordination required
- MCP Actions: Single create_todo, update_todo, list_todos, delete_todo, toggle_completion call

**COMPOUND**: 2-3 related steps with clear sequence and dependencies  
- Examples: "Schedule team meeting for next week", "Add grocery shopping and set reminder", "Update project status and notify team", "Start working on the leaky faucet", "Let's begin with the budget spreadsheet"
- Characteristics: Multiple related actions, some dependencies, manageable sequence, may need to search for existing items first
- MCP Actions: 2-3 coordinated calls, may need list_todos → create_todo pattern, or list_todos → start_timer pattern

**COMPLEX**: Multi-step workflow requiring planning, analysis, or extensive coordination
- Examples: "Clean up my todo list", "Organize my tasks by priority", "Plan my weekly schedule", "Review overdue items and reschedule"
- Characteristics: Requires analysis/discovery, multiple decision points, user input/approval needed
- MCP Actions: Multiple list operations, bulk updates/deletes, requires user confirmation

CONTEXT:
- User has ${sessionContext.todoCount || 'unknown'} todos currently
- Last activity: ${sessionContext.lastActivity || 'none'}
- Common contexts: ${sessionContext.commonContexts?.join(', ') || 'work, personal, shopping, health'}

AVAILABLE MCP ACTIONS FOR REFERENCE:
- list_todos(filters?) - Get todos with optional filters (context, completed, dateRange)
- create_todo(title, description?, context?, due?, tags?) - Create new todo
- update_todo(id, fields) - Update existing todo fields
- delete_todo(id) - Delete specific todo
- toggle_completion(id, completed) - Mark todo as complete/incomplete
- start_time_tracking(id) - Start timer for todo (requires todo ID, may need list_todos first to find ID)
- stop_time_tracking(id) - Stop timer for todo
- get_active_timers() - Get currently running timers

USER TASK: "${userMessage}"

Respond in valid JSON format only:
{
  "classification": "simple|compound|complex",
  "reasoning": "Brief explanation of why this classification (max 100 chars)",
  "confidence": 0.0-1.0,
  "suggestedSteps": ["step1", "step2", ...] (only for compound/complex, max 5 steps),
  "requiresApproval": boolean (true if destructive/bulk operations detected),
  "estimatedSteps": number (1-10),
  "riskLevel": "low|medium|high"
}`;
}

/**
 * Parses the LLM response into TaskComplexityAnalysis
 */
function parseComplexityResponse(responseText: string): TaskComplexityAnalysis {
  try {
    // Clean the response text (remove any markdown formatting)
    const cleanedText = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const parsed = JSON.parse(cleanedText);

    // Validate required fields
    if (
      !parsed.classification ||
      !['simple', 'compound', 'complex'].includes(parsed.classification)
    ) {
      throw new Error('Invalid classification value');
    }

    if (
      typeof parsed.confidence !== 'number' ||
      parsed.confidence < 0 ||
      parsed.confidence > 1
    ) {
      throw new Error('Invalid confidence value');
    }

    if (
      typeof parsed.estimatedSteps !== 'number' ||
      parsed.estimatedSteps < 1
    ) {
      throw new Error('Invalid estimatedSteps value');
    }

    // Ensure required boolean fields
    const requiresApproval = Boolean(parsed.requiresApproval);

    // Validate risk level
    const riskLevel = ['low', 'medium', 'high'].includes(parsed.riskLevel)
      ? parsed.riskLevel
      : 'low';

    return {
      classification: parsed.classification,
      reasoning: String(parsed.reasoning || 'No reasoning provided'),
      confidence: parsed.confidence,
      suggestedSteps: Array.isArray(parsed.suggestedSteps)
        ? parsed.suggestedSteps
        : [],
      requiresApproval,
      estimatedSteps: parsed.estimatedSteps,
      riskLevel,
    };
  } catch (error) {
    logger.warn('Failed to parse complexity analysis response', {
      error,
      responseText,
    });

    // Return conservative fallback
    return {
      classification: 'simple',
      reasoning: 'Failed to parse analysis, defaulting to simple',
      confidence: 0.3,
      requiresApproval: false,
      estimatedSteps: 1,
      riskLevel: 'low',
    };
  }
}
