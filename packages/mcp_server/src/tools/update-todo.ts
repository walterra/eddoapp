/**
 * Update Todo Tool - Updates an existing todo
 */
import type { TodoAlpha3 } from '@eddo/core-server';
import { z } from 'zod';

import { logMcpAudit } from './audit-helper.js';
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
  parentId: z
    .string()
    .nullable()
    .optional()
    .describe('Updated parent todo ID (null to remove parent, making it a root todo)'),
  metadata: z
    .record(z.string(), z.string())
    .optional()
    .describe(
      'Key-value metadata for extensibility. Use namespaced keys (e.g., "agent:worktree", "github:labels"). Replaces entire metadata object when provided.',
    ),
});

export type UpdateTodoArgs = z.infer<typeof updateTodoParameters>;

/**
 * Merges update arguments with existing todo
 */
function mergeUpdates(todo: TodoAlpha3, args: UpdateTodoArgs): TodoAlpha3 {
  return {
    ...todo,
    title: args.title ?? todo.title,
    description: args.description ?? todo.description,
    context: args.context ?? todo.context,
    due: args.due ?? todo.due,
    tags: args.tags ?? todo.tags,
    repeat: args.repeat !== undefined ? args.repeat : todo.repeat,
    link: args.link !== undefined ? args.link : todo.link,
    parentId: args.parentId !== undefined ? args.parentId : todo.parentId,
    metadata: args.metadata !== undefined ? args.metadata : todo.metadata,
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

    await logMcpAudit(context, {
      action: 'update',
      entityId: result.id,
      before: todo,
      after: updated,
    });
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
