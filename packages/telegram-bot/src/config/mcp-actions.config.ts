
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
