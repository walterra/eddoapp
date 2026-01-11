/**
 * Update Todo Tool - Updates an existing todo
 */
import type { TodoAlpha3 } from '@eddo/core-server';
import { z } from 'zod';

import { logMcpAudit, pushAuditIdToTodo } from './audit-helper.js';
import { createErrorResponse, createSuccessResponse } from './response-helpers.js';
import type { GetUserDb, ToolContext } from './types.js';

/** Tool description for LLM consumption */
export const updateTodoDescription = `Update an existing todo CouchDB style. Before updating, find the todo using listTodos to determine the ID.

IMPORTANT: Pass update fields directly as parameters, NOT wrapped in nested objects.`;

/** Zod schema for updateTodo parameters */
export const updateTodoParameters = z.object({
  id: z
    .string()
    .describe('The unique identifier of the todo to update (ISO timestamp of creation)'),
  title: z.string().optional().describe('Updated title/name of the todo item'),
  description: z.string().optional().describe('Updated description or notes'),
  context: z.string().optional().describe('Updated GTD context category'),
  due: z.string().optional().describe('Updated due date in ISO format'),
  tags: z.array(z.string()).optional().describe('Updated array of tags'),
  repeat: z
    .number()
    .nullable()
    .optional()
    .describe(
      'Updated repeat interval in days (null to disable). gtd:calendar repeats from due date, gtd:habit repeats from completion date',
    ),
  link: z.string().nullable().optional().describe('Updated URL or reference link (null to remove)'),
  externalId: z
    .string()
    .nullable()
    .optional()
    .describe(
      'Updated external system ID for syncing (e.g., "github:owner/repo/issues/123"). Used for deduplication during periodic imports. Set to null to remove.',
    ),
  parentId: z
    .string()
    .nullable()
    .optional()
    .describe('Updated parent todo ID (null to remove parent, making it a root todo)'),
  metadata: z
    .record(z.string(), z.union([z.string(), z.array(z.string())]))
    .optional()
    .describe(
      'Key-value metadata for extensibility. Values can be strings or arrays of strings. Use namespaced keys (e.g., "agent:worktree", "github:labels": ["bug", "priority"]). Replaces entire metadata object when provided.',
    ),
  message: z
    .string()
    .optional()
    .describe(
      'Optional human-readable audit message describing why this update was made (short, like a git commit message).',
    ),
});

export type UpdateTodoArgs = z.infer<typeof updateTodoParameters>;

/** Helper to pick value: use arg if defined, otherwise keep existing */
function pickValue<T>(argValue: T | undefined, existingValue: T): T {
  return argValue !== undefined ? argValue : existingValue;
}

/**
 * Normalize due date to full ISO format (YYYY-MM-DDTHH:mm:ss.sssZ).
 * Accepts:
 * - Full ISO: "2026-01-07T23:59:59.999Z" -> unchanged
 * - Date only: "2026-01-07" -> "2026-01-07T23:59:59.999Z"
 * - undefined -> returns undefined (no change)
 */
function normalizeDueDate(due: string | undefined): string | undefined {
  if (!due) {
    return undefined;
  }

  // Check if it's already a full ISO string (contains 'T')
  if (due.includes('T')) {
    return due;
  }

  // Date-only format (YYYY-MM-DD) -> add end of day time
  if (/^\d{4}-\d{2}-\d{2}$/.test(due)) {
    return due + 'T23:59:59.999Z';
  }

  // Invalid format - log warning and use as-is with time appended
  console.warn(`Invalid due date format: "${due}". Expected ISO format. Appending default time.`);
  return due + 'T23:59:59.999Z';
}

/**
 * Merges update arguments with existing todo
 */
function mergeUpdates(todo: TodoAlpha3, args: UpdateTodoArgs): TodoAlpha3 {
  const normalizedDue = normalizeDueDate(args.due);
  return {
    ...todo,
    title: args.title ?? todo.title,
    description: args.description ?? todo.description,
    context: args.context ?? todo.context,
    due: normalizedDue ?? todo.due,
    tags: args.tags ?? todo.tags,
    repeat: pickValue(args.repeat, todo.repeat),
    link: pickValue(args.link, todo.link),
    externalId: pickValue(args.externalId, todo.externalId),
    parentId: pickValue(args.parentId, todo.parentId),
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
    const todo = (await db.get(args.id)) as TodoAlpha3;
    const updated = mergeUpdates(todo, args);

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
