import { ChatAnthropic } from '@langchain/anthropic';

import type { MCPClient } from '../../mcp/client.js';
import { createMCPInfoService } from '../../mcp/info-service.js';
import { logger } from '../../utils/logger.js';
import type {
  EnhancedWorkflowStateType,
  TaskAnalysis,
} from '../enhanced-workflow-state.js';

/**
 * Intent Analysis Node - Phase 1 of Intent → Plan → Execute → Reflect
 * Analyzes user intent and classifies task complexity following LangGraph examples
 */
export async function analyzeIntent(
  state: EnhancedWorkflowStateType,
  mcpClient?: MCPClient | null,
): Promise<Partial<EnhancedWorkflowStateType>> {
  const startTime = Date.now();

  logger.info('Starting intent analysis', {
    userId: state.userId,
    intentLength: state.userIntent?.length || 0,
  });

  try {
    const model = new ChatAnthropic({
      model: 'claude-3-5-sonnet-20241022',
      temperature: 0.2,
      maxTokens: 1000,
    });

    // Get dynamic MCP info
    const mcpInfoService = createMCPInfoService();
    const mcpInfo = mcpClient
      ? await mcpInfoService.formatMCPInfoForIntentAnalysis(
          await mcpInfoService.getMCPToolsInfo(mcpClient),
        )
      : await mcpInfoService.formatMCPInfoForIntentAnalysis([]);

    const analysisPrompt = `Analyze the user's intent and classify the task complexity for a todo management system with MCP integration.

User Intent: "${state.userIntent}"

${mcpInfo}

Classify the task complexity:
- simple: Single atomic action requiring one MCP call
- compound: 2-3 related steps with dependencies
- complex: Multi-step workflow requiring planning and coordination

Consider these factors:
1. Number of MCP operations required
2. Dependencies between operations
3. Risk of destructive actions (deletions, bulk updates)
4. Need for user confirmation
5. Complexity of parameter extraction

For simple createTodo tasks, include the extracted parameters in your response.

Respond in JSON format:
{
  "classification": "simple|compound|complex",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation of classification rationale with parameter extraction logic",
  "requiresApproval": boolean,
  "suggestedSteps": ["step1", "step2", ...],
  "riskLevel": "low|medium|high",
  "estimatedSteps": number,
  "extractedParameters": {
    "action": "mcpActionName",
    "parameters": { /* extracted MCP parameters for simple tasks */ }
  }
}`;

    const response = await model.invoke([
      { role: 'user', content: analysisPrompt },
    ]);

    // Parse the JSON response
    let analysis: TaskAnalysis;
    try {
      const content = response.content as string;
      analysis = JSON.parse(content);
    } catch (parseError) {
      logger.warn('Failed to parse analysis JSON, using fallback', {
        parseError,
        content: response.content,
      });

      // Fallback analysis based on simple heuristics
      analysis = {
        classification: 'simple',
        confidence: 0.5,
        reasoning: 'JSON parse failed, using fallback classification',
        requiresApproval: false,
        riskLevel: 'low',
        estimatedSteps: 1,
      };
    }

    // Validate and sanitize the analysis
    analysis = validateTaskAnalysis(analysis);

    const duration = Date.now() - startTime;

    logger.info('Intent analysis completed', {
      userId: state.userId,
      classification: analysis.classification,
      confidence: analysis.confidence,
      riskLevel: analysis.riskLevel,
      estimatedSteps: analysis.estimatedSteps,
      duration,
    });

    return {
      taskAnalysis: analysis,
      sessionContext: {
        ...state.sessionContext,
        lastAnalysisTime: Date.now(),
        lastClassification: analysis.classification,
      },
    };
  } catch (error) {
    const duration = Date.now() - startTime;

    logger.error('Intent analysis failed', {
      error,
      userId: state.userId,
      duration,
      userIntent: state.userIntent?.substring(0, 100),
    });

    // Return fallback analysis on error
    const fallbackAnalysis: TaskAnalysis = {
      classification: 'simple',
      confidence: 0.3,
      reasoning: 'Analysis failed, using safe fallback',
      requiresApproval: false,
      riskLevel: 'low',
      estimatedSteps: 1,
    };

    return {
      taskAnalysis: fallbackAnalysis,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

/**
 * Validates and sanitizes task analysis results
 */
function validateTaskAnalysis(analysis: Partial<TaskAnalysis>): TaskAnalysis {
  return {
    classification:
      analysis.classification &&
      ['simple', 'compound', 'complex'].includes(analysis.classification)
        ? analysis.classification
        : 'simple',
    confidence: Math.max(0, Math.min(1, analysis.confidence || 0.5)),
    reasoning: analysis.reasoning || 'No reasoning provided',
    requiresApproval: Boolean(analysis.requiresApproval),
    suggestedSteps: Array.isArray(analysis.suggestedSteps)
      ? analysis.suggestedSteps
      : [],
    riskLevel:
      analysis.riskLevel &&
      ['low', 'medium', 'high'].includes(analysis.riskLevel)
        ? analysis.riskLevel
        : 'low',
    estimatedSteps: Math.max(1, Math.min(20, analysis.estimatedSteps || 1)),
    extractedParameters: analysis.extractedParameters
      ? {
          action: analysis.extractedParameters.action || 'listTodos',
          parameters: analysis.extractedParameters.parameters || {},
        }
      : undefined,
  };
}
