/**
 * Time Tracking Tools - Start, stop, and query time tracking
 */
import type { TodoAlpha3 } from '@eddo/core-server';
import { z } from 'zod';

import { logMcpAudit, pushAuditIdToTodo } from './audit-helper.js';
import { createErrorResponse, createSuccessResponse } from './response-helpers.js';
import type { GetUserDb, ToolContext, ToolResponse } from './types.js';

// Start Time Tracking

/** Tool description for startTimeTracking */
export const startTimeTrackingDescription = 'Start tracking time for a todo';

/** Zod schema for startTimeTracking parameters */
export const startTimeTrackingParameters = z.object({
  id: z
    .string()
    .describe(
      'The unique identifier of the todo to start time tracking for (ISO timestamp of creation)',
    ),
  message: z
    .string()
    .optional()
    .describe(
      'Optional human-readable audit message describing why time tracking was started (short, like a git commit message).',
    ),
});

export type StartTimeTrackingArgs = z.infer<typeof startTimeTrackingParameters>;

/** Build success response for start time tracking */
function buildStartResponse(todo: TodoAlpha3, startedAt: string, executionTime: number): string {
  return createSuccessResponse({
    summary: 'Time tracking started',
    data: {
      id: todo._id,
      title: todo.title,
      started_at: startedAt,
      active_sessions: Object.keys(todo.active).length,
    },
    operation: 'start_time_tracking',
    executionTime,
  });
}

/** Execute handler for startTimeTracking tool */
export async function executeStartTimeTracking(
  args: StartTimeTrackingArgs,
  context: ToolContext,
  getUserDb: GetUserDb,
): Promise<string> {
  const db = getUserDb(context);
  context.log.info('Starting time tracking', { userId: context.session?.userId, todoId: args.id });

  try {
    const todo = (await db.get(args.id)) as TodoAlpha3;
    const originalTodo = { ...todo, active: { ...todo.active } };

    const now = new Date().toISOString();
    const startTime = Date.now();
    todo.active[now] = null;

    await db.insert(todo);
    const executionTime = Date.now() - startTime;

    const auditId = await logMcpAudit(context, {
      action: 'time_tracking_start',
      entityId: todo._id,
      before: originalTodo,
      after: todo,
      message: args.message,
    });
    if (auditId) {
      await pushAuditIdToTodo(db, todo._id, auditId, context);
    }
    context.log.info('Time tracking started', { title: todo.title, startTime: now });

    return buildStartResponse(todo, now, executionTime);
  } catch (error) {
    context.log.error('Failed to start time tracking', { id: args.id, error: String(error) });
    return createErrorResponse({
      summary: 'Failed to start time tracking',
      error,
      operation: 'start_time_tracking',
      recoverySuggestions: ['Verify the todo ID exists', 'Check database connection'],
    });
  }
}

// Stop Time Tracking

/** Tool description for stopTimeTracking */
export const stopTimeTrackingDescription = 'Stop tracking time for a todo';

/** Zod schema for stopTimeTracking parameters */
export const stopTimeTrackingParameters = z.object({
  id: z
    .string()
    .describe(
      'The unique identifier of the todo to stop time tracking for (ISO timestamp of creation)',
    ),
  message: z
    .string()
    .optional()
    .describe(
      'Optional human-readable audit message describing why time tracking was stopped (short, like a git commit message).',
    ),
});

export type StopTimeTrackingArgs = z.infer<typeof stopTimeTrackingParameters>;

/**
 * Formats duration in milliseconds to human-readable string
 */
function formatDuration(durationMs: number): string {
  const minutes = Math.floor(durationMs / 60000);
  const seconds = Math.floor((durationMs % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

/**
 * Creates response for successfully stopped time tracking session
 */
function createStopSuccessResponse(
  todo: TodoAlpha3,
  sessionStart: string,
  now: string,
  executionTime: number,
): string {
  const duration = new Date(now).getTime() - new Date(sessionStart).getTime();

  return createSuccessResponse({
    summary: 'Time tracking stopped',
    data: {
      id: todo._id,
      title: todo.title,
      session: {
        started_at: sessionStart,
        ended_at: now,
        duration_ms: duration,
        duration_formatted: formatDuration(duration),
      },
    },
    operation: 'stop_time_tracking',
    executionTime,
  });
}

/**
 * Creates response when no active session was found
 */
function createNoActiveSessionResponse(todo: TodoAlpha3): string {
  const response: ToolResponse = {
    summary: 'No active time tracking found',
    data: { id: todo._id, title: todo.title, active_sessions: 0 },
    metadata: {
      operation: 'stop_time_tracking',
      timestamp: new Date().toISOString(),
      result: 'no_active_session',
    },
  };
  return JSON.stringify(response);
}

/** Params for processStopSession */
interface StopSessionParams {
  todo: TodoAlpha3;
  originalTodo: TodoAlpha3;
  sessionStart: string;
  now: string;
  db: ReturnType<GetUserDb>;
  context: ToolContext;
  message?: string;
}

/** Process active session and log audit */
async function processStopSession(params: StopSessionParams): Promise<number> {
  const { todo, originalTodo, sessionStart, now, db, context, message } = params;
  todo.active[sessionStart] = now;
  const startTime = Date.now();
  await db.insert(todo);
  const auditId = await logMcpAudit(context, {
    action: 'time_tracking_stop',
    entityId: todo._id,
    before: originalTodo,
    after: todo,
    message,
  });
  if (auditId) {
    await pushAuditIdToTodo(db, todo._id, auditId, context);
  }
  return Date.now() - startTime;
}

/** Execute handler for stopTimeTracking tool */
export async function executeStopTimeTracking(
  args: StopTimeTrackingArgs,
  context: ToolContext,
  getUserDb: GetUserDb,
): Promise<string> {
  const db = getUserDb(context);
  context.log.info('Stopping time tracking', { userId: context.session?.userId, todoId: args.id });

  try {
    const todo = (await db.get(args.id)) as TodoAlpha3;
    const originalTodo = { ...todo, active: { ...todo.active } };
    const now = new Date().toISOString();

    const activeSession = Object.entries(todo.active).find(([_, end]) => end === null);
    if (!activeSession) {
      context.log.warn('No active time tracking found', { title: todo.title });
      return createNoActiveSessionResponse(todo);
    }

    const sessionStart = activeSession[0];
    const executionTime = await processStopSession({
      todo,
      originalTodo,
      sessionStart,
      now,
      db,
      context,
      message: args.message,
    });
    context.log.info('Time tracking stopped', { title: todo.title, sessionStart, endTime: now });

    return createStopSuccessResponse(todo, sessionStart, now, executionTime);
  } catch (error) {
    context.log.error('Failed to stop time tracking', { id: args.id, error: String(error) });
    return createErrorResponse({
      summary: 'Failed to stop time tracking',
      error,
      operation: 'stop_time_tracking',
      recoverySuggestions: ['Verify the todo ID exists', 'Check for active time tracking'],
    });
  }
}

// Get Active Time Tracking

/** Tool description for getActiveTimeTracking */
export const getActiveTimeTrackingDescription = 'Get todos with active time tracking';

/** Zod schema for getActiveTimeTracking parameters */
export const getActiveTimeTrackingParameters = z
  .object({})
  .describe('No parameters required - returns all todos with active time tracking');

/**
 * Deduplicates todos from view results
 */
function deduplicateTodos(rows: Array<{ doc?: TodoAlpha3 | null | undefined }>): TodoAlpha3[] {
  const seenIds = new Set<string>();
  return rows
    .map((row) => row.doc)
    .filter((doc): doc is TodoAlpha3 => {
      if (!doc || seenIds.has(doc._id)) return false;
      seenIds.add(doc._id);
      return true;
    });
}

/**
 * Execute handler for getActiveTimeTracking tool
 */
export async function executeGetActiveTimeTracking(
  _args: Record<string, never>,
  context: ToolContext,
  getUserDb: GetUserDb,
): Promise<string> {
  const db = getUserDb(context);

  context.log.info('Retrieving active time tracking todos for user', {
    userId: context.session?.userId,
  });

  try {
    const startTime = Date.now();
    const result = await db.view('todos_by_time_tracking_active', 'byTimeTrackingActive', {
      include_docs: true,
    });

    const activeTodos = deduplicateTodos(result.rows);
    const executionTime = Date.now() - startTime;

    context.log.info('Active time tracking todos retrieved', { count: activeTodos.length });

    return createSuccessResponse({
      summary: `Found ${activeTodos.length} todos with active time tracking`,
      data: activeTodos.map((todo) => ({
        ...todo,
        active_session_count: Object.values(todo.active).filter((end) => end === null).length,
      })),
      operation: 'get_active_time_tracking',
      executionTime,
      extra: {
        metadata: {
          execution_time: `${executionTime.toFixed(2)}ms`,
          operation: 'get_active_time_tracking',
          timestamp: new Date().toISOString(),
          active_count: activeTodos.length,
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    context.log.error('Failed to retrieve active time tracking todos', { error: message });

    return createErrorResponse({
      summary: 'Failed to retrieve active time tracking',
      error,
      operation: 'get_active_time_tracking',
      recoverySuggestions: [
        'Check if database connection is active',
        'Try listing todos first with listTodos',
        'Verify database initialization',
      ],
    });
  }
}
