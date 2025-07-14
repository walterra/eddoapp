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
  const mockTools = [
    {
      name: 'createTodo',
      description: 'Create a new todo item',
      inputSchema: {},
    },
    {
      name: 'listTodos',
      description: 'List existing todos',
      inputSchema: {},
    },
  ];

  it('should build system prompt without memories', () => {
    const result = buildSystemPrompt(mockTools);

    expect(result).toContain('I am Mr. Stevens, your butler.');
    expect(result).toContain('createTodo: Create a new todo item');
    expect(result).toContain('listTodos: List existing todos');
    expect(result).toContain('Current date and time:');
    expect(result).not.toContain('USER MEMORIES:');
  });

  it('should build system prompt with memories', () => {
    const memories =
      '- Coffee preference: User likes espresso\n- Meeting time: Prefers morning meetings';
    const result = buildSystemPrompt(mockTools, memories);

    expect(result).toContain('I am Mr. Stevens, your butler.');
    expect(result).toContain('USER MEMORIES:');
    expect(result).toContain('- Coffee preference: User likes espresso');
    expect(result).toContain('- Meeting time: Prefers morning meetings');
    expect(result).toContain(
      'When the user asks to remember something, create a todo with:',
    );
    expect(result).toContain('tags: ["user:memory"]');
    expect(result).toContain('context: "memory"');
  });

  it('should handle empty memories string', () => {
    const result = buildSystemPrompt(mockTools, '');

    expect(result).toContain('I am Mr. Stevens, your butler.');
    expect(result).not.toContain('USER MEMORIES:');
  });

  it('should include memory creation instructions when memories are provided', () => {
    const memories = '- Some memory: User preference';
    const result = buildSystemPrompt(mockTools, memories);

    expect(result).toContain(
      'When the user asks to remember something, create a todo with:',
    );
    expect(result).toContain('- tags: ["user:memory"]');
    expect(result).toContain('- title: Brief summary of what to remember');
    expect(result).toContain('- description: Full details to remember');
    expect(result).toContain('- context: "memory"');
    expect(result).toContain('- due: Current date');
  });
});
