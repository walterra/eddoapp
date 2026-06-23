/**
 * Create Todo Tool - Creates a new todo item with GTD tag support
 */
import {
  extractScheduledTimeFromTitle,
  formatDateInTimeZone,
  isValidTimeZone,
  normalizeTimeZone,
  type TodoAlpha4,
} from '@eddo/core-server';
import { z } from 'zod';

import { logMcpAudit, pushAuditIdToTodo } from './audit-helper.js';
import { createErrorResponse, createSuccessResponse } from './response-helpers.js';
import type { CouchServer, GetUserDb, ToolContext } from './types.js';

/** Tool description for LLM consumption */
export const createTodoDescription = `Create a new todo item in the authenticated user's database with GTD tag support.

🧠 MEMORY SYSTEM - HIGHEST PRIORITY:
When the user asks to remember something, create a todo with:
- tags: ["user:memory"]
- title: Brief summary of what to remember
- description: Full details to remember
- context: "memory" (NOT "private" - ALWAYS "memory")
- due: Current date in YYYY-MM-DD format

Creates a TodoAlpha4 object with:
- Auto-generated ID (current ISO timestamp)
- Empty time tracking (active: {})
- Not completed status (completed: null)
- Default due date of current day if not specified

GTD TAG GUIDELINES (for calling LLM):
- "gtd:next" for clear, actionable items ready to be done
- "gtd:project" for multi-step outcomes requiring planning
- "gtd:waiting" for items blocked by others or external dependencies
- "gtd:someday" for vague, future, or low-priority items
- "gtd:calendar" for time-specific appointments and meetings
  Note: For gtd:calendar items, set scheduledTime or prefix title with time in HH:MM format (24-hour)

🧠 CRITICAL REMINDER: For memory requests (user says "remember..."):
- ALWAYS use context "memory" - never "private" or any other context!
- ALWAYS use due date as TODAY'S date in YYYY-MM-DD format - NEVER use future dates!`;

/** Zod schema for createTodo parameters */
export const createTodoParameters = z.object({
  title: z
    .string()
    .describe(
      'The main title/name of the todo item (required). For gtd:calendar items, use scheduledTime or prefix with time in HH:MM format, e.g., "15:00 Doctor appointment".',
    ),
  description: z
    .string()
    .default('')
    .describe('Detailed description or notes for the todo. Can include markdown formatting'),
  context: z
    .string()
    .default('private')
    .describe(
      'GTD context category for organizing todos (e.g. "work", "private", "errands", "shopping", "calls")',
    ),
  due: z
    .string()
    .optional()
    .describe('Due date in YYYY-MM-DD format. Defaults to the current day if not provided.'),
  scheduledTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .nullable()
    .default(null)
    .describe('Optional scheduled local time in HH:mm format.'),
  scheduledTimeZone: z
    .string()
    .refine(isValidTimeZone, 'Invalid IANA timezone')
    .nullable()
    .default(null)
    .describe('Optional IANA timezone for scheduled time interpretation.'),
  tags: z
    .array(z.string())
    .default([])
    .describe(
      'Array of tags for categorization. Should include appropriate GTD tags (gtd:next, gtd:project, gtd:waiting, gtd:someday, gtd:calendar) based on item type.',
    ),
  repeat: z
    .number()
    .nullable()
    .default(null)
    .describe(
      'Number of days to repeat this todo. Set to null (default) for no repeat. gtd:calendar repeats from original due date, gtd:habit repeats from completion date',
    ),
  link: z
    .string()
    .nullable()
    .default(null)
    .describe(
      'Optional URL or reference link related to this todo. Can be used for documentation, tickets, or external resources',
    ),
  externalId: z
    .string()
    .nullable()
    .default(null)
    .describe(
      'Optional external system ID for syncing (e.g., "github:owner/repo/issues/123"). Used for deduplication during periodic imports.',
    ),
  parentId: z
    .string()
    .nullable()
    .default(null)
    .describe(
      'Optional parent todo ID for creating subtasks. References the _id of an existing todo to create a parent-child relationship.',
    ),
  blockedBy: z
    .array(z.string())
    .optional()
    .describe(
      'Optional array of todo IDs that must complete before this task becomes actionable. Use with gtd:blocked tag for internal task dependencies. Distinct from gtd:waiting which is for external blocks.',
    ),
  metadata: z
    .record(z.string(), z.union([z.string(), z.array(z.string())]))
    .optional()
    .describe(
      'Optional key-value metadata for extensibility. Values can be strings or arrays of strings. Use namespaced keys (e.g., "agent:worktree", "github:labels": ["bug", "priority"]).',
    ),
  message: z
    .string()
    .optional()
    .describe(
      'Optional human-readable audit message describing why this todo was created (short, like a git commit message).',
    ),
});

export type CreateTodoArgs = z.infer<typeof createTodoParameters>;

/**
 * Ensures the user's database exists, creating it if necessary
 */
async function ensureUserDatabase(
  couch: CouchServer,
  session: { userId: string; dbName: string } | undefined,
): Promise<void> {
  if (!session || session.userId === 'default') {
    return;
  }

  try {
    await couch.db.get(session.dbName);
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 404) {
      await couch.db.create(session.dbName);
      console.log(`Created database for user ${session.userId}: ${session.dbName}`);
    }
  }
}

/**
 * Normalize due date to YYYY-MM-DD format.
 *
 * @param due Due date input.
 * @return Date-only due value.
 */
function normalizeDueDate(due: string | undefined, timeZone?: string): string {
  if (!due) {
    return formatDateInTimeZone(new Date(), normalizeTimeZone(timeZone));
  }

  return due.slice(0, 10);
}

/**
 * Builds a new TodoAlpha4 object from the provided arguments.
 *
 * @param args Create todo arguments.
 * @return New todo document.
 */
function buildTodoDocument(args: CreateTodoArgs, timeZone?: string): Omit<TodoAlpha4, '_rev'> {
  const now = new Date().toISOString();
  const dueDate = normalizeDueDate(args.due, timeZone);
  const titleTime = extractScheduledTimeFromTitle(args.title);

  return {
    _id: now,
    title: titleTime.title,
    description: args.description,
    context: args.context,
    due: dueDate,
    tags: args.tags,
    completed: null,
    active: {},
    repeat: args.repeat,
    externalId: args.externalId,
    link: args.link,
    parentId: args.parentId,
    scheduledTime: args.scheduledTime ?? titleTime.scheduledTime,
    scheduledTimeZone:
      args.scheduledTime || titleTime.scheduledTime
        ? (args.scheduledTimeZone ?? normalizeTimeZone(timeZone))
        : null,
    blockedBy: args.blockedBy,
    metadata: args.metadata,
    version: 'alpha4',
  };
}

/**
 * Execute handler for createTodo tool
 */
export async function executeCreateTodo(
  args: CreateTodoArgs,
  context: ToolContext,
  getUserDb: GetUserDb,
  couch: CouchServer,
): Promise<string> {
  await ensureUserDatabase(couch, context.session);

  const db = getUserDb(context);

  context.log.info('Creating todo for user', {
    userId: context.session?.userId,
    title: args.title,
  });

  const newTodo = buildTodoDocument(args, context.session?.timezone);

  try {
    const startTime = Date.now();
    await db.insert(newTodo as TodoAlpha4);
    const executionTime = Date.now() - startTime;

    // Log audit entry and push audit ID to todo
    const auditId = await logMcpAudit(context, {
      action: 'create',
      entityId: newTodo._id,
      after: newTodo,
      message: args.message,
    });
    if (auditId) {
      await pushAuditIdToTodo(db, newTodo._id, auditId, context);
    }

    return createSuccessResponse({
      summary: 'Todo created successfully',
      data: {
        id: newTodo._id,
        title: newTodo.title,
        context: newTodo.context,
        due: newTodo.due,
      },
      operation: 'create',
      executionTime,
    });
  } catch (error) {
    return createErrorResponse({
      summary: 'Failed to create todo',
      error,
      operation: 'create',
      recoverySuggestions: [
        'Check if database connection is active',
        'Verify todo data format',
        'Try again with different title or ID',
      ],
    });
  }
}
