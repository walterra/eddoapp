import { beforeEach, describe, expect, it } from 'vitest';

import { type ActionMetadata, ActionRegistry } from './action-registry.js';
import type { McpTool, McpToolDiscoveryService } from './mcp-tool-discovery.js';

// Mock discovery service
class MockDiscoveryService implements Pick<McpToolDiscoveryService, 'getAvailableTools'> {
  private tools: McpTool[] = [];

  setTools(tools: McpTool[]): void {
    this.tools = tools;
  }

  getAvailableTools(): McpTool[] {
    return this.tools;
  }
}

describe('ActionRegistry', () => {
  let mockDiscoveryService: MockDiscoveryService;
  let actionRegistry: ActionRegistry;

  beforeEach(() => {
    mockDiscoveryService = new MockDiscoveryService();
    actionRegistry = new ActionRegistry(
      mockDiscoveryService as unknown as McpToolDiscoveryService,
    );
  });

  describe('initialization', () => {
    it('should initialize with discovered tools', async () => {
      const mockTools: McpTool[] = [
        {
          name: 'eddo_todo_createTodo',
          description: 'Create a new todo item',
          category: 'todo_management',
          server: 'todo',
        },
        {
          name: 'eddo_todo_listTodos',
          description: 'List todos with filtering',
          category: 'todo_management',
          server: 'todo',
        },
      ];

      mockDiscoveryService.setTools(mockTools);
      await actionRegistry.initialize();

      expect(actionRegistry.isInitialized()).toBe(true);
      expect(actionRegistry.getAvailableActions()).toContain('createTodo');
      expect(actionRegistry.getAvailableActions()).toContain('listTodos');
    });

    it('should use fallback actions when no tools discovered', async () => {
      const fallbackActions = new Map<string, ActionMetadata>([
        [
          'testAction',
          {
            name: 'testAction',
            aliases: ['test_action'],
            category: 'crud',
            description: 'Test action',
          },
        ],
      ]);

      actionRegistry = new ActionRegistry(
        mockDiscoveryService as unknown as McpToolDiscoveryService,
        fallbackActions,
      );

      mockDiscoveryService.setTools([]);
      await actionRegistry.initialize();

      expect(actionRegistry.getAvailableActions()).toContain('testAction');
    });
  });

  describe('action resolution', () => {
    beforeEach(async () => {
      const mockTools: McpTool[] = [
        {
          name: 'eddo_todo_createTodo',
          description: 'Create a new todo item',
          category: 'todo_management',
          server: 'todo',
        },
      ];

      mockDiscoveryService.setTools(mockTools);
      await actionRegistry.initialize();
    });

    it('should resolve action names directly', () => {
      const resolved = actionRegistry.resolveActionName('createTodo');
      expect(resolved).toBe('createTodo');
    });

    it('should resolve action names via aliases', () => {
      const resolved = actionRegistry.resolveActionName('create_todo');
      expect(resolved).toBe('createTodo');
    });

    it('should resolve case-insensitive matches', () => {
      const resolved = actionRegistry.resolveActionName('CREATETODO');
      expect(resolved).toBe('createTodo');
    });

    it('should return undefined for unknown actions', () => {
      const resolved = actionRegistry.resolveActionName('unknownAction');
      expect(resolved).toBeUndefined();
    });
  });

  describe('tool name mapping', () => {
    beforeEach(async () => {
      const mockTools: McpTool[] = [
        {
          name: 'eddo_todo_createTodo',
          description: 'Create a new todo item',
          category: 'todo_management',
          server: 'todo',
        },
      ];

      mockDiscoveryService.setTools(mockTools);
      await actionRegistry.initialize();
    });

    it('should return correct tool name for action', () => {
      const toolName = actionRegistry.getToolNameForAction('createTodo');
      expect(toolName).toBe('eddo_todo_createTodo');
    });

    it('should return undefined for unknown action', () => {
      const toolName = actionRegistry.getToolNameForAction('unknownAction');
      expect(toolName).toBeUndefined();
    });
  });

  describe('action list generation', () => {
    beforeEach(async () => {
      const mockTools: McpTool[] = [
        {
          name: 'eddo_todo_createTodo',
          description: 'Create a new todo item',
          category: 'todo_management',
          server: 'todo',
        },
        {
          name: 'eddo_todo_listTodos',
          description: 'List todos with filtering',
          category: 'todo_management',
          server: 'todo',
        },
      ];

      mockDiscoveryService.setTools(mockTools);
      await actionRegistry.initialize();
    });

    it('should generate camelCase action list for prompts', () => {
      const actionList = actionRegistry.getActionListForPrompt('camelCase');
      expect(actionList).toContain('- createTodo');
      expect(actionList).toContain('- listTodos');
    });

    it('should generate snake_case action list for prompts', () => {
      const actionList = actionRegistry.getActionListForPrompt('snake_case');
      expect(actionList).toContain('- create_todo');
      expect(actionList).toContain('- list_todos');
    });
  });

  describe('alias generation', () => {
    it('should generate appropriate aliases for createTodo', async () => {
      const mockTools: McpTool[] = [
        {
          name: 'eddo_todo_createTodo',
          description: 'Create a new todo item',
          category: 'todo_management',
          server: 'todo',
        },
      ];

      mockDiscoveryService.setTools(mockTools);
      await actionRegistry.initialize();

      const metadata = actionRegistry.getActionMetadata('createTodo');
      expect(metadata?.aliases).toContain('create_todo');
      expect(metadata?.aliases).toContain('addTodo');
      expect(metadata?.aliases).toContain('create');
    });

    it('should generate appropriate aliases for time tracking actions', async () => {
      const mockTools: McpTool[] = [
        {
          name: 'eddo_todo_startTimeTracking',
          description: 'Start time tracking',
          category: 'time_tracking',
          server: 'todo',
        },
      ];

      mockDiscoveryService.setTools(mockTools);
      await actionRegistry.initialize();

      const metadata = actionRegistry.getActionMetadata('startTimeTracking');
      expect(metadata?.aliases).toContain('start_time_tracking');
      expect(metadata?.aliases).toContain('startTimer');
    });
  });
});
