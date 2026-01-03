import { describe, expect, it } from 'vitest';

import {
  extractConversationalPart,
  extractStatusMessage,
  parseToolCall,
} from './response-parser.js';

describe('response-parser', () => {
  describe('parseToolCall', () => {
    it('parses a valid tool call', () => {
      const response = 'TOOL_CALL: {"name": "listTodos", "parameters": {"completed": true}}';
      const result = parseToolCall(response);
      expect(result).toEqual({
        name: 'listTodos',
        parameters: { completed: true },
      });
    });

    it('returns null when no tool call present', () => {
      const response = 'Just a regular message';
      const result = parseToolCall(response);
      expect(result).toBeNull();
    });

    it('extracts first tool call when multiple present', () => {
      const response = `TOOL_CALL: {"name": "first", "parameters": {}}
TOOL_CALL: {"name": "second", "parameters": {}}`;
      const result = parseToolCall(response);
      expect(result?.name).toBe('first');
    });
  });

  describe('extractStatusMessage', () => {
    it('extracts a status message', () => {
      const response = `STATUS: Checking your todos...
TOOL_CALL: {"name": "listTodos", "parameters": {}}`;
      const result = extractStatusMessage(response);
      expect(result).toBe('Checking your todos...');
    });

    it('returns null when no status present', () => {
      const response = 'TOOL_CALL: {"name": "listTodos", "parameters": {}}';
      const result = extractStatusMessage(response);
      expect(result).toBeNull();
    });

    it('handles status on its own line', () => {
      const response = `Some intro text
STATUS: Looking up your data
TOOL_CALL: {"name": "getData", "parameters": {}}`;
      const result = extractStatusMessage(response);
      expect(result).toBe('Looking up your data');
    });

    it('trims whitespace from status message', () => {
      const response = 'STATUS:   Extra spaces here   ';
      const result = extractStatusMessage(response);
      expect(result).toBe('Extra spaces here');
    });
  });

  describe('extractConversationalPart', () => {
    it('excludes TOOL_CALL lines', () => {
      const response = `Hello there
TOOL_CALL: {"name": "test", "parameters": {}}
More text`;
      const result = extractConversationalPart(response);
      expect(result?.text).toBe('Hello there\nMore text');
    });

    it('excludes STATUS lines', () => {
      const response = `STATUS: Working on it
TOOL_CALL: {"name": "test", "parameters": {}}`;
      const result = extractConversationalPart(response);
      expect(result).toBeNull();
    });

    it('returns null for empty conversational part', () => {
      const response = 'TOOL_CALL: {"name": "test", "parameters": {}}';
      const result = extractConversationalPart(response);
      expect(result).toBeNull();
    });

    it('extracts conversational content without tool calls', () => {
      const response = 'Here is your daily briefing with all the details.';
      const result = extractConversationalPart(response);
      expect(result?.text).toBe('Here is your daily briefing with all the details.');
    });
  });
});
