/**
 * MCP Tools - Exports all tool handlers and their schemas
 */

// Types
export type { CouchServer, GetUserDb, ToolContext, ToolResponse, UserSession } from './types.js';

// Response helpers
export {
  createEmptyDatabaseResponse,
  createErrorResponse,
  createSuccessResponse,
} from './response-helpers.js';

// Create Todo
export {
  createTodoDescription,
  createTodoParameters,
  executeCreateTodo,
  type CreateTodoArgs,
} from './create-todo.js';

// List Todos
export {
  executeListTodos,
  listTodosDescription,
  listTodosParameters,
  type ListTodosArgs,
} from './list-todos.js';

// Update Todo
export {
  executeUpdateTodo,
  updateTodoDescription,
  updateTodoParameters,
  type UpdateTodoArgs,
} from './update-todo.js';

// Toggle Completion
export {
  executeToggleCompletion,
  toggleCompletionDescription,
  toggleCompletionParameters,
  type ToggleCompletionArgs,
} from './toggle-completion.js';

// Delete Todo
export {
  deleteTodoDescription,
  deleteTodoParameters,
  executeDeleteTodo,
  type DeleteTodoArgs,
} from './delete-todo.js';

// Time Tracking
export {
  executeGetActiveTimeTracking,
  executeStartTimeTracking,
  executeStopTimeTracking,
  getActiveTimeTrackingDescription,
  getActiveTimeTrackingParameters,
  startTimeTrackingDescription,
  startTimeTrackingParameters,
  stopTimeTrackingDescription,
  stopTimeTrackingParameters,
  type StartTimeTrackingArgs,
  type StopTimeTrackingArgs,
} from './time-tracking.js';

// User Info
export { executeGetUserInfo, getUserInfoDescription, getUserInfoParameters } from './user-info.js';

// Server Info
export {
  executeGetServerInfo,
  getServerInfoDescription,
  getServerInfoParameters,
  type GetServerInfoArgs,
} from './server-info.js';
