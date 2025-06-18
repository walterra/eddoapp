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
  description: 'Create a new todo item',
  parameters: z.object({
    title: z.string(),
    description: z.string().default(''),
    context: z.string().default('private'),
    due: z.string().optional(), // ISO date string
    tags: z.array(z.string()).default([]),
    repeat: z.number().nullable().default(null),
    link: z.string().nullable().default(null),
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
    context: z.string().optional(),
    completed: z.boolean().optional(),
    dateFrom: z.string().optional(), // ISO date
    dateTo: z.string().optional(), // ISO date
    limit: z.number().default(50),
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
  description: 'Update an existing todo',
  parameters: z.object({
    id: z.string(),
    title: z.string().optional(),
    description: z.string().optional(),
    context: z.string().optional(),
    due: z.string().optional(),
    tags: z.array(z.string()).optional(),
    repeat: z.number().nullable().optional(),
    link: z.string().nullable().optional(),
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
    id: z.string(),
    completed: z.boolean(),
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
    id: z.string(),
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
    id: z.string(),
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
    id: z.string(),
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
  parameters: z.object({}),
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
    });

    console.log('🚀 Eddo MCP server running on port 3001');
    console.log('📡 Connect with: http://localhost:3001/mcp');
  } catch (error) {
    console.error('❌ Failed to start MCP server:', error);
  }
}
