/**
 * Custom assertion helpers for MCP integration tests
 */

import { expect } from 'vitest';
import type { MCPTestServer } from '../setup/test-server.js';

export interface TodoAlpha3 {
  _id: string;
  active: Record<string, string | null>;
  completed: string | null;
  context: string;
  description: string;
  due: string;
  link: string | null;
  repeat: number | null;
  tags: string[];
  title: string;
  version: 'alpha3';
}

export class MCPAssertions {
  constructor(private testServer: MCPTestServer) {}

  /**
   * Assert that a tool exists in the available tools list
   */
  async expectToolExists(toolName: string): Promise<void> {
    const tools = await this.testServer.listAvailableTools();
    const tool = tools.find(t => t.name === toolName);
    expect(tool, `Tool '${toolName}' should exist`).toBeDefined();
  }

  /**
   * Assert that multiple tools exist
   */
  async expectToolsExist(toolNames: string[]): Promise<void> {
    const tools = await this.testServer.listAvailableTools();
    const availableToolNames = tools.map(t => t.name);
    
    for (const toolName of toolNames) {
      expect(availableToolNames, `Tool '${toolName}' should exist`).toContain(toolName);
    }
  }

  /**
   * Call a tool and expect it to succeed
   */
  async expectToolCallSuccess<T = any>(toolName: string, args: any = {}): Promise<T> {
    const result = await this.testServer.callTool(toolName, args);
    expect(result).toBeDefined();
    return result as T;
  }

  /**
   * Call a tool and expect it to fail with specific error
   */
  async expectToolCallError(toolName: string, args: any = {}, expectedErrorPattern?: string | RegExp): Promise<void> {
    await expect(
      this.testServer.callTool(toolName, args)
    ).rejects.toThrow(expectedErrorPattern);
  }

  /**
   * Assert that a todo has valid Alpha3 structure
   */
  expectValidTodo(todo: any): asserts todo is TodoAlpha3 {
    expect(todo).toMatchObject({
      _id: expect.any(String),
      active: expect.any(Object),
      completed: expect.any(String) || null,
      context: expect.any(String),
      description: expect.any(String),
      due: expect.any(String),
      link: expect.any(String) || null,
      repeat: expect.any(Number) || null,
      tags: expect.any(Array),
      title: expect.any(String),
      version: 'alpha3',
    });

    // Validate _id is ISO timestamp format
    expect(() => new Date(todo._id)).not.toThrow();

    // Validate due date format
    expect(() => new Date(todo.due)).not.toThrow();

    // Validate tags are strings
    expect(todo.tags.every((tag: any) => typeof tag === 'string')).toBe(true);

    // Validate context is valid
    expect(['work', 'private', 'personal']).toContain(todo.context);
  }

  /**
   * Assert that a list of todos are all valid
   */
  expectValidTodos(todos: any[]): asserts todos is TodoAlpha3[] {
    expect(todos).toBeInstanceOf(Array);
    todos.forEach((todo, index) => {
      try {
        this.expectValidTodo(todo);
      } catch (error) {
        throw new Error(`Todo at index ${index} is invalid: ${error}`);
      }
    });
  }

  /**
   * Assert that a todo has specific properties
   */
  expectTodoProperties(todo: TodoAlpha3, expectedProperties: Partial<TodoAlpha3>): void {
    for (const [key, value] of Object.entries(expectedProperties)) {
      if (key === 'tags' && Array.isArray(value)) {
        expect(todo.tags).toEqual(expect.arrayContaining(value));
      } else {
        expect(todo[key as keyof TodoAlpha3]).toBe(value);
      }
    }
  }

  /**
   * Assert that todos are filtered correctly by context
   */
  expectTodosFilteredByContext(todos: TodoAlpha3[], expectedContext: string): void {
    this.expectValidTodos(todos);
    todos.forEach(todo => {
      expect(todo.context).toBe(expectedContext);
    });
  }

  /**
   * Assert that todos are filtered correctly by completion status
   */
  expectTodosFilteredByCompletion(todos: TodoAlpha3[], expectedCompleted: boolean): void {
    this.expectValidTodos(todos);
    todos.forEach(todo => {
      if (expectedCompleted) {
        expect(todo.completed).not.toBeNull();
      } else {
        expect(todo.completed).toBeNull();
      }
    });
  }

  /**
   * Assert that todos are within a date range
   */
  expectTodosInDateRange(todos: TodoAlpha3[], startDate: string, endDate: string): void {
    this.expectValidTodos(todos);
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    todos.forEach(todo => {
      const todoDate = new Date(todo.due);
      expect(todoDate >= start && todoDate <= end).toBe(true);
    });
  }

  /**
   * Assert that time tracking is active for a todo
   */
  expectActiveTimeTracking(todo: TodoAlpha3, categories: string[]): void {
    this.expectValidTodo(todo);
    
    for (const category of categories) {
      expect(todo.active).toHaveProperty(category);
      expect(todo.active[category]).not.toBeNull();
      expect(typeof todo.active[category]).toBe('string');
      // Should be a valid ISO timestamp
      expect(() => new Date(todo.active[category]!)).not.toThrow();
    }
  }

  /**
   * Assert that time tracking is inactive for a todo
   */
  expectInactiveTimeTracking(todo: TodoAlpha3, categories: string[]): void {
    this.expectValidTodo(todo);
    
    for (const category of categories) {
      if (todo.active.hasOwnProperty(category)) {
        expect(todo.active[category]).toBeNull();
      }
    }
  }

  /**
   * Assert that server info contains expected sections
   */
  expectValidServerInfo(serverInfo: any, expectedSections?: string[]): void {
    expect(serverInfo).toBeDefined();
    expect(typeof serverInfo).toBe('object');
    
    if (expectedSections) {
      for (const section of expectedSections) {
        expect(serverInfo).toHaveProperty(section);
      }
    }
  }

  /**
   * Assert that tag statistics are valid
   */
  expectValidTagStats(tagStats: any): void {
    expect(tagStats).toBeDefined();
    expect(typeof tagStats).toBe('object');
    
    // Each tag should have a count
    for (const [tag, count] of Object.entries(tagStats)) {
      expect(typeof tag).toBe('string');
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThan(0);
    }
  }

  /**
   * Assert that a todo list has specific length
   */
  expectTodoCount(todos: TodoAlpha3[], expectedCount: number): void {
    expect(todos).toHaveLength(expectedCount);
  }

  /**
   * Assert that todos are sorted by creation date (newest first)
   */
  expectTodosSortedByCreation(todos: TodoAlpha3[]): void {
    if (todos.length <= 1) return;
    
    for (let i = 1; i < todos.length; i++) {
      const prev = new Date(todos[i - 1]._id);
      const curr = new Date(todos[i]._id);
      expect(prev >= curr).toBe(true);
    }
  }
}

/**
 * Factory function to create assertions helper
 */
export function createMCPAssertions(testServer: MCPTestServer): MCPAssertions {
  return new MCPAssertions(testServer);
}