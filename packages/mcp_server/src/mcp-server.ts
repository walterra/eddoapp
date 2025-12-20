/**
 * MCP Server with Per-Request Authentication
 * Implements proper stateless authentication following MCP best practices
 */
import {
  type TodoAlpha3,
  getCouchDbConfig,
  getRepeatTodo,
  getTestCouchDbConfig,
  validateEnv,
} from '@eddo/core-server';
import { dotenvLoad } from 'dotenv-mono';
import { FastMCP } from 'fastmcp';
import nano from 'nano';
import { z } from 'zod';

import { validateUserContext } from './auth/user-auth.js';

// Load environment variables
dotenvLoad();

// Validate environment
const env = validateEnv(process.env);

// User session type
type UserSession = {
  userId: string;
  dbName: string;
  username: string;
};

// Initialize nano connection
const couchDbConfig = env.NODE_ENV === 'test' ? getTestCouchDbConfig(env) : getCouchDbConfig(env);
const couch = nano(couchDbConfig.url);

// Create server with authentication
const server = new FastMCP<UserSession>({
  name: 'eddo-mcp-auth',
  version: '1.0.0',
  ping: {
    logLevel: 'info',
  },
  instructions:
    'Eddo Todo MCP Server with user registry authentication and GTD tag awareness. Pass X-User-ID, X-Database-Name, and X-Telegram-ID headers for user-specific database access. Each user gets an isolated database.\n\nGTD SYSTEM:\n- TAGS: gtd:next, gtd:project, gtd:waiting, gtd:someday, gtd:calendar (for actionability/type)\n- CONTEXT: work, private, errands, etc. (for location/situation)\n- DUE FIELD: For gtd:calendar = exact appointment time, for others = deadline/target\n\nWhen creating todos, add appropriate GTD tags AND set proper context:\n- tags: ["gtd:next"] + context: "work" for work actionable items\n- tags: ["gtd:project"] + context: "private" for personal projects\n- tags: ["gtd:waiting"] + context: "work" for work dependencies\n- tags: ["gtd:calendar"] + context: "work" for appointments/meetings\n\nAPPOINTMENT CREATION RULE: For gtd:calendar items, ALWAYS prefix title with time in HH:MM format:\n- "Doctor appointment at 3pm" → title: "15:00 Doctor appointment"\n- "Meeting tomorrow at 10:30" → title: "10:30 Meeting"\n- "Lunch at noon" → title: "12:00 Lunch"\n\nFor GTD queries like "what\'s next?", filter by gtd:next tags and optionally by context.',

  // Authentication function - runs for each request
  authenticate: async (request) => {
    console.log('MCP authentication request');

    // Check if user headers are provided
    const username = request.headers['x-user-id'] || request.headers['X-User-ID'];

    if (!username) {
      // No user headers - this is likely a connection handshake
      // Allow connection but return default session
      console.log('MCP connection without user headers (connection handshake)');
      return {
        userId: 'anonymous',
        dbName: 'default',
        username: 'anonymous',
      };
    }

    // Use user registry authentication for requests with headers
    const authResult = await validateUserContext(request.headers);
    return {
      userId: authResult.userId,
      dbName: authResult.dbName,
      username: authResult.username,
    };
  },
});

// Helper to get user's database from context
function getUserDb(context: { session?: UserSession }): nano.DocumentScope<TodoAlpha3> {
  if (!context.session) {
    throw new Error('No user session available');
  }

  // For anonymous connections, require user headers for tool calls
  if (context.session.userId === 'anonymous') {
    throw new Error(
      'Tool calls require user authentication headers (X-User-ID, X-Database-Name, X-Telegram-ID)',
    );
  }

  return couch.db.use<TodoAlpha3>(context.session.dbName);
}

// Create Todo Tool
server.addTool({
  name: 'createTodo',
  description: `Create a new todo item in the authenticated user's database with GTD tag support.

🧠 MEMORY SYSTEM - HIGHEST PRIORITY:
When the user asks to remember something, create a todo with:
- tags: ["user:memory"]
- title: Brief summary of what to remember
- description: Full details to remember
- context: "memory" (NOT "private" - ALWAYS "memory")
- due: Current date in ISO format ending with T23:59:59.999Z

Examples (using TODAY'S date):
- User says "remember my favorite coffee is espresso" → {"title": "Coffee preference", "description": "User's favorite coffee is espresso", "tags": ["user:memory"], "context": "memory", "due": "${new Date().toISOString().split('T')[0]}T23:59:59.999Z"}

Creates a TodoAlpha3 object with:
- Auto-generated ID (current ISO timestamp)
- Empty time tracking (active: {})
- Not completed status (completed: null)
- Default due date of end of current day if not specified

GTD TAG GUIDELINES (for calling LLM):
When creating todos, intelligently add appropriate GTD tags based on the nature of the item:

- "gtd:next" for clear, actionable items that are ready to be done
  Examples: "Call John", "Send email", "Buy groceries", "Review document"

- "gtd:project" for multi-step outcomes that require planning
  Examples: "Plan vacation", "Hire developer", "Redesign website", "Organize event"

- "gtd:waiting" for items blocked by others or external dependencies
  Examples: "Wait for budget approval", "Waiting for client response", "Pending review"

- "gtd:someday" for vague, future, or low-priority items
  Examples: "Maybe learn Spanish", "Consider new laptop", "Research topic", "Explore idea"

- "gtd:calendar" for time-specific appointments and meetings
  Examples: "Doctor appointment", "Team meeting", "Conference call", "Flight departure"
  Note: Use exact appointment time in due field, not deadline
  IMPORTANT: For gtd:calendar items, prefix the title with time in HH:MM format (24-hour)
  Example: "15:00 Doctor appointment", "10:30 Team meeting", "08:45 Flight to Paris"

Usage examples:
- Actionable: {"title": "Buy groceries", "tags": ["gtd:next"], "context": "private"}
- Project: {"title": "Plan team retreat", "tags": ["gtd:project"], "context": "work"}
- Waiting: {"title": "Wait for budget approval", "tags": ["gtd:waiting"], "context": "work"}
- Someday: {"title": "Maybe learn Spanish", "tags": ["gtd:someday"], "context": "private"}
- Appointment: {"title": "15:00 Doctor appointment", "tags": ["gtd:calendar"], "context": "private", "due": "2025-07-15T15:00:00.000Z"}

🧠 CRITICAL REMINDER: For memory requests (user says "remember..."):
- ALWAYS use context "memory" - never "private" or any other context!
- ALWAYS use due date as TODAY'S date at 23:59:59.999Z - NEVER use future dates like 2025-12-31!`,
  parameters: z.object({
    title: z
      .string()
      .describe(
        'The main title/name of the todo item (required). For gtd:calendar items, prefix with time in HH:MM format (24-hour), e.g., "15:00 Doctor appointment"',
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
      .describe(
        'Due date in ISO format (YYYY-MM-DDTHH:mm:ss.sssZ). For gtd:calendar items, use exact appointment time. For other items, use deadline/target date. Defaults to 23:59:59.999Z of current day if not provided',
      ),
    tags: z
      .array(z.string())
      .default([])
      .describe(
        'Array of tags for categorization and filtering. Should include appropriate GTD tags (gtd:next, gtd:project, gtd:waiting, gtd:someday, gtd:calendar) based on the item type. Also supports custom categories, projects, and priorities.',
      ),
    repeat: z
      .number()
      .nullable()
      .default(null)
      .describe(
        'Number of days to repeat this todo. Set to null (default) for no repeat. Behavior depends on tags: gtd:calendar repeats from original due date (e.g., monthly bills), gtd:habit or no tag repeats from completion date (e.g., exercise every N days)',
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
        'Optional external system ID for syncing with other todo systems. Format: "system:identifier" (e.g., "github:owner/repo/issues/123" for GitHub issues). Used for deduplication during periodic imports.',
      ),
  }),
  execute: async (args, context) => {
    // Ensure user database exists (for test isolation)
    if (context.session?.userId && context.session.userId !== 'default') {
      try {
        await couch.db.get(context.session.dbName);
      } catch (error: unknown) {
        if (
          error &&
          typeof error === 'object' &&
          'statusCode' in error &&
          error.statusCode === 404
        ) {
          await couch.db.create(context.session.dbName);
          console.log(
            `Created database for user ${context.session.userId}: ${context.session.dbName}`,
          );
        }
      }
    }

    const db = getUserDb(context);

    context.log.info('Creating todo for user', {
      userId: context.session?.userId,
      title: args.title,
    });

    const now = new Date().toISOString();
    const dueDate = args.due || new Date().toISOString().split('T')[0] + 'T23:59:59.999Z';

    const newTodo: Omit<TodoAlpha3, '_rev'> = {
      _id: now,
      title: args.title,
      description: args.description,
      context: args.context,
      due: dueDate,
      tags: args.tags,
      completed: null,
      active: {},
      repeat: args.repeat,
      externalId: args.externalId,
      link: args.link,
      version: 'alpha3',
    };

    try {
      const startTime = Date.now();
      await db.insert(newTodo as TodoAlpha3);
      const executionTime = Date.now() - startTime;

      return JSON.stringify({
        summary: 'Todo created successfully',
        data: {
          id: newTodo._id,
          title: newTodo.title,
          context: newTodo.context,
          due: newTodo.due,
        },
        metadata: {
          execution_time: `${executionTime.toFixed(2)}ms`,
          operation: 'create',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return JSON.stringify({
        summary: 'Failed to create todo',
        error: message,
        recovery_suggestions: [
          'Check if database connection is active',
          'Verify todo data format',
          'Try again with different title or ID',
        ],
        metadata: {
          operation: 'create',
          timestamp: new Date().toISOString(),
          error_type: 'database_error',
        },
      });
    }
  },
});

// List Todos Tool
server.addTool({
  name: 'listTodos',
  description: `List todos with optional filters from the authenticated user's database. Available filters: context (GTD context), completed (boolean), dateFrom/dateTo (ISO date strings for due date range), completedFrom/completedTo (ISO date strings for completion date range), externalId (exact match for external system ID), limit (number of results)

GTD-AWARE QUERY HANDLING:
- "What's next?" → filter by gtd:next tags, prioritize by context
- "What am I waiting for?" → filter by gtd:waiting tags
- "Show my projects" → filter by gtd:project tags
- "Someday items" → filter by gtd:someday tags
- "What's my schedule?" / "Show appointments" → filter by gtd:calendar tags
- "What's next at work?" → combine gtd:next + work context
- "What did I complete today?" → use completedFrom/completedTo with today's date range

Usage examples:
- All todos: {}
- Next actions: {"tags": ["gtd:next"]}
- Work next actions: {"context": "work", "tags": ["gtd:next"]}
- Projects: {"tags": ["gtd:project"]}
- Waiting items: {"tags": ["gtd:waiting"]}
- Appointments: {"tags": ["gtd:calendar"]}
- Today's appointments: {"tags": ["gtd:calendar"], "dateFrom": "2025-07-15T00:00:00.000Z", "dateTo": "2025-07-15T23:59:59.999Z"}
- Work projects: {"context": "work", "tags": ["gtd:project"]}
- Combined filters: {"context": "work", "completed": false, "limit": 10}
- Completed today: {"completedFrom": "2025-07-15T00:00:00.000Z", "completedTo": "2025-07-15T23:59:59.999Z"}`,
  parameters: z.object({
    context: z.string().optional().describe('Filter todos by GTD context (e.g. "work", "private")'),
    completed: z
      .boolean()
      .optional()
      .describe(
        'Filter by completion status: true for completed todos (have completion timestamp), false for incomplete (null completion), undefined for all',
      ),
    dateFrom: z
      .string()
      .optional()
      .describe('Start date filter for due date in ISO format (inclusive)'),
    dateTo: z
      .string()
      .optional()
      .describe('End date filter for due date in ISO format (inclusive)'),
    completedFrom: z
      .string()
      .optional()
      .describe('Start date filter for completion date in ISO format (inclusive)'),
    completedTo: z
      .string()
      .optional()
      .describe('End date filter for completion date in ISO format (inclusive)'),
    limit: z.number().default(50).describe('Maximum number of todos to return (default: 50)'),
    tags: z
      .array(z.string())
      .optional()
      .describe(
        'Filter by specific tags (e.g., ["gtd:next"] for next actions, ["gtd:project"] for projects)',
      ),
    externalId: z
      .string()
      .optional()
      .describe(
        'Filter by exact external system ID (e.g., "github:owner/repo/issues/123"). For finding all GitHub todos, use listTodos without filters and filter client-side.',
      ),
  }),
  execute: async (args, context) => {
    const db = getUserDb(context);

    context.log.info('Listing todos for user', {
      userId: context.session?.userId,
      filters: args,
    });

    try {
      // Build query selector
      const selector: Record<string, unknown> = { version: 'alpha3' };

      if (args.context) {
        selector.context = args.context;
      }

      // Handle completion date range filters
      if (args.completedFrom || args.completedTo) {
        // Can't filter by completion date for uncompleted todos
        if (args.completed === false) {
          throw new Error('Cannot use completedFrom/completedTo with completed=false');
        }
        // Build range query for completed todos
        selector.completed = {};
        if (args.completedFrom) {
          (selector.completed as Record<string, unknown>)['$gte'] = args.completedFrom;
        }
        if (args.completedTo) {
          (selector.completed as Record<string, unknown>)['$lte'] = args.completedTo;
        }
      } else if (args.completed !== undefined) {
        // Only apply boolean filter if no date range specified
        selector.completed = args.completed ? { $ne: null } : null;
      }

      if (args.dateFrom || args.dateTo) {
        selector.due = {};
        if (args.dateFrom) {
          (selector.due as Record<string, unknown>)['$gte'] = args.dateFrom;
        }
        if (args.dateTo) {
          (selector.due as Record<string, unknown>)['$lte'] = args.dateTo;
        }
      }

      if (args.tags && args.tags.length > 0) {
        selector.tags = { $in: args.tags };
      }

      if (args.externalId) {
        // Exact match only (prefix matching requires externalId index)
        selector.externalId = args.externalId;
      }

      // Build query with explicit sorting and index specification
      const baseQuery = {
        selector,
        sort: [{ due: 'asc' }],
        limit: args.limit && args.limit > 0 ? args.limit : 50,
      };

      // Explicitly specify which index to use based on the query
      // This is required for CouchDB to use the correct index for sorting
      let use_index: string;
      const hasCompletedFilter =
        args.completed !== undefined || args.completedFrom || args.completedTo;

      if (args.context && hasCompletedFilter) {
        use_index = 'version-context-completed-due-index';
      } else if (args.context) {
        use_index = 'version-context-due-index';
      } else if (hasCompletedFilter) {
        use_index = 'version-completed-due-index';
      } else {
        use_index = 'version-due-index';
      }

      const finalQuery = { ...baseQuery, use_index } as nano.MangoQuery;

      const startTime = Date.now();

      // Debug: Log the exact query being sent
      context.log.info('Executing Mango query', {
        query: JSON.stringify(finalQuery, null, 2),
        dbName: context.session?.userId,
      });

      const response = await db.find(finalQuery);
      const executionTime = Date.now() - startTime;

      context.log.info('Todos retrieved successfully', {
        count: response.docs.length,
      });

      return JSON.stringify({
        summary: `Found ${response.docs.length} matching todos`,
        data: response.docs,
        pagination: {
          count: response.docs.length,
          limit: args.limit || 50,
          has_more: response.docs.length === (args.limit || 50),
        },
        metadata: {
          execution_time: `${executionTime.toFixed(2)}ms`,
          operation: 'list',
          timestamp: new Date().toISOString(),
          filters_applied: Object.keys(args).filter(
            (k) => args[k as keyof typeof args] !== undefined,
          ),
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      // If database doesn't exist, return empty result instead of throwing error
      if (message.includes('Database does not exist') || message.includes('no_db_file')) {
        context.log.info('Database does not exist, returning empty result');
        return JSON.stringify({
          summary: 'No todos found - database not initialized',
          data: [],
          pagination: {
            count: 0,
            limit: args.limit || 50,
            has_more: false,
          },
          metadata: {
            operation: 'list',
            timestamp: new Date().toISOString(),
            database_status: 'not_initialized',
          },
        });
      }

      return JSON.stringify({
        summary: 'Failed to list todos',
        error: message,
        recovery_suggestions: [
          'Check database connection',
          'Verify authentication credentials',
          'Try with simpler filter criteria',
        ],
        metadata: {
          operation: 'list',
          timestamp: new Date().toISOString(),
          error_type: 'database_error',
        },
      });
    }
  },
});

// Get Current User Info Tool
server.addTool({
  name: 'getUserInfo',
  description: 'Get current authenticated user information',
  parameters: z.object({}),
  execute: async (_, context) => {
    if (!context.session) {
      return JSON.stringify({
        summary: 'Anonymous user session',
        data: {
          userId: 'anonymous',
          dbName: 'default',
          authenticated: false,
        },
        metadata: {
          operation: 'user_info',
          timestamp: new Date().toISOString(),
          auth_status: 'anonymous',
        },
      });
    }

    return JSON.stringify({
      summary: 'User information retrieved',
      data: {
        userId: context.session.userId,
        dbName: context.session.dbName,
        authenticated: true,
      },
      metadata: {
        operation: 'user_info',
        timestamp: new Date().toISOString(),
      },
    });
  },
});

// Update Todo Tool
server.addTool({
  name: 'updateTodo',
  description: `Update an existing todo CouchDB style. Before doing this update, you need to find the todo using listTodos to determine the ID.

Usage examples:
- Update title: {"id": "2025-07-10T20:35:54.935Z", "title": "New title"}
- Update multiple fields: {"id": "2025-07-10T20:35:54.935Z", "title": "New title", "description": "Updated notes", "context": "work"}
- Update due date: {"id": "2025-07-10T20:35:54.935Z", "due": "2025-07-15T23:59:59.999Z"}

IMPORTANT: Pass update fields directly as parameters, NOT wrapped in nested objects.`,
  parameters: z.object({
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
        'Updated repeat interval in days (null to disable repeat). Behavior: gtd:calendar repeats from due date, gtd:habit or no tag repeats from completion date',
      ),
    link: z
      .string()
      .nullable()
      .optional()
      .describe('Updated URL or reference link (null to remove)'),
  }),
  execute: async (args, context) => {
    const db = getUserDb(context);

    context.log.info('Updating todo for user', {
      userId: context.session?.userId,
      todoId: args.id,
    });

    try {
      const todo = (await db.get(args.id)) as TodoAlpha3;
      context.log.debug('Retrieved todo for update', { title: todo.title });

      const updated = {
        ...todo,
        title: args.title ?? todo.title,
        description: args.description ?? todo.description,
        context: args.context ?? todo.context,
        due: args.due ?? todo.due,
        tags: args.tags ?? todo.tags,
        repeat: args.repeat !== undefined ? args.repeat : todo.repeat,
        link: args.link !== undefined ? args.link : todo.link,
      };

      const startTime = Date.now();
      const result = await db.insert(updated);
      const executionTime = Date.now() - startTime;

      context.log.info('Todo updated successfully', {
        id: result.id,
        title: updated.title,
      });

      return JSON.stringify({
        summary: 'Todo updated successfully',
        data: {
          id: result.id,
          title: updated.title,
          changes_made: Object.keys(args).filter(
            (k) => args[k as keyof typeof args] !== undefined && k !== 'id',
          ),
        },
        metadata: {
          execution_time: `${executionTime.toFixed(2)}ms`,
          operation: 'update',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return JSON.stringify({
        summary: 'Failed to update todo',
        error: message,
        recovery_suggestions: [
          'Verify the todo ID exists using listTodos',
          'Check if database connection is active',
          'Ensure update data is valid',
        ],
        metadata: {
          operation: 'update',
          timestamp: new Date().toISOString(),
          error_type: message.includes('not found') ? 'not_found' : 'database_error',
        },
      });
    }
  },
});

// Complete/Uncomplete Todo Tool
server.addTool({
  name: 'toggleTodoCompletion',
  description: 'Mark a todo as completed or uncompleted',
  parameters: z.object({
    id: z
      .string()
      .describe('The unique identifier of the todo to toggle (ISO timestamp of creation)'),
    completed: z.boolean().describe('true to mark as completed, false to mark as incomplete'),
  }),
  execute: async (args, context) => {
    const db = getUserDb(context);

    context.log.info('Toggling todo completion for user', {
      userId: context.session?.userId,
      todoId: args.id,
      completed: args.completed,
    });

    try {
      const todo = (await db.get(args.id)) as TodoAlpha3;
      context.log.debug('Retrieved todo for completion toggle', {
        title: todo.title,
        currentCompleted: todo.completed,
      });

      const now = new Date().toISOString();

      if (args.completed && !todo.completed) {
        todo.completed = now;
        context.log.info('Marking todo as completed', { title: todo.title });

        // Handle repeating todos
        if (todo.repeat) {
          context.log.info('Creating repeat todo', { repeatDays: todo.repeat });
          const newTodo = getRepeatTodo(todo);

          const startTime = Date.now();
          await db.insert(newTodo as TodoAlpha3);
          await db.insert(todo);
          const executionTime = Date.now() - startTime;

          context.log.info('Todo completed and repeated', {
            original: todo.title,
            newDue: newTodo.due,
            repeatType: todo.tags.includes('gtd:calendar') ? 'calendar' : 'habit',
          });

          return JSON.stringify({
            summary: 'Todo completed and repeated',
            data: {
              original_id: todo._id,
              original_title: todo.title,
              new_todo_id: newTodo._id,
              new_due_date: newTodo.due,
              repeat_interval: todo.repeat,
              repeat_type: todo.tags.includes('gtd:calendar') ? 'calendar' : 'habit',
            },
            metadata: {
              execution_time: `${executionTime.toFixed(2)}ms`,
              operation: 'complete_and_repeat',
              timestamp: new Date().toISOString(),
            },
          });
        }
      } else if (!args.completed) {
        todo.completed = null;
        context.log.info('Marking todo as uncompleted', { title: todo.title });
      }

      const startTime = Date.now();
      await db.insert(todo);
      const executionTime = Date.now() - startTime;

      const status = args.completed ? 'completed' : 'uncompleted';
      context.log.info('Todo completion toggled successfully', {
        title: todo.title,
        status,
      });

      return JSON.stringify({
        summary: `Todo ${status} successfully`,
        data: {
          id: todo._id,
          title: todo.title,
          status,
          completed_at: todo.completed,
        },
        metadata: {
          execution_time: `${executionTime.toFixed(2)}ms`,
          operation: 'toggle_completion',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return JSON.stringify({
        summary: 'Failed to toggle todo completion',
        error: message,
        recovery_suggestions: [
          'Verify the todo ID exists using listTodos',
          'Check if database connection is active',
          'Try refreshing the todo data',
        ],
        metadata: {
          operation: 'toggle_completion',
          timestamp: new Date().toISOString(),
          error_type: message.includes('not found') ? 'not_found' : 'database_error',
        },
      });
    }
  },
});

// Delete Todo Tool
server.addTool({
  name: 'deleteTodo',
  description: 'Delete a todo permanently',
  parameters: z.object({
    id: z
      .string()
      .describe('The unique identifier of the todo to delete (ISO timestamp of creation)'),
  }),
  execute: async (args, context) => {
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

      context.log.info('Todo deleted successfully', { title: todo.title });

      return JSON.stringify({
        summary: 'Todo deleted successfully',
        data: {
          id: todo._id,
          title: todo.title,
          deleted_at: new Date().toISOString(),
        },
        metadata: {
          execution_time: `${executionTime.toFixed(2)}ms`,
          operation: 'delete',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      context.log.error('Failed to delete todo', {
        id: args.id,
        error: message,
      });

      return JSON.stringify({
        summary: 'Failed to delete todo',
        error: message,
        recovery_suggestions: [
          'Verify the todo ID exists using listTodos',
          'Check if database connection is active',
          'Ensure you have permission to delete this todo',
        ],
        metadata: {
          operation: 'delete',
          timestamp: new Date().toISOString(),
          error_type: message.includes('not found') ? 'not_found' : 'database_error',
        },
      });
    }
  },
});

// Start Time Tracking Tool
server.addTool({
  name: 'startTimeTracking',
  description: 'Start tracking time for a todo',
  parameters: z.object({
    id: z
      .string()
      .describe(
        'The unique identifier of the todo to start time tracking for (ISO timestamp of creation)',
      ),
  }),
  execute: async (args, context) => {
    const db = getUserDb(context);

    context.log.info('Starting time tracking for user', {
      userId: context.session?.userId,
      todoId: args.id,
    });

    try {
      const todo = (await db.get(args.id)) as TodoAlpha3;
      context.log.debug('Retrieved todo for time tracking start', {
        title: todo.title,
      });

      const now = new Date().toISOString();
      const startTime = Date.now();
      todo.active[now] = null;

      await db.insert(todo);
      const executionTime = Date.now() - startTime;

      context.log.info('Time tracking started successfully', {
        title: todo.title,
        startTime: now,
      });

      return JSON.stringify({
        summary: 'Time tracking started',
        data: {
          id: todo._id,
          title: todo.title,
          started_at: now,
          active_sessions: Object.keys(todo.active).length,
        },
        metadata: {
          execution_time: `${executionTime.toFixed(2)}ms`,
          operation: 'start_time_tracking',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      context.log.error('Failed to start time tracking', {
        id: args.id,
        error: message,
      });

      return JSON.stringify({
        summary: 'Failed to start time tracking',
        error: message,
        recovery_suggestions: [
          'Verify the todo ID exists using listTodos',
          'Check if database connection is active',
          'Stop any existing time tracking first',
        ],
        metadata: {
          operation: 'start_time_tracking',
          timestamp: new Date().toISOString(),
          error_type: message.includes('not found') ? 'not_found' : 'database_error',
        },
      });
    }
  },
});

// Stop Time Tracking Tool
server.addTool({
  name: 'stopTimeTracking',
  description: 'Stop tracking time for a todo',
  parameters: z.object({
    id: z
      .string()
      .describe(
        'The unique identifier of the todo to stop time tracking for (ISO timestamp of creation)',
      ),
  }),
  execute: async (args, context) => {
    const db = getUserDb(context);

    context.log.info('Stopping time tracking for user', {
      userId: context.session?.userId,
      todoId: args.id,
    });

    try {
      const todo = (await db.get(args.id)) as TodoAlpha3;
      context.log.debug('Retrieved todo for time tracking stop', {
        title: todo.title,
      });

      const now = new Date().toISOString();
      const operationStartTime = Date.now();

      // Find the active tracking session (value is null)
      const activeSession = Object.entries(todo.active).find(([_, end]) => end === null);

      if (activeSession) {
        const startTime = activeSession[0];
        todo.active[startTime] = now;
        await db.insert(todo);

        const executionTime = Date.now() - operationStartTime;

        context.log.info('Time tracking stopped successfully', {
          title: todo.title,
          startTime,
          endTime: now,
        });

        const duration = new Date(now).getTime() - new Date(startTime).getTime();

        return JSON.stringify({
          summary: 'Time tracking stopped',
          data: {
            id: todo._id,
            title: todo.title,
            session: {
              started_at: startTime,
              ended_at: now,
              duration_ms: duration,
              duration_formatted: `${Math.floor(duration / 60000)}m ${Math.floor((duration % 60000) / 1000)}s`,
            },
          },
          metadata: {
            execution_time: `${executionTime.toFixed(2)}ms`,
            operation: 'stop_time_tracking',
            timestamp: new Date().toISOString(),
          },
        });
      }

      context.log.warn('No active time tracking found', { title: todo.title });

      return JSON.stringify({
        summary: 'No active time tracking found',
        data: {
          id: todo._id,
          title: todo.title,
          active_sessions: 0,
        },
        metadata: {
          operation: 'stop_time_tracking',
          timestamp: new Date().toISOString(),
          result: 'no_active_session',
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      context.log.error('Failed to stop time tracking', {
        id: args.id,
        error: message,
      });

      return JSON.stringify({
        summary: 'Failed to stop time tracking',
        error: message,
        recovery_suggestions: [
          'Verify the todo ID exists using listTodos',
          "Check if there's active time tracking with getActiveTimeTracking",
          'Check if database connection is active',
        ],
        metadata: {
          operation: 'stop_time_tracking',
          timestamp: new Date().toISOString(),
          error_type: message.includes('not found') ? 'not_found' : 'database_error',
        },
      });
    }
  },
});

// Query Active Time Tracking Tool
server.addTool({
  name: 'getActiveTimeTracking',
  description: 'Get todos with active time tracking',
  parameters: z
    .object({})
    .describe('No parameters required - returns all todos with active time tracking'),
  execute: async (_args, context) => {
    const db = getUserDb(context);

    context.log.info('Retrieving active time tracking todos for user', {
      userId: context.session?.userId,
    });

    try {
      const startTime = Date.now();
      const result = await db.find({
        selector: {
          version: 'alpha3',
          active: { $exists: true },
        },
      });

      const activeTodos = result.docs.filter((todo: unknown) => {
        const typedTodo = todo as TodoAlpha3;
        return Object.values(typedTodo.active).some((end) => end === null);
      });

      const executionTime = Date.now() - startTime;

      context.log.info('Active time tracking todos retrieved', {
        count: activeTodos.length,
      });

      return JSON.stringify({
        summary: `Found ${activeTodos.length} todos with active time tracking`,
        data: activeTodos.map((todo) => ({
          ...todo,
          active_session_count: Object.values(todo.active).filter((end) => end === null).length,
        })),
        metadata: {
          execution_time: `${executionTime.toFixed(2)}ms`,
          operation: 'get_active_time_tracking',
          timestamp: new Date().toISOString(),
          active_count: activeTodos.length,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      context.log.error('Failed to retrieve active time tracking todos', {
        error: message,
      });

      return JSON.stringify({
        summary: 'Failed to retrieve active time tracking',
        error: message,
        recovery_suggestions: [
          'Check if database connection is active',
          'Try listing todos first with listTodos',
          'Verify database initialization',
        ],
        metadata: {
          operation: 'get_active_time_tracking',
          timestamp: new Date().toISOString(),
          error_type: 'database_error',
        },
      });
    }
  },
});

// Get Server Info Tool
server.addTool({
  name: 'getServerInfo',
  description:
    'Get comprehensive information about the Eddo MCP server with authentication, including data model, available tools, and usage examples',
  parameters: z.object({
    section: z
      .enum(['overview', 'datamodel', 'examples', 'tagstats', 'memories', 'all'])
      .default('all')
      .describe('Specific section of documentation to retrieve'),
  }),
  execute: async (args, context) => {
    const db = getUserDb(context);

    context.log.debug('Retrieving server info for user', {
      userId: context.session?.userId,
      section: args.section,
    });

    // Get tag statistics if needed
    let tagStatsSection = '';
    if (args.section === 'tagstats' || args.section === 'all') {
      try {
        // Use the design document view to get tag statistics
        // Force view refresh by not using stale parameter (default behavior)
        const result = await db.view('tags', 'by_tag', {
          group: true,
          reduce: true,
        });

        // Sort by count (descending) and get top 10
        const sortedTags = result.rows
          .sort((a, b) =>
            typeof a.value === 'number' && typeof b.value === 'number' ? b.value - a.value : 0,
          )
          .slice(0, 10);

        const tagList =
          sortedTags.length > 0
            ? sortedTags.map((row) => `- **${row.key}**: ${row.value} uses`).join('\n')
            : '- No tags found';

        tagStatsSection = `# Top Used Tags

The most frequently used tags across all todos:

${tagList}

*Showing top 10 most used tags*`;
      } catch (error) {
        tagStatsSection = `# Top Used Tags

Error retrieving tag statistics: ${error}`;
      }
    }

    // Get user memories if needed
    let memoriesSection = '';
    if (args.section === 'memories' || args.section === 'all') {
      try {
        const memoryResult = await db.find({
          selector: {
            tags: { $elemMatch: { $eq: 'user:memory' } },
          },
          // Remove sort to avoid index requirement - memories will be in creation order
        });

        const memories = memoryResult.docs || [];
        // Sort by _id (creation timestamp) in descending order in JavaScript
        const sortedMemories = memories.sort((a, b) => b._id.localeCompare(a._id));
        const memoryList =
          sortedMemories.length > 0
            ? sortedMemories.map((todo) => `- ${todo.title}: ${todo.description}`).join('\n')
            : '- No memories found';

        memoriesSection = `# User Memories

Current stored memories for context:

${memoryList}

*Memories are stored as todos with tag 'user:memory'*`;
      } catch (error) {
        memoriesSection = `# User Memories

Error retrieving memories: ${error}`;
      }
    }

    const sections: Record<string, string> = {
      overview: `# Eddo MCP Server Overview

The Eddo MCP server provides a Model Context Protocol interface for the Eddo GTD-inspired todo and time tracking application with per-user authentication.

- **Database**: CouchDB with per-user databases
- **Data Model**: TodoAlpha3 schema
- **Features**: Todo CRUD, time tracking, repeating tasks, GTD contexts
- **Authentication**: Per-request authentication via X-User-ID header
- **Current User**: ${context.session?.userId || 'anonymous'}
- **Database**: ${context.session?.dbName || 'default'}`,

      datamodel: `# TodoAlpha3 Data Model

{
  _id: string;              // ISO timestamp of creation (auto-generated)
  _rev: string;             // CouchDB revision (auto-managed)
  active: Record<string, string | null>;  // Time tracking: key=start ISO, value=end ISO or null if running
  completed: string | null; // Completion ISO timestamp (null if not completed)
  context: string;          // GTD context (e.g., "work", "private", "errands")
  description: string;      // Detailed notes (supports markdown)
  due: string;              // Due date ISO string
  link: string | null;      // Optional URL/reference
  repeat: number | null;    // Repeat interval in days
  tags: string[];           // Categorization tags
  title: string;            // Todo title
  version: 'alpha3';        // Schema version
}`,

      examples: `# Usage Examples

## Authentication
Pass X-API-Key header to authenticate:
curl -H "X-API-Key: your-api-key-here" http://localhost:3001/mcp

## Create a simple todo
{
  "tool": "createTodo",
  "arguments": {
    "title": "Buy groceries"
  }
}

## Create a work todo with full details
{
  "tool": "createTodo",
  "arguments": {
    "title": "Complete Q4 report",
    "description": "Include sales analysis and projections",
    "context": "work",
    "due": "2025-06-25T17:00:00.000Z",
    "tags": ["reports", "urgent"],
    "repeat": 90,
    "link": "https://docs.example.com/q4-template"
  }
}

## List incomplete work todos
{
  "tool": "listTodos",
  "arguments": {
    "context": "work",
    "completed": false
  }
}

## Start time tracking
{
  "tool": "startTimeTracking",
  "arguments": {
    "id": "2025-06-19T10:30:00.000Z"
  }
}`,

      tagstats: tagStatsSection,
      memories: memoriesSection,
    };

    if (args.section === 'all') {
      return Object.values(sections).join('\n\n---\n\n');
    }

    return (
      sections[args.section] ||
      'Invalid section. Choose from: overview, datamodel, tools, examples, tagstats, memories, all'
    );
  },
});

// Export the server instance and start function
export const mcpServer = server;

export async function stopMcpServer() {
  try {
    await server.stop();
    console.log('✅ Eddo MCP server stopped');
  } catch (error) {
    console.error('❌ Failed to stop MCP server:', error);
    throw error;
  }
}

export async function startMcpServer(port: number = 3001) {
  try {
    console.log(`🔧 Initializing Eddo MCP server with auth on port ${port}...`);

    // Verify database connection (database setup is handled externally)
    // Note: We can't test specific user databases here since they're created on-demand
    try {
      const defaultDbName =
        env.NODE_ENV === 'test' ? getTestCouchDbConfig(env).dbName : getCouchDbConfig(env).dbName;
      const defaultDb = couch.db.use(defaultDbName);
      const info = await defaultDb.info();
      console.log(`✅ Connected to CouchDB (verified with ${info.db_name})`);
    } catch (error: unknown) {
      console.error('❌ Failed to connect to database. Ensure CouchDB is running.');
      throw error;
    }

    // Start the server on the specified port
    await server.start({
      transportType: 'httpStream',
      httpStream: {
        port,
        // corsOptions: {
        //   origin: 'http://localhost:5173', // Allow Vite dev server
        //   credentials: true,
        // },
      },
    });

    console.log(`🚀 Eddo MCP server with auth running on port ${port}`);
    console.log(`📡 Connect with: http://localhost:${port}/mcp`);
    console.log(`🔐 Authentication: Pass X-API-Key header`);
    console.log(
      '📋 Available tools: createTodo, listTodos, updateTodo, toggleTodoCompletion, deleteTodo, startTimeTracking, stopTimeTracking, getActiveTimeTracking, getServerInfo, getUserInfo',
    );
  } catch (error) {
    console.error('❌ Failed to start MCP server:', error);
    throw error;
  }
}

// Auto-start the server when this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  // Use custom port from environment in test mode
  const port = env.NODE_ENV === 'test' && env.MCP_TEST_PORT ? env.MCP_TEST_PORT : 3001;
  startMcpServer(port).catch((error) => {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  });
}
