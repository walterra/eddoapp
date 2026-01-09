/**
 * Toggle Todo Completion Tool - Marks todos as completed or uncompleted
 */
import type { TodoAlpha3 } from '@eddo/core-server';
import { getRepeatTodo } from '@eddo/core-server';
import { z } from 'zod';

import { logMcpAudit } from './audit-helper.js';
import { createErrorResponse, createSuccessResponse } from './response-helpers.js';
import type { GetUserDb, ToolContext } from './types.js';

/** Tool description for LLM consumption */
export const toggleCompletionDescription = `Mark a todo as completed or uncompleted

Usage examples:
- Mark as completed: {"id": "2025-06-19T10:30:00.000Z", "completed": true}
- Mark as incomplete: {"id": "2025-06-19T10:30:00.000Z", "completed": false}`;

/** Zod schema for toggleTodoCompletion parameters */
export const toggleCompletionParameters = z.object({
  id: z
    .string()
    .describe('The unique identifier of the todo to toggle (ISO timestamp of creation)'),
  completed: z.boolean().describe('true to mark as completed, false to mark as incomplete'),
  message: z
    .string()
    .optional()
    .describe(
      'Optional human-readable audit message describing why this was completed/uncompleted (short, like a git commit message).',
    ),
});

export type ToggleCompletionArgs = z.infer<typeof toggleCompletionParameters>;

/**
 * Handles completing a repeating todo by creating the next occurrence
 */
async function handleRepeatingTodo(
  todo: TodoAlpha3,
  db: ReturnType<GetUserDb>,
  context: ToolContext,
): Promise<string> {
  context.log.info('Creating repeat todo', { repeatDays: todo.repeat });

  const newTodo = getRepeatTodo(todo);

  const startTime = Date.now();
  await db.insert(newTodo as TodoAlpha3);
  await db.insert(todo);
  const executionTime = Date.now() - startTime;

  const repeatType = todo.tags.includes('gtd:calendar') ? 'calendar' : 'habit';

  context.log.info('Todo completed and repeated', {
    original: todo.title,
    newDue: newTodo.due,
    repeatType,
  });

  return createSuccessResponse({
    summary: 'Todo completed and repeated',
    data: {
      original_id: todo._id,
      original_title: todo.title,
      new_todo_id: newTodo._id,
      new_due_date: newTodo.due,
      repeat_interval: todo.repeat,
      repeat_type: repeatType,
    },
    operation: 'complete_and_repeat',
    executionTime,
  });
}

/**
 * Marks todo as completed and handles repeating logic
 */
async function markCompleted(
  todo: TodoAlpha3,
  db: ReturnType<GetUserDb>,
  context: ToolContext,
): Promise<string | null> {
  if (todo.completed) return null; // Already completed

  todo.completed = new Date().toISOString();
  context.log.info('Marking todo as completed', { title: todo.title });

  if (todo.repeat) {
    return handleRepeatingTodo(todo, db, context);
  }

  return null;
}

/** Parameters for saveAndRespond */
interface SaveAndRespondParams {
  todo: TodoAlpha3;
  originalTodo: TodoAlpha3;
  db: ReturnType<GetUserDb>;
  context: ToolContext;
  status: string;
  message?: string;
}

/** Saves the todo and returns the success response */
async function saveAndRespond(params: SaveAndRespondParams): Promise<string> {
  const { todo, originalTodo, db, context, status, message } = params;
  const startTime = Date.now();
  await db.insert(todo);
  const executionTime = Date.now() - startTime;

  // Log audit entry
  const action = status === 'completed' ? 'complete' : 'uncomplete';
  await logMcpAudit(context, {
    action,
    entityId: todo._id,
    before: originalTodo,
    after: todo,
    message,
  });

  context.log.info('Todo completion toggled successfully', { title: todo.title, status });

  return createSuccessResponse({
    summary: `Todo ${status} successfully`,
    data: { id: todo._id, title: todo.title, status, completed_at: todo.completed },
    operation: 'toggle_completion',
    executionTime,
  });
}

/**
 * Execute handler for toggleTodoCompletion tool
 */
export async function executeToggleCompletion(
  args: ToggleCompletionArgs,
  context: ToolContext,
  getUserDb: GetUserDb,
): Promise<string> {
  const db = getUserDb(context);

  context.log.info('Toggling todo completion for user', {
    userId: context.session?.userId,
    todoId: args.id,
    completed: args.completed,
  });

  try {
    const todo = (await db.get(args.id)) as TodoAlpha3;
    const originalTodo = { ...todo }; // Clone for audit
    context.log.debug('Retrieved todo for completion toggle', {
      title: todo.title,
      currentCompleted: todo.completed,
    });

    if (args.completed) {
      const repeatResult = await markCompleted(todo, db, context);
      if (repeatResult) return repeatResult;
    } else {
      todo.completed = null;
      context.log.info('Marking todo as uncompleted', { title: todo.title });
    }

    const status = args.completed ? 'completed' : 'uncompleted';
    return saveAndRespond({ todo, originalTodo, db, context, status, message: args.message });
  } catch (error) {
    return createErrorResponse({
      summary: 'Failed to toggle todo completion',
      error,
      operation: 'toggle_completion',
      recoverySuggestions: [
        'Verify the todo ID exists using listTodos',
        'Check if database connection is active',
        'Try refreshing the todo data',
      ],
    });
  }
}
