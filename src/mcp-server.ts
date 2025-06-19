import { FastMCP } from 'fastmcp';
import nano from 'nano';
import { z } from 'zod';

// Import the TodoAlpha3 type
import { type TodoAlpha3 } from './api/versions/todo_alpha3';

const server = new FastMCP({
  name: 'eddo-mcp',
  version: '1.0.0',
});

// Initialize nano connection to CouchDB
const couch = nano('http://admin:password@localhost:5984');
const db = couch.db.use('todos-dev');

// Create indexes for efficient querying
async function createIndexes() {
  try {
    // Index for sorting by due date
    await db.createIndex({
      index: {
        fields: ['version', 'due'],
      },
      name: 'version-due-index',
      type: 'json',
    });

    // Index for context and due date
    await db.createIndex({
      index: {
        fields: ['version', 'context', 'due'],
      },
      name: 'version-context-due-index',
      type: 'json',
    });

    // Index for completed status and due date
    await db.createIndex({
      index: {
        fields: ['version', 'completed', 'due'],
      },
      name: 'version-completed-due-index',
      type: 'json',
    });

    console.log('✅ CouchDB indexes created successfully');
  } catch (error: unknown) {
    if (
      error &&
      typeof error === 'object' &&
      'statusCode' in error &&
      error.statusCode === 409
    ) {
      console.log('ℹ️  Indexes already exist');
    } else {
      console.error('❌ Error creating indexes:', error);
    }
  }
}

// Create Todo Tool
server.addTool({
  name: 'createTodo',
  description: `Create a new todo item in the Eddo system. 
    
    Creates a TodoAlpha3 object with:
    - Auto-generated ID (current ISO timestamp)
    - Empty time tracking (active: {})
    - Not completed status (completed: null)
    - Default due date of end of current day if not specified
    
    Returns: "Todo created with ID: <generated-id>"`,
  parameters: z.object({
    title: z.string().describe('The main title/name of the todo item (required)'),
    description: z
      .string()
      .default('')
      .describe('Detailed description or notes for the todo. Can include markdown formatting'),
    context: z
      .string()
      .default('private')
      .describe('GTD context category for organizing todos (e.g. "work", "private", "errands", "shopping", "calls")'),
    due: z
      .string()
      .optional()
      .describe('Due date in ISO format (YYYY-MM-DDTHH:mm:ss.sssZ). Defaults to 23:59:59.999Z of current day if not provided'),
    tags: z
      .array(z.string())
      .default([])
      .describe('Array of tags for categorization and filtering. Can be used for projects, priorities, or custom categories'),
    repeat: z
      .number()
      .nullable()
      .default(null)
      .describe('Number of days to repeat this todo after completion. Set to null (default) for no repeat. When completed, a new todo will be created with due date shifted by this many days'),
    link: z
      .string()
      .nullable()
      .default(null)
      .describe('Optional URL or reference link related to this todo. Can be used for documentation, tickets, or external resources'),
  }),
  execute: async (args) => {
    const now = new Date().toISOString();
    const dueDate =
      args.due || new Date().toISOString().split('T')[0] + 'T23:59:59.999Z';

    const todo = {
      _id: now,
      active: {},
      completed: null,
      context: args.context,
      description: args.description,
      due: dueDate,
      link: args.link,
      repeat: args.repeat,
      tags: args.tags,
      title: args.title,
      version: 'alpha3',
    };

    const result = await db.insert(todo);
    return `Todo created with ID: ${result.id}`;
  },
});

// List Todos Tool
server.addTool({
  name: 'listTodos',
  description: 'List todos with optional filters',
  parameters: z.object({
    context: z
      .string()
      .optional()
      .describe('Filter todos by GTD context (e.g. "work", "private")'),
    completed: z
      .boolean()
      .optional()
      .describe(
        'Filter by completion status: true for completed todos (have completion timestamp), false for incomplete (null completion), undefined for all',
      ),
    dateFrom: z
      .string()
      .optional()
      .describe('Start date filter in ISO format (inclusive)'),
    dateTo: z
      .string()
      .optional()
      .describe('End date filter in ISO format (inclusive)'),
    limit: z
      .number()
      .default(50)
      .describe('Maximum number of todos to return (default: 50)'),
  }),
  execute: async (args) => {
    const selector: Record<string, unknown> = { version: 'alpha3' };

    if (args.context) {
      selector.context = args.context;
    }

    if (args.completed !== undefined) {
      selector.completed = args.completed ? { $ne: null } : null;
    }

    if (args.dateFrom || args.dateTo) {
      const dueFilter: Record<string, string> = {};
      if (args.dateFrom) dueFilter.$gte = args.dateFrom;
      if (args.dateTo) dueFilter.$lte = args.dateTo;
      selector.due = dueFilter;
    }

    const result = await db.find({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      selector: selector as any,
      limit: args.limit,
      sort: [{ due: 'asc' }],
    });

    return JSON.stringify(result.docs, null, 2);
  },
});

// Update Todo Tool
server.addTool({
  name: 'updateTodo',
  description:
    'Update an existing todo CouchDB style. Before doing this update, you need to find the todo using listTodos to determine the ID.',
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
  execute: async (args) => {
    const todo = (await db.get(args.id)) as TodoAlpha3;

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
    return `Todo updated: ${result.id}`;
  },
});

// Complete/Uncomplete Todo Tool
server.addTool({
  name: 'toggleTodoCompletion',
  description: 'Mark a todo as completed or uncompleted',
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
  execute: async (args) => {
    const todo = (await db.get(args.id)) as TodoAlpha3;
    const now = new Date().toISOString();

    if (args.completed && !todo.completed) {
      todo.completed = now;

      // Handle repeating todos
      if (todo.repeat) {
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
        return `Todo completed and repeated for ${newDueDate.toISOString()}`;
      }
    } else if (!args.completed) {
      todo.completed = null;
    }

    await db.insert(todo);
    return `Todo ${args.completed ? 'completed' : 'uncompleted'}: ${
      todo.title
    }`;
  },
});

// Delete Todo Tool
server.addTool({
  name: 'deleteTodo',
  description: 'Delete a todo permanently',
  parameters: z.object({
    id: z
      .string()
      .describe(
        'The unique identifier of the todo to delete (ISO timestamp of creation)',
      ),
  }),
  execute: async (args) => {
    const todo = (await db.get(args.id)) as TodoAlpha3;
    await db.destroy(todo._id, todo._rev!);
    return `Todo deleted: ${todo.title}`;
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
  execute: async (args) => {
    const todo = (await db.get(args.id)) as TodoAlpha3;
    const now = new Date().toISOString();

    todo.active[now] = null;
    await db.insert(todo);

    return `Started time tracking for: ${todo.title}`;
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
  execute: async (args) => {
    const todo = (await db.get(args.id)) as TodoAlpha3;
    const now = new Date().toISOString();

    // Find the active tracking session (value is null)
    const activeSession = Object.entries(todo.active).find(
      ([_, end]) => end === null,
    );

    if (activeSession) {
      todo.active[activeSession[0]] = now;
      await db.insert(todo);
      return `Stopped time tracking for: ${todo.title}`;
    }

    return `No active time tracking found for: ${todo.title}`;
  },
});

// Query Active Time Tracking Tool
server.addTool({
  name: 'getActiveTimeTracking',
  description: 'Get todos with active time tracking',
  parameters: z
    .object({})
    .describe(
      'No parameters required - returns all todos with active time tracking',
    ),
  execute: async () => {
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

    return JSON.stringify(activeTodos, null, 2);
  },
});

// Get Server Info Tool
server.addTool({
  name: 'getServerInfo',
  description: 'Get comprehensive information about the Eddo MCP server, including data model, available tools, and usage examples',
  parameters: z.object({
    section: z
      .enum(['overview', 'datamodel', 'tools', 'examples', 'all'])
      .default('all')
      .describe('Specific section of documentation to retrieve'),
  }),
  execute: async (args) => {
    const sections: Record<string, string> = {
      overview: `# Eddo MCP Server Overview
      
The Eddo MCP server provides a Model Context Protocol interface for the Eddo GTD-inspired todo and time tracking application.

- **Database**: CouchDB (http://localhost:5984/todos-dev)
- **Data Model**: TodoAlpha3 schema
- **Features**: Todo CRUD, time tracking, repeating tasks, GTD contexts
- **Port**: 3001 (http://localhost:3001/mcp)`,

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
9. **getServerInfo** - Get this documentation`,

      examples: `# Usage Examples

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
    };

    if (args.section === 'all') {
      return Object.values(sections).join('\n\n---\n\n');
    }

    return sections[args.section] || 'Invalid section. Choose from: overview, datamodel, tools, examples, all';
  },
});

// Export the server instance and start function
export const mcpServer = server;

export async function startMcpServer() {
  try {
    // Create indexes before starting the server
    await createIndexes();

    // Start the server on a different port than Vite
    await server.start({
      transportType: 'httpStream',
      httpStream: {
        port: 3001, // Different from Vite dev server (5173)
        // corsOptions: {
        //   origin: 'http://localhost:5173', // Allow Vite dev server
        //   credentials: true,
        // },
      },
      instructions: 'Eddo Todo MCP Server - Manages GTD-style todos with time tracking. Creates, updates, lists todos with contexts ("work", "private"), due dates, tags, and repeat intervals. Supports time tracking start/stop and completion status. Uses CouchDB backend with TodoAlpha3 schema. Default context is "private", default due is end of current day. Use getServerInfo tool for complete documentation and examples.',
    });

    console.log('🚀 Eddo MCP server running on port 3001');
    console.log('📡 Connect with: http://localhost:3001/mcp');
  } catch (error) {
    console.error('❌ Failed to start MCP server:', error);
  }
}
