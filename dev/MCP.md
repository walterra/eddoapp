# MCP Server for Eddo

This document outlines the implementation of a Model Context Protocol (MCP) server integrated into the existing Eddo GTD web app using FastMCP, enabling LLM applications like Claude Code to interact with todos programmatically.

## Overview

The MCP server will be integrated directly into the existing Vite/React application, exposing the same todo management capabilities available through the UI, allowing LLMs to:
- Create, read, update, and delete todos
- Manage time tracking (start/stop)
- Handle repeating todos
- Query todos by date range, context, or completion status

## Architecture

```
LLM Client (Claude Code) <--MCP--> Vite Dev Server + FastMCP <---> PouchDB (Browser)
```

The MCP server will run alongside the Vite development server, sharing the same PouchDB database instance used by the React frontend.

## Implementation Plan

### 1. Add Dependencies to Existing Project

```bash
# Add MCP server dependencies to existing package.json
pnpm add fastmcp zod
pnpm add -D @types/node tsx
```

### 2. Create MCP Server Module

Create a new server module that can be run alongside the Vite dev server:

```typescript
// src/mcp-server.ts
import { FastMCP } from 'fastmcp';
import { z } from 'zod';
import PouchDB from 'pouchdb-browser';
import PouchDBFind from 'pouchdb-find';

// Use the same PouchDB setup as the main app
PouchDB.plugin(PouchDBFind);

const server = new FastMCP({
  name: 'eddo-mcp',
  version: '1.0.0',
  description: 'MCP server for Eddo GTD todo management'
});

// Initialize PouchDB with same database name as main app
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

### 4. Complete the MCP Server

```typescript
// src/mcp-server.ts (continued)

// Start the server on a different port than Vite
server.start({
  transportType: 'httpStream',
  httpStream: {
    port: 3001, // Different from Vite dev server (5173)
    corsOptions: {
      origin: 'http://localhost:5173', // Allow Vite dev server
      credentials: true
    }
  }
});

console.log('Eddo MCP server running on port 3001');
console.log('Connect with: http://localhost:3001/mcp');
```

### 5. Create Standalone MCP Server Script

Create a separate script to run the MCP server:

```typescript
// scripts/start-mcp.ts
import '../src/mcp-server.js';
```

### 6. Update Package.json Scripts

Add new scripts to run the MCP server alongside the development server:

```json
{
  "scripts": {
    "dev": "vite dev",
    "dev:mcp": "tsx scripts/start-mcp.ts",
    "dev:all": "npm-run-all --parallel dev dev:mcp",
    "build": "vite build",
    "build:mcp": "tsc src/mcp-server.ts --outDir dist-mcp --target es2020 --module commonjs"
  }
}
```

### 7. Alternative: Vite Plugin Integration

For tighter integration, you could create a Vite plugin that starts the MCP server:

```typescript
// vite.config.ts
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Custom plugin to start MCP server during development
function mcpServerPlugin() {
  return {
    name: 'mcp-server',
    configureServer() {
      // Import and start MCP server when Vite dev server starts
      import('./src/mcp-server.js');
    }
  };
}

export default defineConfig({
  plugins: [
    react(),
    mcpServerPlugin() // Add MCP server plugin
  ]
});
```

### 8. Client Configuration for Claude Code

#### Option A: HTTP Streaming (Recommended)
```json
{
  "mcpServers": {
    "eddo": {
      "url": "http://localhost:3001/mcp"
    }
  }
}
```

#### Option B: Stdio Transport
```json
{
  "mcpServers": {
    "eddo": {
      "command": "tsx",
      "args": ["scripts/start-mcp.ts"],
      "cwd": "/path/to/eddoapp",
      "env": {}
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

### Method 1: Separate Processes (Recommended)
```bash
# Terminal 1: Start Vite dev server
pnpm dev

# Terminal 2: Start MCP server
pnpm dev:mcp

# Or run both simultaneously
pnpm dev:all
```

### Method 2: Vite Plugin (Integrated)
```bash
# Single command starts both servers
pnpm dev
```

### Database Considerations

Since both the React app and MCP server use the same PouchDB database (`'eddo-todos'`), they will share the same data. However, consider:

1. **Browser vs Node.js PouchDB**: 
   - React app uses `pouchdb-browser` (IndexedDB)
   - MCP server would need `pouchdb-node` (LevelDB) or connect to browser storage
   
2. **Shared Storage Solution**:
   ```typescript
   // Option 1: MCP server uses filesystem storage
   const db = new PouchDB('./eddo-todos-mcp');
   
   // Option 2: Both connect to CouchDB instance
   const db = new PouchDB('http://localhost:5984/eddo-todos');
   ```

3. **Data Sync**: Implement sync between browser and MCP server databases:
   ```typescript
   // In MCP server
   const browserDB = new PouchDB('http://localhost:5984/eddo-todos');
   const serverDB = new PouchDB('./eddo-todos-mcp');
   
   // Bidirectional sync
   serverDB.sync(browserDB, { live: true, retry: true });
   ```

### Testing with Claude Code

1. **Start both servers**:
   ```bash
   pnpm dev:all
   ```

2. **Configure Claude Desktop** with the MCP server URL

3. **Test commands**:
   ```
   Create a new todo "Review MCP implementation" for tomorrow in work context
   List all incomplete todos for this week
   Start time tracking for todo with ID xxx
   ```

4. **Verify data consistency**: Changes via MCP should appear in the React UI and vice versa

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