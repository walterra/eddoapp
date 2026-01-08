/**
 * Tests for MetadataField component
 */
import { type Todo } from '@eddo/core-client';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MetadataField } from './todo_metadata_field';

const createMockTodo = (overrides: Partial<Todo> = {}): Todo => ({
  _id: '2025-01-01T00:00:00.000Z',
  _rev: '1-abc',
  title: 'Test Todo',
  description: '',
  context: 'test',
  completed: null,
  due: '2025-01-02T23:59:59.999Z',
  repeat: null,
  tags: [],
  active: {},
  externalId: null,
  link: null,
  version: 'alpha3',
  ...overrides,
});

describe('MetadataField', () => {
  it('renders empty when no metadata', () => {
    const onChange = vi.fn();
    render(<MetadataField onChange={onChange} todo={createMockTodo()} />);

    const textarea = screen.getByLabelText('Metadata');
    expect(textarea).toHaveValue('');
  });

  it('renders existing metadata as formatted JSON', () => {
    const onChange = vi.fn();
    const todo = createMockTodo({
      metadata: { 'agent:worktree': '/path/to/tree', 'github:labels': 'bug' },
    });
    render(<MetadataField onChange={onChange} todo={todo} />);

    const textarea = screen.getByLabelText('Metadata');
    expect(textarea).toHaveValue(JSON.stringify(todo.metadata, null, 2));
  });

  it('calls onChange with parsed metadata on valid JSON input', () => {
    const onChange = vi.fn();
    render(<MetadataField onChange={onChange} todo={createMockTodo()} />);

    const textarea = screen.getByLabelText('Metadata');
    fireEvent.change(textarea, { target: { value: '{"agent:test": "value"}' } });

    expect(onChange).toHaveBeenCalledWith(expect.any(Function));
    // Verify the updater function works correctly
    const updater = onChange.mock.calls[0][0];
    const result = updater(createMockTodo());
    expect(result.metadata).toEqual({ 'agent:test': 'value' });
  });

  it('shows error message for invalid JSON', () => {
    const onChange = vi.fn();
    render(<MetadataField onChange={onChange} todo={createMockTodo()} />);

    const textarea = screen.getByLabelText('Metadata');
    fireEvent.change(textarea, { target: { value: 'not valid json' } });

    expect(screen.getByText(/Invalid JSON/)).toBeInTheDocument();
  });

  it('shows error message for non-object JSON', () => {
    const onChange = vi.fn();
    render(<MetadataField onChange={onChange} todo={createMockTodo()} />);

    const textarea = screen.getByLabelText('Metadata');
    fireEvent.change(textarea, { target: { value: '["array"]' } });

    expect(screen.getByText(/Invalid JSON/)).toBeInTheDocument();
  });

  it('shows error message for non-string values', () => {
    const onChange = vi.fn();
    render(<MetadataField onChange={onChange} todo={createMockTodo()} />);

    const textarea = screen.getByLabelText('Metadata');
    fireEvent.change(textarea, { target: { value: '{"key": 123}' } });

    expect(screen.getByText(/Invalid JSON/)).toBeInTheDocument();
  });

  it('clears metadata when input is emptied', () => {
    const onChange = vi.fn();
    const todo = createMockTodo({ metadata: { key: 'value' } });
    render(<MetadataField onChange={onChange} todo={todo} />);

    const textarea = screen.getByLabelText('Metadata');
    fireEvent.change(textarea, { target: { value: '' } });

    expect(onChange).toHaveBeenCalled();
    const updater = onChange.mock.calls[0][0];
    const result = updater(todo);
    expect(result.metadata).toBeUndefined();
  });
});
