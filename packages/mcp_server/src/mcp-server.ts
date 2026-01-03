/**
 * MCP Server with Per-Request Authentication
 * Implements proper stateless authentication following MCP best practices
 */
import { type TodoAlpha3, getCouchDbConfig, validateEnv } from '@eddo/core-server';
import { dotenvLoad } from 'dotenv-mono';
import { FastMCP } from 'fastmcp';
import nano from 'nano';

import { validateUserContext } from './auth/user-auth.js';
import {
  createTodoDescription,
  createTodoParameters,
  deleteTodoDescription,
  deleteTodoParameters,
  executeCreateTodo,
  executeDeleteTodo,
  executeGetActiveTimeTracking,
  executeGetBriefingData,
  executeGetRecapData,
  executeGetServerInfo,
  executeGetUserInfo,
  executeListTodos,
  executeStartTimeTracking,
  executeStopTimeTracking,
  executeToggleCompletion,
  executeUpdateTodo,
  getActiveTimeTrackingDescription,
  getActiveTimeTrackingParameters,
  getBriefingDataDescription,
  getBriefingDataParameters,
  getRecapDataDescription,
  getRecapDataParameters,
  getServerInfoDescription,
  getServerInfoParameters,
  getUserInfoDescription,
  getUserInfoParameters,
  listTodosDescription,
  listTodosParameters,
  startTimeTrackingDescription,
  startTimeTrackingParameters,
  stopTimeTrackingDescription,
  stopTimeTrackingParameters,
  toggleCompletionDescription,
  toggleCompletionParameters,
  updateTodoDescription,
  updateTodoParameters,
} from './tools/index.js';
import type { ToolContext, UserSession } from './tools/types.js';

// Load environment variables
dotenvLoad();

// Validate environment
const env = validateEnv(process.env);

// Initialize nano connection
const couchDbConfig = getCouchDbConfig(env);
const couch = nano(couchDbConfig.url);

/**
 * Server instructions for LLM consumption
 */
const SERVER_INSTRUCTIONS = `Eddo Todo MCP Server with user registry authentication and GTD tag awareness. Pass X-User-ID, X-Database-Name, and X-Telegram-ID headers for user-specific database access. Each user gets an isolated database.

GTD SYSTEM:
- TAGS: gtd:next, gtd:project, gtd:waiting, gtd:someday, gtd:calendar (for actionability/type)
- CONTEXT: work, private, errands, etc. (for location/situation)
- DUE FIELD: For gtd:calendar = exact appointment time, for others = deadline/target

When creating todos, add appropriate GTD tags AND set proper context:
- tags: ["gtd:next"] + context: "work" for work actionable items
- tags: ["gtd:project"] + context: "private" for personal projects
- tags: ["gtd:waiting"] + context: "work" for work dependencies
- tags: ["gtd:calendar"] + context: "work" for appointments/meetings

APPOINTMENT CREATION RULE: For gtd:calendar items, ALWAYS prefix title with time in HH:MM format:
- "Doctor appointment at 3pm" → title: "15:00 Doctor appointment"
- "Meeting tomorrow at 10:30" → title: "10:30 Meeting"

For GTD queries like "what's next?", filter by gtd:next tags and optionally by context.`;

// Create server with authentication
const server = new FastMCP<UserSession>({
  name: 'eddo-mcp-auth',
  version: '1.0.0',
  ping: { logLevel: 'info' },
  instructions: SERVER_INSTRUCTIONS,
  authenticate: async (request) => {
    console.log('MCP authentication request');

    const username = request.headers['x-user-id'] || request.headers['X-User-ID'];

    if (!username) {
      console.log('MCP connection without user headers (connection handshake)');
      return { userId: 'anonymous', dbName: 'default', username: 'anonymous' };
    }

    const authResult = await validateUserContext(request.headers);
    return {
      userId: authResult.userId,
      dbName: authResult.dbName,
      username: authResult.username,
    };
  },
});

/**
 * Gets the user's database from context
 */
function getUserDb(context: ToolContext): nano.DocumentScope<TodoAlpha3> {
  if (!context.session) {
    throw new Error('No user session available');
  }

  if (context.session.userId === 'anonymous') {
    throw new Error(
      'Tool calls require user authentication headers (X-User-ID, X-Database-Name, X-Telegram-ID)',
    );
  }

  return couch.db.use<TodoAlpha3>(context.session.dbName);
}

// Register all tools
server.addTool({
  name: 'createTodo',
  description: createTodoDescription,
  parameters: createTodoParameters,
  execute: async (args, context) => executeCreateTodo(args, context, getUserDb, couch),
});

server.addTool({
  name: 'listTodos',
  description: listTodosDescription,
  parameters: listTodosParameters,
  execute: async (args, context) => executeListTodos(args, context, getUserDb),
});

server.addTool({
  name: 'getUserInfo',
  description: getUserInfoDescription,
  parameters: getUserInfoParameters,
  execute: async (_, context) => executeGetUserInfo({}, context),
});

server.addTool({
  name: 'updateTodo',
  description: updateTodoDescription,
  parameters: updateTodoParameters,
  execute: async (args, context) => executeUpdateTodo(args, context, getUserDb),
});

server.addTool({
  name: 'toggleTodoCompletion',
  description: toggleCompletionDescription,
  parameters: toggleCompletionParameters,
  execute: async (args, context) => executeToggleCompletion(args, context, getUserDb),
});

server.addTool({
  name: 'deleteTodo',
  description: deleteTodoDescription,
  parameters: deleteTodoParameters,
  execute: async (args, context) => executeDeleteTodo(args, context, getUserDb),
});

server.addTool({
  name: 'startTimeTracking',
  description: startTimeTrackingDescription,
  parameters: startTimeTrackingParameters,
  execute: async (args, context) => executeStartTimeTracking(args, context, getUserDb),
});

server.addTool({
  name: 'stopTimeTracking',
  description: stopTimeTrackingDescription,
  parameters: stopTimeTrackingParameters,
  execute: async (args, context) => executeStopTimeTracking(args, context, getUserDb),
});

server.addTool({
  name: 'getActiveTimeTracking',
  description: getActiveTimeTrackingDescription,
  parameters: getActiveTimeTrackingParameters,
  execute: async (_args, context) => executeGetActiveTimeTracking({}, context, getUserDb),
});

server.addTool({
  name: 'getServerInfo',
  description: getServerInfoDescription,
  parameters: getServerInfoParameters,
  execute: async (args, context) => executeGetServerInfo(args, context, getUserDb),
});

server.addTool({
  name: 'getBriefingData',
  description: getBriefingDataDescription,
  parameters: getBriefingDataParameters,
  execute: async (_args, context) => executeGetBriefingData({}, context, getUserDb),
});

server.addTool({
  name: 'getRecapData',
  description: getRecapDataDescription,
  parameters: getRecapDataParameters,
  execute: async (_args, context) => executeGetRecapData({}, context, getUserDb),
});

// Export the server instance and control functions
export const mcpServer = server;

/**
 * Stops the MCP server
 */
export async function stopMcpServer(): Promise<void> {
  try {
    await server.stop();
    console.log('✅ Eddo MCP server stopped');
  } catch (error) {
    console.error('❌ Failed to stop MCP server:', error);
    throw error;
  }
}

/**
 * Starts the MCP server on the specified port
 */
export async function startMcpServer(port: number = 3001): Promise<void> {
  try {
    console.log(`🔧 Initializing Eddo MCP server with auth on port ${port}...`);

    // Verify CouchDB server connection
    const serverInfo = await couch.info();
    console.log(`✅ Connected to CouchDB ${serverInfo.version}`);

    await server.start({
      transportType: 'httpStream',
      httpStream: { port },
    });

    console.log(`🚀 Eddo MCP server with auth running on port ${port}`);
    console.log(`📡 Connect with: http://localhost:${port}/mcp`);
    console.log(`🔐 Authentication: Pass X-API-Key header`);
    console.log(
      '📋 Available tools: createTodo, listTodos, updateTodo, toggleTodoCompletion, deleteTodo, startTimeTracking, stopTimeTracking, getActiveTimeTracking, getServerInfo, getUserInfo, getBriefingData, getRecapData',
    );
  } catch (error) {
    console.error('❌ Failed to start MCP server:', error);
    throw error;
  }
}

// Auto-start the server when this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startMcpServer(env.MCP_SERVER_PORT).catch((error) => {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  });
}
