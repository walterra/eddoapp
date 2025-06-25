import { beforeEach, describe, expect, it } from 'vitest';

import { McpToolDiscoveryService } from './mcp-tool-discovery.js';

// Mock LangChain Tool - simplified for testing
interface MockTool {
  name: string;
  description: string;
  schema?: object;
  invoke(_params: object): Promise<string>;
}

function createMockTool(name: string, description: string, schema: object = {}): MockTool {
  return {
    name,
    description,
    schema,
    async invoke(_params: object): Promise<string> {
      return 'mock result';
    }
  };
}

describe('McpToolDiscoveryService', () => {
  let discoveryService: McpToolDiscoveryService;

  beforeEach(() => {
    discoveryService = new McpToolDiscoveryService();
  });

  describe('tool discovery', () => {
    it('should discover tools from LangChain tools array', async () => {
      const mockTools: MockTool[] = [
        createMockTool('eddo_todo_createTodo', 'Create a new todo item'),
        createMockTool('eddo_todo_listTodos', 'List todos with filtering'),
        createMockTool('eddo_timer_startTracking', 'Start time tracking'),
      ];

      const discoveredTools = await discoveryService.discoverTools(mockTools as unknown[]);

      expect(discoveredTools).toHaveLength(3);
      expect(discoveredTools[0]).toMatchObject({
        name: 'eddo_todo_createTodo',
        description: 'Create a new todo item',
        category: 'todo_management',
        server: 'todo',
      });
    });

    it('should handle tools without descriptions', async () => {
      const mockTools: MockTool[] = [createMockTool('eddo_todo_createTodo', '')];

      const discoveredTools = await discoveryService.discoverTools(mockTools as unknown[]);

      expect(discoveredTools[0]).toMatchObject({
        name: 'eddo_todo_createTodo',
        description: '',
        category: 'todo_management',
        server: 'todo',
      });
    });

    it('should clear cache on discovery', async () => {
      const firstTools: MockTool[] = [
        createMockTool('eddo_todo_createTodo', 'Create todo'),
      ];
      const secondTools: MockTool[] = [
        createMockTool('eddo_todo_listTodos', 'List todos'),
      ];

      await discoveryService.discoverTools(firstTools as unknown[]);
      expect(discoveryService.getAvailableTools()).toHaveLength(1);

      await discoveryService.discoverTools(secondTools as unknown[]);
      expect(discoveryService.getAvailableTools()).toHaveLength(1);
      expect(discoveryService.getAvailableTools()[0].name).toBe(
        'eddo_todo_listTodos',
      );
    });
  });

  describe('tool categorization', () => {
    it('should categorize todo management tools', async () => {
      const mockTools: MockTool[] = [
        createMockTool('eddo_todo_createTodo', 'Create todo'),
        createMockTool('eddo_task_updateTask', 'Update task'),
      ];

      const discoveredTools = await discoveryService.discoverTools(mockTools as unknown[]);

      expect(discoveredTools[0].category).toBe('todo_management');
      expect(discoveredTools[1].category).toBe('todo_management');
    });

    it('should categorize time tracking tools', async () => {
      const mockTools: MockTool[] = [
        createMockTool('eddo_timer_startTimer', 'Start timer'),
        createMockTool('eddo_todo_trackTime', 'Track time'),
      ];

      const discoveredTools = await discoveryService.discoverTools(mockTools as unknown[]);

      expect(discoveredTools[0].category).toBe('time_tracking');
      expect(discoveredTools[1].category).toBe('time_tracking');
    });

    it('should categorize integration tools', async () => {
      const mockTools: MockTool[] = [
        createMockTool('eddo_github_createIssue', 'Create GitHub issue'),
        createMockTool('eddo_slack_sendMessage', 'Send Slack message'),
      ];

      const discoveredTools = await discoveryService.discoverTools(mockTools as unknown[]);

      expect(discoveredTools[0].category).toBe('integration');
      expect(discoveredTools[1].category).toBe('integration');
    });

    it('should default to utility category for unknown tools', async () => {
      const mockTools: MockTool[] = [
        createMockTool('eddo_unknown_doSomething', 'Do something'),
      ];

      const discoveredTools = await discoveryService.discoverTools(mockTools as unknown[]);

      expect(discoveredTools[0].category).toBe('utility');
    });
  });

  describe('server name extraction', () => {
    it('should extract server name from prefixed tool names', async () => {
      const mockTools: MockTool[] = [
        createMockTool('eddo_todo_createTodo', 'Create todo'),
        createMockTool('eddo_timer_startTimer', 'Start timer'),
        createMockTool('eddo_github_createIssue', 'Create issue'),
      ];

      const discoveredTools = await discoveryService.discoverTools(mockTools as unknown[]);

      expect(discoveredTools[0].server).toBe('todo');
      expect(discoveredTools[1].server).toBe('timer');
      expect(discoveredTools[2].server).toBe('github');
    });

    it('should handle tools without standard prefixes', async () => {
      const mockTools: MockTool[] = [
        createMockTool('createTodo', 'Create todo'),
        createMockTool('simple_action', 'Simple action'),
      ];

      const discoveredTools = await discoveryService.discoverTools(mockTools as unknown[]);

      expect(discoveredTools[0].server).toBeUndefined();
      expect(discoveredTools[1].server).toBeUndefined();
    });
  });

  describe('tool retrieval', () => {
    beforeEach(async () => {
      const mockTools: MockTool[] = [
        createMockTool('eddo_todo_createTodo', 'Create todo'),
        createMockTool('eddo_todo_listTodos', 'List todos'),
        createMockTool('eddo_timer_startTimer', 'Start timer'),
      ];

      await discoveryService.discoverTools(mockTools as unknown[]);
    });

    it('should get tool by exact name', async () => {
      const tool = await discoveryService.getToolByName('eddo_todo_createTodo');
      expect(tool).toBeDefined();
      expect(tool?.name).toBe('eddo_todo_createTodo');
    });

    it('should return undefined for non-existent tool', async () => {
      const tool = await discoveryService.getToolByName('nonexistent');
      expect(tool).toBeUndefined();
    });

    it('should find tool by variants', async () => {
      const tool = await discoveryService.findToolByVariants([
        'createTodo',
        'eddo_todo_createTodo',
        'create',
      ]);
      expect(tool).toBeDefined();
      expect(tool?.name).toBe('eddo_todo_createTodo');
    });

    it('should return undefined when no variants match', async () => {
      const tool = await discoveryService.findToolByVariants([
        'nonexistent1',
        'nonexistent2',
      ]);
      expect(tool).toBeUndefined();
    });

    it('should get tools by server', () => {
      const todoTools = discoveryService.getToolsByServer('todo');
      const timerTools = discoveryService.getToolsByServer('timer');

      expect(todoTools).toHaveLength(2);
      expect(timerTools).toHaveLength(1);
      expect(todoTools[0].server).toBe('todo');
      expect(timerTools[0].server).toBe('timer');
    });

    it('should get tools by category', () => {
      const todoTools = discoveryService.getToolsByCategory('todo_management');
      const timeTools = discoveryService.getToolsByCategory('time_tracking');

      expect(todoTools).toHaveLength(2);
      expect(timeTools).toHaveLength(1);
    });
  });

  describe('cache management', () => {
    it('should validate cache correctly', async () => {
      expect(discoveryService.isCacheValid()).toBe(false);

      const mockTools: MockTool[] = [
        createMockTool('eddo_todo_createTodo', 'Create todo'),
      ];

      await discoveryService.discoverTools(mockTools as unknown[]);
      expect(discoveryService.isCacheValid()).toBe(true);
    });

    it('should clear cache', async () => {
      const mockTools: MockTool[] = [
        createMockTool('eddo_todo_createTodo', 'Create todo'),
      ];

      await discoveryService.discoverTools(mockTools as unknown[]);
      expect(discoveryService.getAvailableTools()).toHaveLength(1);

      discoveryService.clearCache();
      expect(discoveryService.getAvailableTools()).toHaveLength(0);
      expect(discoveryService.isCacheValid()).toBe(false);
    });
  });
});
