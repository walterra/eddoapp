/**
 * Update Todo Tool - Updates an existing todo
 */
import { isValidTimeZone, normalizeTimeZone, type TodoAlpha4 } from '@eddo/core-server';
import {
  arr,
  map,
  nullable,
  num,
  obj,
  opt,
  str,
  union,
} from '@eddo/core-shared/validation/schema_parser';
import { toolField } from '../tool_field.js';
import { createToolParameters } from '../tool_parameters.js';

import { logMcpAudit, pushAuditIdToTodo } from './audit-helper.js';
import { createErrorResponse, createSuccessResponse } from './response-helpers.js';
import type { GetUserDb, ToolContext } from './types.js';

/** Tool description for LLM consumption */
export const updateTodoDescription = `Update an existing todo CouchDB style. Before updating, find the todo using listTodos to determine the ID.

IMPORTANT: Pass update fields directly as parameters, NOT wrapped in nested objects.`;

/** Validates and publishes updateTodo parameters. */
export const updateTodoParameters = createToolParameters(
  obj({
    id: str({
      description: 'The unique identifier of the todo to update (ISO timestamp of creation)',
    }),
    title: opt(toolField(str(), { description: 'Updated title/name of the todo item' })),
    description: opt(toolField(str(), { description: 'Updated description or notes' })),
    context: opt(toolField(str(), { description: 'Updated GTD context category' })),
    due: opt(toolField(str(), { description: 'Updated due date in YYYY-MM-DD format' })),
    scheduledTime: opt(
      toolField(nullable(str({ pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' })), {
        description: 'Updated scheduled local time in HH:mm format.',
      }),
    ),
    scheduledTimeZone: opt(
      toolField(nullable(str()), {
        description: 'Updated IANA timezone for scheduled time interpretation.',
      }),
    ),
    tags: opt(toolField(arr(str()), { description: 'Updated array of tags' })),
    repeat: opt(
      toolField(nullable(num()), {
        description:
          'Updated repeat interval in days (null to disable). gtd:calendar repeats from due date, gtd:habit repeats from completion date',
      }),
    ),
    link: opt(
      toolField(nullable(str()), { description: 'Updated URL or reference link (null to remove)' }),
    ),
    externalId: opt(
      toolField(nullable(str()), {
        description:
          'Updated external system ID for syncing (e.g., "github:owner/repo/issues/123"). Used for deduplication during periodic imports. Set to null to remove.',
      }),
    ),
    parentId: opt(
      toolField(nullable(str()), {
        description: 'Updated parent todo ID (null to remove parent, making it a root todo)',
      }),
    ),
    blockedBy: opt(
      toolField(nullable(arr(str())), {
        description:
          'Updated array of todo IDs that block this task. Use with gtd:blocked tag. Set to null or empty array to remove all blockers.',
      }),
    ),
    metadata: opt(
      toolField(map(union([str(), arr(str())])), {
        description:
          'Key-value metadata for extensibility. Values can be strings or arrays of strings. Use namespaced keys (e.g., "agent:worktree", "github:labels": ["bug", "priority"]). Replaces entire metadata object when provided.',
      }),
    ),
    message: opt(
      toolField(str(), {
        description:
          'Optional human-readable audit message describing why this update was made (short, like a git commit message).',
      }),
    ),
  }),
  {
    validate: (value) =>
      value.scheduledTimeZone === undefined ||
      value.scheduledTimeZone === null ||
      isValidTimeZone(value.scheduledTimeZone)
        ? []
        : [{ path: '/scheduledTimeZone', code: 'custom', message: 'Invalid IANA timezone' }],
  },
);

export type UpdateTodoArgs = ReturnType<typeof updateTodoParameters.parse>;

/** Helper to pick value: use arg if defined, otherwise keep existing */
function pickValue<T>(argValue: T | undefined, existingValue: T): T {
  return argValue !== undefined ? argValue : existingValue;
}

/**
 * Normalize due date to YYYY-MM-DD format.
 *
 * @param due Due date input.
 * @return Date-only due value.
 */
function normalizeDueDate(due: string | undefined): string | undefined {
  if (!due) {
    return undefined;
  }

  return due.slice(0, 10);
}

/**
 * Merges update arguments with existing todo
 */
function getScheduledTimeZone(
  todo: TodoAlpha4,
  args: UpdateTodoArgs,
  scheduledTime: string | null,
  timeZone?: string,
): string | null {
  if (!scheduledTime) return null;
  return pickValue(args.scheduledTimeZone, todo.scheduledTimeZone ?? normalizeTimeZone(timeZone));
}

function getBlockedBy(todo: TodoAlpha4, args: UpdateTodoArgs): string[] | undefined {
  if (args.blockedBy === null) return undefined;
  if (args.blockedBy !== undefined) return args.blockedBy;
  return todo.blockedBy;
}

function mergeUpdates(todo: TodoAlpha4, args: UpdateTodoArgs, timeZone?: string): TodoAlpha4 {
  const normalizedDue = normalizeDueDate(args.due);
  const scheduledTime = pickValue(args.scheduledTime, todo.scheduledTime ?? null);
  const scheduledTimeZone = getScheduledTimeZone(todo, args, scheduledTime, timeZone);

  return {
    ...todo,
    title: args.title ?? todo.title,
    description: args.description ?? todo.description,
    context: args.context ?? todo.context,
    due: normalizedDue ?? todo.due,
    scheduledTime,
    scheduledTimeZone,
    tags: args.tags ?? todo.tags,
    repeat: pickValue(args.repeat, todo.repeat),
    link: pickValue(args.link, todo.link),
    externalId: pickValue(args.externalId, todo.externalId),
    parentId: pickValue(args.parentId, todo.parentId),
    blockedBy: getBlockedBy(todo, args),
    metadata: pickValue(args.metadata, todo.metadata),
  };
}

/** Build success response for update */
function buildUpdateResponse(
  args: UpdateTodoArgs,
  resultId: string,
  title: string,
  executionTime: number,
): string {
  const changes = Object.keys(args).filter(
    (k) => args[k as keyof typeof args] !== undefined && k !== 'id',
  );
  return createSuccessResponse({
    summary: 'Todo updated successfully',
    data: { id: resultId, title, changes_made: changes },
    operation: 'update',
    executionTime,
  });
}

/** Execute handler for updateTodo tool */
export async function executeUpdateTodo(
  args: UpdateTodoArgs,
  context: ToolContext,
  getUserDb: GetUserDb,
): Promise<string> {
  const db = getUserDb(context);
  context.log.info('Updating todo for user', { userId: context.session?.userId, todoId: args.id });

  try {
    const todo = (await db.get(args.id)) as TodoAlpha4;
    const updated = mergeUpdates(todo, args, context.session?.timezone);

    const startTime = Date.now();
    const result = await db.insert(updated);
    const executionTime = Date.now() - startTime;

    const auditId = await logMcpAudit(context, {
      action: 'update',
      entityId: result.id,
      before: todo,
      after: updated,
      message: args.message,
    });
    if (auditId) {
      await pushAuditIdToTodo(db, result.id, auditId, context);
    }
    context.log.info('Todo updated successfully', { id: result.id, title: updated.title });

    return buildUpdateResponse(args, result.id, updated.title, executionTime);
  } catch (error) {
    return createErrorResponse({
      summary: 'Failed to update todo',
      error,
      operation: 'update',
      recoverySuggestions: [
        'Verify the todo ID exists using listTodos',
        'Check if database connection is active',
        'Ensure update data is valid',
      ],
    });
  }
}
