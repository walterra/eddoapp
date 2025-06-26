import { logger } from '../utils/logger.js';

interface SimpleTool {
  name: string;
  description: string;
  invoke: (params: Record<string, unknown>) => Promise<unknown>;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: object;
}

export interface CreateTodoParams extends Record<string, unknown> {
  title: string;
  description?: string;
  context?: string;
  due?: string;
  tags?: string[];
  repeat?: number | null;
  link?: string | null;
}

export interface ListTodosParams extends Record<string, unknown> {
  context?: string;
  completed?: boolean;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}

export interface UpdateTodoParams extends Record<string, unknown> {
  id: string;
  title?: string;
  description?: string;
  context?: string;
  due?: string;
  tags?: string[];
  repeat?: number | null;
  link?: string | null;
}

export interface MCPClient {
  tools: SimpleTool[];
}

/**
 * Simple MCP integration that provides direct tool access
 */
export async function setupMCPIntegration(): Promise<MCPClient> {
  logger.info('Setting up simple MCP integration');

  // Mock tools for now - in a real implementation, these would connect to the MCP server
  const tools: SimpleTool[] = [
    {
      name: 'createTodo',
      description: 'Create a new todo item',
      invoke: async (params: Record<string, unknown>) => {
        logger.info('Creating todo', { params });
        return 'Todo created successfully';
      },
    },
    {
      name: 'listTodos',
      description: 'List todos with optional filters',
      invoke: async (params: Record<string, unknown>) => {
        logger.info('Listing todos', { params });
        return [];
      },
    },
    {
      name: 'updateTodo',
      description: 'Update an existing todo',
      invoke: async (params: Record<string, unknown>) => {
        logger.info('Updating todo', { params });
        return 'Todo updated successfully';
      },
    },
    {
      name: 'toggleTodoCompletion',
      description: 'Mark a todo as completed or incomplete',
      invoke: async (params: Record<string, unknown>) => {
        logger.info('Toggling todo completion', { params });
        return 'Todo completion toggled successfully';
      },
    },
    {
      name: 'deleteTodo',
      description: 'Delete a todo permanently',
      invoke: async (params: Record<string, unknown>) => {
        logger.info('Deleting todo', { params });
        return 'Todo deleted successfully';
      },
    },
    {
      name: 'startTimeTracking',
      description: 'Start tracking time for a todo',
      invoke: async (params: Record<string, unknown>) => {
        logger.info('Starting time tracking', { params });
        return 'Time tracking started';
      },
    },
    {
      name: 'stopTimeTracking',
      description: 'Stop tracking time for a todo',
      invoke: async (params: Record<string, unknown>) => {
        logger.info('Stopping time tracking', { params });
        return 'Time tracking stopped';
      },
    },
  ];

  logger.info('Simple MCP integration setup complete', {
    toolCount: tools.length,
    toolNames: tools.map((t) => t.name),
  });

  return { tools };
}
