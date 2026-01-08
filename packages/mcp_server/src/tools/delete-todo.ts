/**
 * Delete Todo Tool - Permanently deletes a todo
 */
import type { TodoAlpha3 } from '@eddo/core-server';
import { z } from 'zod';

import { logMcpAudit } from './audit-helper.js';
import { createErrorResponse, createSuccessResponse } from './response-helpers.js';
import type { GetUserDb, ToolContext } from './types.js';

/** Tool description for LLM consumption */
export const deleteTodoDescription = 'Delete a todo permanently';

/** Zod schema for deleteTodo parameters */
export const deleteTodoParameters = z.object({
  id: z
    .string()
    .describe('The unique identifier of the todo to delete (ISO timestamp of creation)'),
});

export type DeleteTodoArgs = z.infer<typeof deleteTodoParameters>;

/**
 * Execute handler for deleteTodo tool
 */
export async function executeDeleteTodo(
  args: DeleteTodoArgs,
  context: ToolContext,
  getUserDb: GetUserDb,
): Promise<string> {
  const db = getUserDb(context);

  context.log.info('Deleting todo for user', {
    userId: context.session?.userId,
    todoId: args.id,
  });

  try {
    const todo = (await db.get(args.id)) as TodoAlpha3;
    context.log.debug('Retrieved todo for deletion', { title: todo.title });

    const startTime = Date.now();
    await db.destroy(todo._id, todo._rev!);
    const executionTime = Date.now() - startTime;

    // Log audit entry
    await logMcpAudit(context, {
      action: 'delete',
      entityId: todo._id,
      before: todo,
    });

    context.log.info('Todo deleted successfully', { title: todo.title });

    return createSuccessResponse({
      summary: 'Todo deleted successfully',
      data: {
        id: todo._id,
        title: todo.title,
        deleted_at: new Date().toISOString(),
      },
      operation: 'delete',
      executionTime,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    context.log.error('Failed to delete todo', { id: args.id, error: message });

    return createErrorResponse({
      summary: 'Failed to delete todo',
      error,
      operation: 'delete',
      recoverySuggestions: [
        'Verify the todo ID exists using listTodos',
        'Check if database connection is active',
        'Ensure you have permission to delete this todo',
      ],
    });
  }
}
