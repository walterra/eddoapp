/**
 * Get Todo Tool - Fetch a single todo by ID
 */
import type { TodoAlpha3 } from '@eddo/core-server';
import { z } from 'zod';

import { createErrorResponse, createSuccessResponse } from './response-helpers.js';
import type { GetUserDb, ToolContext } from './types.js';

/** Tool description for LLM consumption */
export const getTodoDescription =
  'Get a single todo by its ID with full details including description';

/** Zod schema for getTodo parameters */
export const getTodoParameters = z.object({
  id: z.string().describe('The unique identifier of the todo (ISO timestamp of creation)'),
});

export type GetTodoArgs = z.infer<typeof getTodoParameters>;

/**
 * Execute handler for getTodo tool
 */
export async function executeGetTodo(
  args: GetTodoArgs,
  context: ToolContext,
  getUserDb: GetUserDb,
): Promise<string> {
  const db = getUserDb(context);

  context.log.info('Getting todo for user', {
    userId: context.session?.userId,
    todoId: args.id,
  });

  try {
    const startTime = Date.now();
    const todo = (await db.get(args.id)) as TodoAlpha3;
    const executionTime = Date.now() - startTime;

    context.log.info('Todo retrieved successfully', { title: todo.title });

    return createSuccessResponse({
      summary: 'Todo retrieved successfully',
      data: todo,
      operation: 'get',
      executionTime,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    context.log.error('Failed to get todo', { id: args.id, error: message });

    const isNotFound = message.includes('missing') || message.includes('not_found');

    return createErrorResponse({
      summary: isNotFound ? 'Todo not found' : 'Failed to get todo',
      error,
      operation: 'get',
      recoverySuggestions: isNotFound
        ? [
            'Verify the todo ID is correct',
            'Use listTodos to find available todos',
            'The todo may have been deleted',
          ]
        : ['Check database connection', 'Verify authentication credentials'],
    });
  }
}
