import type { ActionMetadata } from '../services/action-registry.js';

/**
 * Configuration for MCP actions including legacy mappings and fallbacks
 */
export const MCP_ACTION_CONFIG = {
  /**
   * Legacy snake_case to camelCase mappings for backward compatibility
   */
  aliasMapping: {
    // CRUD operations
    list_todos: 'listTodos',
    create_todo: 'createTodo',
    update_todo: 'updateTodo',
    delete_todo: 'deleteTodo',
    toggle_completion: 'toggleTodoCompletion',

    // Time tracking
    start_time_tracking: 'startTimeTracking',
    stop_time_tracking: 'stopTimeTracking',
    get_active_timers: 'getActiveTimeTracking',

    // Artificial/meta actions
    execute_simple_task: 'executeSimpleTask',
    execute_fallback_task: 'executeFallbackTask',
    daily_summary: 'dailySummary',
    analysis: 'analysis',
  },

  /**
   * Tool name variations for backward compatibility
   * Maps action names to arrays of possible tool names
   */
  toolVariants: {
    createTodo: ['createTodo', 'create', 'addTodo', 'eddo_todo_createTodo'],
    listTodos: ['listTodos', 'list', 'getTodos', 'eddo_todo_listTodos'],
    updateTodo: ['updateTodo', 'update', 'editTodo', 'eddo_todo_updateTodo'],
    deleteTodo: ['deleteTodo', 'delete', 'removeTodo', 'eddo_todo_deleteTodo'],
    toggleTodoCompletion: [
      'toggleTodoCompletion',
      'toggle',
      'toggleCompletion',
      'completeTodo',
      'eddo_todo_toggleTodoCompletion',
    ],
    startTimeTracking: [
      'startTimeTracking',
      'startTimer',
      'trackTime',
      'eddo_todo_startTimeTracking',
    ],
    stopTimeTracking: [
      'stopTimeTracking',
      'stopTimer',
      'endTracking',
      'eddo_todo_stopTimeTracking',
    ],
    getActiveTimeTracking: [
      'getActiveTimeTracking',
      'activeTimers',
      'getTimers',
      'eddo_todo_getActiveTimeTracking',
    ],
  },

  /**
   * Fallback actions when MCP server is not available
   * These are used to maintain functionality even without server connection
   */
  fallbackActions: new Map<string, ActionMetadata>([
    [
      'listTodos',
      {
        name: 'listTodos',
        aliases: ['list_todos', 'getTodos', 'list'],
        category: 'crud',
        description: 'List todos with optional filtering',
      },
    ],
    [
      'createTodo',
      {
        name: 'createTodo',
        aliases: ['create_todo', 'addTodo', 'create'],
        category: 'crud',
        description: 'Create a new todo item',
      },
    ],
    [
      'updateTodo',
      {
        name: 'updateTodo',
        aliases: ['update_todo', 'editTodo', 'update'],
        category: 'crud',
        description: 'Update an existing todo',
      },
    ],
    [
      'deleteTodo',
      {
        name: 'deleteTodo',
        aliases: ['delete_todo', 'removeTodo', 'delete'],
        category: 'crud',
        description: 'Delete a todo',
      },
    ],
    [
      'toggleTodoCompletion',
      {
        name: 'toggleTodoCompletion',
        aliases: ['toggle_completion', 'toggleCompletion', 'completeTodo'],
        category: 'crud',
        description: 'Toggle todo completion status',
      },
    ],
    [
      'startTimeTracking',
      {
        name: 'startTimeTracking',
        aliases: ['start_time_tracking', 'startTimer'],
        category: 'time-tracking',
        description: 'Start time tracking for a todo',
      },
    ],
    [
      'stopTimeTracking',
      {
        name: 'stopTimeTracking',
        aliases: ['stop_time_tracking', 'stopTimer'],
        category: 'time-tracking',
        description: 'Stop time tracking for a todo',
      },
    ],
    [
      'getActiveTimeTracking',
      {
        name: 'getActiveTimeTracking',
        aliases: ['get_active_timers', 'activeTimers'],
        category: 'time-tracking',
        description: 'Get todos with active time tracking',
      },
    ],
  ]),

  /**
   * Action categories for better organization in prompts
   */
  actionCategories: {
    crud: {
      title: 'Todo Management',
      description: 'Create, read, update, and delete todos',
    },
    'time-tracking': {
      title: 'Time Tracking',
      description: 'Track time spent on todos',
    },
    utility: {
      title: 'Utility Functions',
      description: 'Helper functions and utilities',
    },
    analysis: {
      title: 'Analysis & Reports',
      description: 'Generate summaries and analyze data',
    },
    integration: {
      title: 'Integrations',
      description: 'Connect with external services',
    },
  },
};
