/**
 * State logging utilities for the agent
 */
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

import { logger } from '../../utils/logger.js';

import type { AgentState } from './types.js';

/**
 * Logs the final agent state to disk for debugging
 */
export async function logFinalAgentState(state: AgentState, iteration: number): Promise<void> {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logDir = join(process.cwd(), 'logs', 'agent-states');
    const filename = `agent-state-${timestamp}-iter${iteration}.json`;
    const filepath = join(logDir, filename);

    await mkdir(logDir, { recursive: true });

    const logData = {
      timestamp: new Date().toISOString(),
      iteration,
      finalState: state,
      metadata: {
        totalHistoryEntries: state.history.length,
        totalToolResults: state.toolResults.length,
        completed: state.done,
        hasOutput: !!state.output,
        hasSystemPrompt: !!state.systemPrompt,
        systemPromptLength: state.systemPrompt?.length || 0,
      },
    };

    await writeFile(filepath, JSON.stringify(logData, null, 2));

    logger.info('Final AgentState logged to disk', {
      filepath,
      iteration,
      historyEntries: state.history.length,
      toolResults: state.toolResults.length,
    });
  } catch (error) {
    logger.error('Failed to log final AgentState to disk', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
