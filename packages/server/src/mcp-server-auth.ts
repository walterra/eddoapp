/**
 * MCP Server with Per-Request Authentication
 * Implements proper stateless authentication following MCP best practices
 */
import {
  type TodoAlpha3,
  getCouchDbConfig,
  getTestCouchDbConfig,
  validateEnv,
} from '@eddo/shared';
import { dotenvLoad } from 'dotenv-mono';
import { FastMCP } from 'fastmcp';
import nano from 'nano';
import { z } from 'zod';
import type { IncomingMessage } from 'http';

// Load environment variables
dotenvLoad();

// Validate environment
const env = validateEnv(process.env);

// User session type
type UserSession = {
  userId: string;
  dbName: string;
};

// Initialize nano connection
const couchDbConfig =
  env.NODE_ENV === 'test' ? getTestCouchDbConfig(env) : getCouchDbConfig(env);
const couch = nano(couchDbConfig.url);

// Create server with authentication
const server = new FastMCP<UserSession>({
  name: 'eddo-mcp-auth',
  version: '1.0.0',
  ping: {
    logLevel: 'info',
  },
  instructions:
    'Eddo Todo MCP Server with API key authentication. Pass X-API-Key header for user-specific database access. Each API key gets an isolated database.',
  
  // Authentication function - runs for each request
  authenticate: (request) => {
    // Extract API key from X-API-Key header
    const apiKey = request.headers['x-api-key'] as string;
    
    console.log(`Auth request with API key: ${apiKey ? '[REDACTED]' : 'none'}`);
    
    // In test mode, we allow any non-empty API key for database isolation
    if (env.NODE_ENV === 'test') {
      if (!apiKey) {
        throw new Response(null, {
          status: 401,
          statusText: 'API key required for test isolation',
        });
      }
      
      // Generate user-specific database name using API key
      const dbName = `${couchDbConfig.dbName}_api_${apiKey}`;
      
      return {
        userId: apiKey, // Use API key as user identifier
        dbName,
      };
    }
    
    // In production mode, require valid API key
    if (!apiKey) {
      throw new Response(null, {
        status: 401,
        statusText: 'API key required',
      });
    }
    
    // Here you would validate the API key against your auth system
    // For now, use the API key as the user identifier
    const dbName = `${couchDbConfig.dbName}_api_${apiKey}`;
    
    return {
      userId: apiKey,
      dbName,
    };
  },
});

// Helper to get user's database from context
function getUserDb(context: { session?: UserSession }): nano.DocumentScope<TodoAlpha3> {
  if (!context.session) {
    throw new Error('No user session available');
  }
  return couch.db.use<TodoAlpha3>(context.session.dbName);
}

// Create Todo Tool
server.addTool({
  name: 'createTodo',
  description: 'Create a new todo item in the authenticated user\'s database',
  parameters: z.object({
    title: z.string().describe('The main title/name of the todo item'),
    description: z.string().default(''),
    context: z.string().default('private'),
    due: z.string().optional(),
    tags: z.array(z.string()).default([]),
    repeat: z.number().nullable().default(null),
    link: z.string().nullable().default(null),
  }),
  execute: async (args, context) => {
    // Ensure user database exists (for test isolation)
    if (context.session?.userId && context.session.userId !== 'default') {
      try {
        await couch.db.get(context.session.dbName);
      } catch (error: any) {
        if (error.statusCode === 404) {
          await couch.db.create(context.session.dbName);
          console.log(`Created database for user ${context.session.userId}: ${context.session.dbName}`);
        }
      }
    }
    
    const db = getUserDb(context);
    
    context.log.info('Creating todo for user', { 
      userId: context.session?.userId,
      title: args.title 
    });
    
    const now = new Date().toISOString();
    const dueDate =
      args.due || new Date().toISOString().split('T')[0] + 'T23:59:59.999Z';
    
    const newTodo: TodoAlpha3 = {
      _id: now,
      title: args.title,
      description: args.description,
      context: args.context,
      due: dueDate,
      tags: args.tags,
      completed: null,
      active: {},
      repeat: args.repeat,
      link: args.link,
      version: 'alpha3',
    };
    
    try {
      await db.insert(newTodo);
      return `Todo created with ID: ${newTodo._id}`;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to create todo: ${message}`);
    }
  },
});

// List Todos Tool
server.addTool({
  name: 'listTodos',
  description: 'List todos from the authenticated user\'s database',
  parameters: z.object({
    context: z.string().optional(),
    completed: z.boolean().optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    limit: z.number().optional(),
  }),
  execute: async (args, context) => {
    const db = getUserDb(context);
    
    context.log.info('Listing todos for user', { 
      userId: context.session?.userId,
      filters: args 
    });
    
    try {
      // Build query selector
      const selector: any = { version: 'alpha3' };
      
      if (args.context) {
        selector.context = args.context;
      }
      
      if (args.completed !== undefined) {
        selector.completed = args.completed ? { $ne: null } : null;
      }
      
      if (args.dateFrom || args.dateTo) {
        selector.due = {};
        if (args.dateFrom) selector.due.$gte = args.dateFrom;
        if (args.dateTo) selector.due.$lte = args.dateTo;
      }
      
      // Build query
      const query: any = {
        selector,
        sort: [{ due: 'asc' }],
      };
      
      if (args.limit && args.limit > 0) {
        query.limit = args.limit;
      }
      
      const response = await db.find(query);
      return JSON.stringify(response.docs);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to list todos: ${message}`);
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
      return JSON.stringify({ userId: 'anonymous', dbName: 'default' });
    }
    
    return JSON.stringify({
      userId: context.session.userId,
      dbName: context.session.dbName,
    });
  },
});

// Update Todo Tool
server.addTool({
  name: 'updateTodo',
  description: 'Update an existing todo in the authenticated user\'s database. Before doing this update, you need to find the todo using listTodos to determine the ID.',
  parameters: z.object({
    id: z
      .string()
      .describe(
        'The unique identifier of the todo to update (ISO timestamp of creation)',
      ),
    title: z
      .string()
      .optional()
      .describe('Updated title/name of the todo item'),
    description: z.string().optional().describe('Updated description or notes'),
    context: z.string().optional().describe('Updated GTD context category'),
    due: z.string().optional().describe('Updated due date in ISO format'),
    tags: z.array(z.string()).optional().describe('Updated array of tags'),
    repeat: z
      .number()
      .nullable()
      .optional()
      .describe('Updated repeat interval in days (null to disable repeat)'),
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
      todoId: args.id 
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

      const result = await db.insert(updated);
      context.log.info('Todo updated successfully', {
        id: result.id,
        title: updated.title,
      });
      return `Todo updated: ${result.id}`;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to update todo: ${message}`);
    }
  },
});

// Complete/Uncomplete Todo Tool
server.addTool({
  name: 'toggleTodoCompletion',
  description: 'Mark a todo as completed or uncompleted in the authenticated user\'s database',
  parameters: z.object({
    id: z
      .string()
      .describe(
        'The unique identifier of the todo to toggle (ISO timestamp of creation)',
      ),
    completed: z
      .boolean()
      .describe('true to mark as completed, false to mark as incomplete'),
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
          const newDueDate = new Date(todo.due);
          newDueDate.setDate(newDueDate.getDate() + todo.repeat);

          const newTodo = {
            ...todo,
            _id: new Date().toISOString(),
            completed: null,
            active: {},
            due: newDueDate.toISOString(),
          };
          delete (newTodo as Record<string, unknown>)._rev;

          await db.insert(newTodo);
          await db.insert(todo);
          context.log.info('Todo completed and repeated', {
            original: todo.title,
            newDue: newDueDate.toISOString(),
          });
          return `Todo completed and repeated for ${newDueDate.toISOString()}`;
        }
      } else if (!args.completed) {
        todo.completed = null;
        context.log.info('Marking todo as uncompleted', { title: todo.title });
      }

      await db.insert(todo);
      const status = args.completed ? 'completed' : 'uncompleted';
      context.log.info('Todo completion toggled successfully', {
        title: todo.title,
        status,
      });
      return `Todo ${status}: ${todo.title}`;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to toggle todo completion: ${message}`);
    }
  },
});

// Delete Todo Tool
server.addTool({
  name: 'deleteTodo',
  description: 'Delete a todo from the authenticated user\'s database',
  parameters: z.object({
    id: z.string().describe('The ID of the todo to delete'),
  }),
  execute: async (args, context) => {
    const db = getUserDb(context);
    
    context.log.info('Deleting todo for user', { 
      userId: context.session?.userId,
      todoId: args.id 
    });
    
    try {
      const todo = await db.get(args.id);
      await db.destroy(args.id, todo._rev);
      return `Todo deleted: ${todo.title}`;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to delete todo: ${message}`);
    }
  },
});

// Start Time Tracking Tool
server.addTool({
  name: 'startTimeTracking',
  description: 'Start tracking time for a todo in the authenticated user\'s database',
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
      todoId: args.id 
    });

    try {
      const todo = (await db.get(args.id)) as TodoAlpha3;
      context.log.debug('Retrieved todo for time tracking start', {
        title: todo.title,
      });

      const now = new Date().toISOString();
      todo.active[now] = null;

      await db.insert(todo);
      context.log.info('Time tracking started successfully', {
        title: todo.title,
        startTime: now,
      });
      return `Started time tracking for: ${todo.title}`;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to start time tracking: ${message}`);
    }
  },
});

// Stop Time Tracking Tool
server.addTool({
  name: 'stopTimeTracking',
  description: 'Stop tracking time for a todo in the authenticated user\'s database',
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
      todoId: args.id 
    });

    try {
      const todo = (await db.get(args.id)) as TodoAlpha3;
      context.log.debug('Retrieved todo for time tracking stop', { title: todo.title });

      const now = new Date().toISOString();

      // Find the active tracking session (value is null)
      const activeSession = Object.entries(todo.active).find(
        ([_, end]) => end === null,
      );

      if (activeSession) {
        const startTime = activeSession[0];
        todo.active[startTime] = now;
        await db.insert(todo);

        context.log.info('Time tracking stopped successfully', {
          title: todo.title,
          startTime,
          endTime: now,
        });
        return `Stopped time tracking for: ${todo.title}`;
      }

      context.log.warn('No active time tracking found', { title: todo.title });
      return `No active time tracking found for: ${todo.title}`;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to stop time tracking: ${message}`);
    }
  },
});

// Query Active Time Tracking Tool
server.addTool({
  name: 'getActiveTimeTracking',
  description: 'Get todos with active time tracking from the authenticated user\'s database',
  parameters: z
    .object({})
    .describe(
      'No parameters required - returns all todos with active time tracking',
    ),
  execute: async (args, context) => {
    const db = getUserDb(context);
    
    context.log.info('Retrieving active time tracking todos for user', { 
      userId: context.session?.userId 
    });

    try {
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

      context.log.info('Active time tracking todos retrieved', {
        count: activeTodos.length,
      });
      return JSON.stringify(activeTodos, null, 2);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to retrieve active time tracking todos: ${message}`);
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
      .enum(['overview', 'datamodel', 'tools', 'examples', 'tagstats', 'all'])
      .default('all')
      .describe('Specific section of documentation to retrieve'),
  }),
  execute: async (args, context) => {
    const db = getUserDb(context);
    
    context.log.debug('Retrieving server info for user', { 
      userId: context.session?.userId,
      section: args.section 
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
            typeof a.value === 'number' && typeof b.value === 'number'
              ? b.value - a.value
              : 0,
          )
          .slice(0, 10);

        const tagList =
          sortedTags.length > 0
            ? sortedTags
                .map((row) => `- **${row.key}**: ${row.value} uses`)
                .join('\n')
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

    const sections: Record<string, string> = {
      overview: `# Eddo MCP Server with Authentication Overview

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

      tools: `# Available Tools

1. **createTodo** - Create a new todo item
2. **listTodos** - List todos with optional filters (context, completed, date range)
3. **updateTodo** - Update an existing todo's properties
4. **toggleTodoCompletion** - Mark todo as completed/uncompleted (handles repeating)
5. **deleteTodo** - Permanently delete a todo
6. **startTimeTracking** - Start tracking time for a todo
7. **stopTimeTracking** - Stop active time tracking
8. **getActiveTimeTracking** - Get todos with active time tracking
9. **getServerInfo** - Get this documentation
10. **getUserInfo** - Get current authenticated user information`,

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
    };

    if (args.section === 'all') {
      return Object.values(sections).join('\n\n---\n\n');
    }

    return (
      sections[args.section] ||
      'Invalid section. Choose from: overview, datamodel, tools, examples, tagstats, all'
    );
  },
});

// Export the server instance
export { server };

// Start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}` || true) {
  // Use custom port from environment in test mode
  const port = env.NODE_ENV === 'test' && process.env.MCP_TEST_PORT 
    ? parseInt(process.env.MCP_TEST_PORT, 10) 
    : 3001;
    
  console.log(`Starting MCP Auth Server on port ${port}...`);
  
  server.start({
    transportType: 'httpStream',
    httpStream: {
      port,
      // Allow CORS in test mode if needed
      // corsOptions: {
      //   origin: '*',
      //   credentials: true,
      // },
    },
  }).catch((error: Error) => {
    console.error('Server failed to start:', error);
    process.exit(1);
  });
}