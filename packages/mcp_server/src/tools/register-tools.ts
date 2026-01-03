/**
 * MCP tool registration with tracing support
 */
import type { TodoAlpha3 } from '@eddo/core-server';
import type { FastMCP } from 'fastmcp';
import type nano from 'nano';

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
  executeGetTodo,
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
  getTodoDescription,
  getTodoParameters,
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
} from './index.js';
import { wrapToolExecution } from './tool-wrapper.js';
import type { ToolContext, UserSession } from './types.js';

type GetUserDbFn = (context: ToolContext) => nano.DocumentScope<TodoAlpha3>;

/** Registers todo CRUD tools */
function registerTodoTools(
  server: FastMCP<UserSession>,
  getUserDb: GetUserDbFn,
  couch: nano.ServerScope,
): void {
  server.addTool({
    name: 'createTodo',
    description: createTodoDescription,
    parameters: createTodoParameters,
    execute: wrapToolExecution('createTodo', (args, ctx) =>
      executeCreateTodo(args, ctx, getUserDb, couch),
    ),
  });

  server.addTool({
    name: 'listTodos',
    description: listTodosDescription,
    parameters: listTodosParameters,
    execute: wrapToolExecution('listTodos', (args, ctx) => executeListTodos(args, ctx, getUserDb)),
  });

  server.addTool({
    name: 'getTodo',
    description: getTodoDescription,
    parameters: getTodoParameters,
    execute: wrapToolExecution('getTodo', (args, ctx) => executeGetTodo(args, ctx, getUserDb)),
  });

  server.addTool({
    name: 'updateTodo',
    description: updateTodoDescription,
    parameters: updateTodoParameters,
    execute: wrapToolExecution('updateTodo', (args, ctx) =>
      executeUpdateTodo(args, ctx, getUserDb),
    ),
  });

  server.addTool({
    name: 'toggleTodoCompletion',
    description: toggleCompletionDescription,
    parameters: toggleCompletionParameters,
    execute: wrapToolExecution('toggleTodoCompletion', (args, ctx) =>
      executeToggleCompletion(args, ctx, getUserDb),
    ),
  });

  server.addTool({
    name: 'deleteTodo',
    description: deleteTodoDescription,
    parameters: deleteTodoParameters,
    execute: wrapToolExecution('deleteTodo', (args, ctx) =>
      executeDeleteTodo(args, ctx, getUserDb),
    ),
  });
}

/** Registers time tracking tools */
function registerTimeTrackingTools(server: FastMCP<UserSession>, getUserDb: GetUserDbFn): void {
  server.addTool({
    name: 'startTimeTracking',
    description: startTimeTrackingDescription,
    parameters: startTimeTrackingParameters,
    execute: wrapToolExecution('startTimeTracking', (args, ctx) =>
      executeStartTimeTracking(args, ctx, getUserDb),
    ),
  });

  server.addTool({
    name: 'stopTimeTracking',
    description: stopTimeTrackingDescription,
    parameters: stopTimeTrackingParameters,
    execute: wrapToolExecution('stopTimeTracking', (args, ctx) =>
      executeStopTimeTracking(args, ctx, getUserDb),
    ),
  });

  server.addTool({
    name: 'getActiveTimeTracking',
    description: getActiveTimeTrackingDescription,
    parameters: getActiveTimeTrackingParameters,
    execute: wrapToolExecution('getActiveTimeTracking', (_args, ctx) =>
      executeGetActiveTimeTracking({}, ctx, getUserDb),
    ),
  });
}

/** Registers utility and info tools */
function registerUtilityTools(server: FastMCP<UserSession>, getUserDb: GetUserDbFn): void {
  server.addTool({
    name: 'getUserInfo',
    description: getUserInfoDescription,
    parameters: getUserInfoParameters,
    execute: wrapToolExecution('getUserInfo', (_, ctx) => executeGetUserInfo({}, ctx)),
  });

  server.addTool({
    name: 'getServerInfo',
    description: getServerInfoDescription,
    parameters: getServerInfoParameters,
    execute: wrapToolExecution('getServerInfo', (args, ctx) =>
      executeGetServerInfo(args, ctx, getUserDb),
    ),
  });

  server.addTool({
    name: 'getBriefingData',
    description: getBriefingDataDescription,
    parameters: getBriefingDataParameters,
    execute: wrapToolExecution('getBriefingData', (_args, ctx) =>
      executeGetBriefingData({}, ctx, getUserDb),
    ),
  });

  server.addTool({
    name: 'getRecapData',
    description: getRecapDataDescription,
    parameters: getRecapDataParameters,
    execute: wrapToolExecution('getRecapData', (_args, ctx) =>
      executeGetRecapData({}, ctx, getUserDb),
    ),
  });
}

/**
 * Registers all MCP tools on the server with tracing wrappers
 */
export function registerTools(
  server: FastMCP<UserSession>,
  getUserDb: GetUserDbFn,
  couch: nano.ServerScope,
): void {
  registerTodoTools(server, getUserDb, couch);
  registerTimeTrackingTools(server, getUserDb);
  registerUtilityTools(server, getUserDb);
}
