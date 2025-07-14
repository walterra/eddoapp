import { describe, expect, it, vi } from 'vitest';

import { buildSystemPrompt } from './system-prompt.js';

// Mock the personas and config
vi.mock('../ai/personas.js', () => ({
  getPersona: vi.fn().mockReturnValue({
    personalityPrompt: 'I am Mr. Stevens, your butler.',
  }),
}));

vi.mock('../utils/config.js', () => ({
  appConfig: {
    BOT_PERSONA_ID: 'butler',
  },
}));

describe('buildSystemPrompt', () => {
  const mockServerInfo = `# Eddo MCP Server Overview

Available tools:
- createTodo: Create a new todo item
- listTodos: List existing todos

# User Memories

Current stored memories for context:

- Coffee preference: User likes espresso
- Meeting time: Prefers morning meetings

*Memories are stored as todos with tag 'user:memory'*

# Top Used Tags

The most frequently used tags across all todos:

- **work**: 5 uses
- **personal**: 3 uses

*Showing top 10 most used tags*`;

  it('should build system prompt with MCP server info', () => {
    const result = buildSystemPrompt(mockServerInfo);

    expect(result).toContain('I am Mr. Stevens, your butler.');
    expect(result).toContain('Available tools:');
    expect(result).toContain('createTodo: Create a new todo item');
    expect(result).toContain('listTodos: List existing todos');
    expect(result).toContain('User Memories');
    expect(result).toContain('Coffee preference: User likes espresso');
    expect(result).toContain('Top Used Tags');
    expect(result).toContain('**work**: 5 uses');
    expect(result).toContain('Current date and time:');
    expect(result).toContain('TOOL_CALL: {"name": "toolName"');
  });

  it('should handle empty server info', () => {
    const result = buildSystemPrompt('');

    expect(result).toContain('I am Mr. Stevens, your butler.');
    expect(result).toContain('Current date and time:');
    expect(result).toContain('TOOL_CALL: {"name": "toolName"');
  });

  it('should include all core components', () => {
    const result = buildSystemPrompt(mockServerInfo);

    expect(result).toContain('I am Mr. Stevens, your butler.');
    expect(result).toContain('Current date and time:');
    expect(result).toContain('COMMUNICATION STYLE:');
    expect(result).toContain('TOOL_CALL: {"name": "toolName"');
    expect(result).toContain(mockServerInfo);
  });
});
