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
import { uuidSchema } from '@eddo/core-shared/validation/compatibility';
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
import type { CouchServer, GetUserDb, ToolContext } from './types.js';
import { enrichTodoArgs } from './url_capture_enrichment.js';

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

/** Validates and publishes createTodo parameters. */
export const createTodoParameters = createToolParameters(
  obj({
    urlCaptureRef: opt(
      toolField(uuidSchema(), {
        description:
          'Reference from fetchUrl. Stores captured Markdown verbatim in description after any user notes, original URL in link, and web metadata. References expire after one hour or server restart; fetch again if unavailable.',
      }),
    ),
    title: str({
      description:
        'The main title/name of the todo item (required). For gtd:calendar items, use scheduledTime or prefix with time in HH:MM format, e.g., "15:00 Doctor appointment".',
    }),
    description: toolField(str(), {
      default: '',
      description: 'Detailed description or notes for the todo. Can include markdown formatting',
    }),
    context: toolField(str(), {
      default: 'private',
      description:
        'GTD context category for organizing todos (e.g. "work", "private", "errands", "shopping", "calls")',
    }),
    due: opt(
      toolField(str(), {
        description: 'Due date in YYYY-MM-DD format. Defaults to the current day if not provided.',
      }),
    ),
    scheduledTime: toolField(nullable(str({ pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' })), {
      default: null,
      description: 'Optional scheduled local time in HH:mm format.',
    }),
    scheduledTimeZone: toolField(nullable(str()), {
      default: null,
      description: 'Optional IANA timezone for scheduled time interpretation.',
    }),
    tags: toolField(arr(str()), {
      default: [],
      description:
        'Array of tags for categorization. Should include appropriate GTD tags (gtd:next, gtd:project, gtd:waiting, gtd:someday, gtd:calendar) based on item type.',
    }),
    repeat: toolField(nullable(num()), {
      default: null,
      description:
        'Number of days to repeat this todo. Set to null (default) for no repeat. gtd:calendar repeats from original due date, gtd:habit repeats from completion date',
    }),
    link: toolField(nullable(str()), {
      default: null,
      description:
        'Optional URL or reference link related to this todo. Can be used for documentation, tickets, or external resources',
    }),
    externalId: toolField(nullable(str()), {
      default: null,
      description:
        'Optional external system ID for syncing (e.g., "github:owner/repo/issues/123"). Used for deduplication during periodic imports.',
    }),
    parentId: toolField(nullable(str()), {
      default: null,
      description:
        'Optional parent todo ID for creating subtasks. References the _id of an existing todo to create a parent-child relationship.',
    }),
    blockedBy: opt(
      toolField(arr(str()), {
        description:
          'Optional array of todo IDs that must complete before this task becomes actionable. Use with gtd:blocked tag for internal task dependencies. Distinct from gtd:waiting which is for external blocks.',
      }),
    ),
    metadata: opt(
      toolField(map(union([str(), arr(str())])), {
        description:
          'Optional key-value metadata for extensibility. Values can be strings or arrays of strings. Use namespaced keys (e.g., "agent:worktree", "github:labels": ["bug", "priority"]).',
      }),
    ),
    message: opt(
      toolField(str(), {
        description:
          'Optional human-readable audit message describing why this todo was created (short, like a git commit message).',
      }),
    ),
  }),
  {
    validate: (value) =>
      value.scheduledTimeZone === null || isValidTimeZone(value.scheduledTimeZone)
        ? []
        : [{ path: '/scheduledTimeZone', code: 'custom', message: 'Invalid IANA timezone' }],
  },
);

export type CreateTodoArgs = ReturnType<typeof createTodoParameters.parse>;

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

  const newTodo = buildTodoDocument(enrichTodoArgs(args, context), context.session?.timezone);

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
