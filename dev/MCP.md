# MCP Server for Eddo

This document outlines the implementation of a Model Context Protocol (MCP) server for the Eddo GTD app using FastMCP, enabling LLM applications like Claude Code to interact with todos programmatically.

## Overview

The MCP server will expose the same todo management capabilities available through the UI, allowing LLMs to:
- Create, read, update, and delete todos
- Manage time tracking (start/stop)
- Handle repeating todos
- Query todos by date range, context, or completion status

## Architecture

```
LLM Client (Claude Code) <--MCP--> FastMCP Server <---> PouchDB
```

## Implementation Plan

### 1. Project Setup

```bash
# Create MCP server directory
mkdir eddo-mcp-server
cd eddo-mcp-server

# Initialize and install dependencies
npm init -y
npm install fastmcp zod pouchdb pouchdb-find @types/pouchdb
npm install -D typescript @types/node tsx
```

### 2. Server Configuration

```typescript
// server.ts
import { FastMCP } from 'fastmcp';
import { z } from 'zod';
import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';

PouchDB.plugin(PouchDBFind);

const server = new FastMCP({
  name: 'eddo-mcp',
  version: '1.0.0',
  description: 'MCP server for Eddo GTD todo management'
});

// Initialize PouchDB
const db = new PouchDB('eddo-todos');
```

### 3. Define MCP Tools

#### 3.1 Create Todo

```typescript
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
    link: z.string().nullable().default(null)
  }),
  execute: async (args) => {
    const now = new Date().toISOString();
    const dueDate = args.due || new Date().toISOString().split('T')[0] + 'T23:59:59.999Z';
    
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
      version: 'alpha3' as const
    };
    
    const result = await db.put(todo);
    return `Todo created with ID: ${result.id}`;
  }
});
```

#### 3.2 List Todos

```typescript
server.addTool({
  name: 'listTodos',
  description: 'List todos with optional filters',
  parameters: z.object({
    context: z.string().optional(),
    completed: z.boolean().optional(),
    dateFrom: z.string().optional(), // ISO date
    dateTo: z.string().optional(),    // ISO date
    limit: z.number().default(50)
  }),
  execute: async (args) => {
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
    
    const result = await db.find({
      selector,
      limit: args.limit,
      sort: [{ due: 'asc' }]
    });
    
    return JSON.stringify(result.docs, null, 2);
  }
});
```

#### 3.3 Update Todo

```typescript
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
    link: z.string().nullable().optional()
  }),
  execute: async (args) => {
    const todo = await db.get(args.id);
    
    const updated = {
      ...todo,
      title: args.title ?? todo.title,
      description: args.description ?? todo.description,
      context: args.context ?? todo.context,
      due: args.due ?? todo.due,
      tags: args.tags ?? todo.tags,
      repeat: args.repeat !== undefined ? args.repeat : todo.repeat,
      link: args.link !== undefined ? args.link : todo.link
    };
    
    const result = await db.put(updated);
    return `Todo updated: ${result.id}`;
  }
});
```

#### 3.4 Complete/Uncomplete Todo

```typescript
server.addTool({
  name: 'toggleTodoCompletion',
  description: 'Mark a todo as completed or uncompleted',
  parameters: z.object({
    id: z.string(),
    completed: z.boolean()
  }),
  execute: async (args) => {
    const todo = await db.get(args.id);
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
          _rev: undefined,
          completed: null,
          active: {},
          due: newDueDate.toISOString()
        };
        
        await db.put(newTodo);
        await db.put(todo);
        return `Todo completed and repeated for ${newDueDate.toISOString()}`;
      }
    } else if (!args.completed) {
      todo.completed = null;
    }
    
    await db.put(todo);
    return `Todo ${args.completed ? 'completed' : 'uncompleted'}: ${todo.title}`;
  }
});
```

#### 3.5 Delete Todo

```typescript
server.addTool({
  name: 'deleteTodo',
  description: 'Delete a todo permanently',
  parameters: z.object({
    id: z.string()
  }),
  execute: async (args) => {
    const todo = await db.get(args.id);
    await db.remove(todo);
    return `Todo deleted: ${todo.title}`;
  }
});
```

#### 3.6 Time Tracking

```typescript
server.addTool({
  name: 'startTimeTracking',
  description: 'Start tracking time for a todo',
  parameters: z.object({
    id: z.string()
  }),
  execute: async (args) => {
    const todo = await db.get(args.id);
    const now = new Date().toISOString();
    
    todo.active[now] = null;
    await db.put(todo);
    
    return `Started time tracking for: ${todo.title}`;
  }
});

server.addTool({
  name: 'stopTimeTracking',
  description: 'Stop tracking time for a todo',
  parameters: z.object({
    id: z.string()
  }),
  execute: async (args) => {
    const todo = await db.get(args.id);
    const now = new Date().toISOString();
    
    // Find the active tracking session (value is null)
    const activeSession = Object.entries(todo.active).find(([_, end]) => end === null);
    
    if (activeSession) {
      todo.active[activeSession[0]] = now;
      await db.put(todo);
      return `Stopped time tracking for: ${todo.title}`;
    }
    
    return `No active time tracking found for: ${todo.title}`;
  }
});
```

#### 3.7 Query Active Time Tracking

```typescript
server.addTool({
  name: 'getActiveTimeTracking',
  description: 'Get todos with active time tracking',
  parameters: z.object({}),
  execute: async () => {
    const result = await db.find({
      selector: {
        version: 'alpha3',
        active: { $exists: true }
      }
    });
    
    const activeTodos = result.docs.filter(todo => 
      Object.values(todo.active).some(end => end === null)
    );
    
    return JSON.stringify(activeTodos, null, 2);
  }
});
```

### 4. Start the Server

```typescript
// server.ts (continued)
server.start({
  transportType: 'httpStream',
  httpStream: {
    port: 3000,
    corsOptions: {
      origin: '*', // Configure appropriately for production
      credentials: true
    }
  }
});

console.log('Eddo MCP server running on port 3000');
```

### 5. Client Configuration for Claude Code

To use the MCP server with Claude Code, add to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "eddo": {
      "command": "node",
      "args": ["/path/to/eddo-mcp-server/dist/server.js"],
      "env": {}
    }
  }
}
```

Or for HTTP streaming:

```json
{
  "mcpServers": {
    "eddo": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

## Security Considerations

1. **Authentication**: Consider implementing API key authentication for production use
2. **CORS**: Configure CORS appropriately to restrict access
3. **Input Validation**: Zod schemas provide basic validation, but add business logic validation
4. **Rate Limiting**: Implement rate limiting for production deployments
5. **Database Access**: Consider using a separate database instance for MCP access

## Development Workflow

1. **TypeScript Build**:
   ```bash
   npx tsc --init
   # Configure tsconfig.json for ES modules and Node.js
   npx tsc
   ```

2. **Development Mode**:
   ```bash
   npx tsx watch server.ts
   ```

3. **Testing with Claude Code**:
   - Start the MCP server
   - Configure Claude Desktop
   - Test commands like:
     ```
     Create a new todo "Review MCP implementation" for tomorrow in work context
     List all incomplete todos for this week
     Start time tracking for todo with ID xxx
     ```

## Future Enhancements

1. **Bulk Operations**: Add tools for bulk updates/deletes
2. **Advanced Queries**: Support for tag filtering, text search
3. **Statistics**: Add tools for time tracking statistics
4. **Export/Import**: Tools for data export in various formats
5. **Notifications**: Real-time updates via WebSocket transport
6. **Multi-user Support**: User context and database isolation

## Example Usage in Claude Code

```
Human: Create a new todo "Implement MCP server" due tomorrow with tags ["development", "mcp"] in work context