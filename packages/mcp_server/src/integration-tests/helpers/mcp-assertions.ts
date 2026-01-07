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
  externalId?: string | null;
  link: string | null;
  parentId?: string | null;
  repeat: number | null;
  tags: string[];
  title: string;
  version: 'alpha3';
}

export interface MCPResponse {
  summary: string;
  data?: { id?: string; [key: string]: unknown };
  error?: string;
  recovery_suggestions?: string[];
  metadata?: Record<string, unknown>;
}

export class MCPAssertions {
  constructor(private testServer: MCPTestServer) {}

  /**
   * Assert that a tool exists in the available tools list
   */
  async expectToolExists(toolName: string): Promise<void> {
    const tools = await this.testServer.listAvailableTools();
    const tool = tools.find((t) => t.name === toolName);
    expect(tool, `Tool '${toolName}' should exist`).toBeDefined();
  }

  /**
   * Assert that multiple tools exist
   */
  async expectToolsExist(toolNames: string[]): Promise<void> {
    const tools = await this.testServer.listAvailableTools();
    const availableToolNames = tools.map((t) => t.name);

    for (const toolName of toolNames) {
      expect(availableToolNames, `Tool '${toolName}' should exist`).toContain(toolName);
    }
  }

  /**
   * Call a tool and expect it to succeed
   */
  async expectToolCallSuccess<T = unknown>(
    toolName: string,
    args: Record<string, unknown> = {},
  ): Promise<T> {
    const result = await this.testServer.callTool(toolName, args);
    expect(result).toBeDefined();
    return result as T;
  }

  /**
   * Assert error text matches expected pattern
   */
  private assertErrorMatches(errorText: unknown, pattern: string | RegExp): void {
    if (typeof pattern === 'string') {
      expect(errorText).toContain(pattern);
    } else {
      expect(errorText).toMatch(pattern);
    }
  }

  /**
   * Check if result is a structured error response
   */
  private isStructuredErrorResponse(
    result: unknown,
  ): result is { error?: unknown; summary?: unknown } {
    return result !== null && typeof result === 'object' && 'error' in result;
  }

  /**
   * Check if result is a legacy string error
   */
  private isLegacyStringError(result: unknown): result is string {
    return typeof result === 'string' && result.includes('failed');
  }

  /**
   * Handle structured error response
   */
  private handleStructuredError(
    result: { error?: unknown; summary?: unknown },
    pattern?: string | RegExp,
  ): void {
    if (!pattern) return;
    const errorText = result.error || result.summary || JSON.stringify(result);
    this.assertErrorMatches(errorText, pattern);
  }

  /**
   * Call a tool and expect it to fail with specific error
   */
  async expectToolCallError(
    toolName: string,
    args: Record<string, unknown> = {},
    expectedErrorPattern?: string | RegExp,
  ): Promise<void> {
    try {
      const result = await this.testServer.callTool(toolName, args);

      if (this.isStructuredErrorResponse(result)) {
        this.handleStructuredError(result, expectedErrorPattern);
        return;
      }

      if (this.isLegacyStringError(result)) {
        if (expectedErrorPattern) {
          this.assertErrorMatches(result, expectedErrorPattern);
        }
        return;
      }

      throw new Error(
        `Expected tool call to fail but it succeeded with result: ${JSON.stringify(result)}`,
      );
    } catch (error) {
      if (expectedErrorPattern) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.assertErrorMatches(errorMessage, expectedErrorPattern);
      }
    }
  }

  /**
   * Assert that a todo has valid Alpha3 structure
   */
  expectValidTodo(todo: unknown): asserts todo is TodoAlpha3 {
    expect(todo).toMatchObject({
      _id: expect.any(String),
      active: expect.any(Object),
      context: expect.any(String),
      description: expect.any(String),
      due: expect.any(String),
      tags: expect.any(Array),
      title: expect.any(String),
      version: 'alpha3',
    });

    // Type guard to ensure todo is object-like
    if (!todo || typeof todo !== 'object') {
      throw new Error('Todo must be an object');
    }

    const todoObj = todo as Record<string, unknown>;

    // Validate completed can be string or null
    expect(todoObj.completed === null || typeof todoObj.completed === 'string').toBe(true);

    // Validate link can be string or null
    expect(todoObj.link === null || typeof todoObj.link === 'string').toBe(true);

    // Validate repeat can be number or null
    expect(todoObj.repeat === null || typeof todoObj.repeat === 'number').toBe(true);

    // Validate _id is ISO timestamp format
    expect(() => new Date(todoObj._id as string)).not.toThrow();

    // Validate due date format
    expect(() => new Date(todoObj.due as string)).not.toThrow();

    // Validate tags are strings
    expect((todoObj.tags as unknown[]).every((tag: unknown) => typeof tag === 'string')).toBe(true);

    // Validate context is valid
    expect(['work', 'private', 'personal']).toContain(todoObj.context);
  }

  /**
   * Assert that a list of todos are all valid
   */
  expectValidTodos(todos: unknown[]): asserts todos is TodoAlpha3[] {
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
    todos.forEach((todo) => {
      expect(todo.context).toBe(expectedContext);
    });
  }

  /**
   * Assert that todos are filtered correctly by completion status
   */
  expectTodosFilteredByCompletion(todos: TodoAlpha3[], expectedCompleted: boolean): void {
    this.expectValidTodos(todos);
    todos.forEach((todo) => {
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

    todos.forEach((todo) => {
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
      if (Object.prototype.hasOwnProperty.call(todo.active, category)) {
        expect(todo.active[category]).toBeNull();
      }
    }
  }

  /**
   * Assert that a todo has active time tracking (timestamp-based)
   */
  expectHasActiveTimeTracking(todo: TodoAlpha3): void {
    this.expectValidTodo(todo);

    const activeEntries = Object.entries(todo.active).filter(([_, end]) => end === null);
    expect(activeEntries.length).toBeGreaterThan(0);

    // Verify the timestamp key is valid
    activeEntries.forEach(([timestamp, _]) => {
      expect(() => new Date(timestamp)).not.toThrow();
    });
  }

  /**
   * Assert that a todo has no active time tracking
   */
  expectHasNoActiveTimeTracking(todo: TodoAlpha3): void {
    this.expectValidTodo(todo);

    const activeEntries = Object.entries(todo.active).filter(([_, end]) => end === null);
    expect(activeEntries).toHaveLength(0);
  }

  /**
   * Assert that server info contains expected sections
   */
  expectValidServerInfo(serverInfo: unknown, expectedSections?: string[]): void {
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
  expectValidTagStats(tagStats: unknown): void {
    expect(tagStats).toBeDefined();
    expect(typeof tagStats).toBe('object');

    if (!tagStats || typeof tagStats !== 'object') {
      throw new Error('Tag stats must be an object');
    }

    // Each tag should have a count
    for (const [tag, count] of Object.entries(tagStats as Record<string, unknown>)) {
      expect(typeof tag).toBe('string');
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThan(0);
    }
  }

  /**
   * Assert that a todo list has specific length
   */
  expectTodoCount(todos: TodoAlpha3[], expectedCount: number): void {
    if (todos.length !== expectedCount) {
      console.error(`❌ Todo count mismatch. Expected: ${expectedCount}, Actual: ${todos.length}`);
      console.error('Found todos:');
      todos.forEach((todo, index) => {
        console.error(`  ${index + 1}. ${todo.title} (id: ${todo._id}, context: ${todo.context})`);
      });
    }
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
