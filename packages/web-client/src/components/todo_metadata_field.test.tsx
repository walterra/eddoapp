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
  it('renders empty state when no metadata', () => {
    const onChange = vi.fn();
    render(<MetadataField onChange={onChange} todo={createMockTodo()} />);

    expect(screen.getByText('Metadata')).toBeInTheDocument();
    expect(screen.getByLabelText('New metadata key')).toBeInTheDocument();
    expect(screen.getByLabelText('New metadata value')).toBeInTheDocument();
  });

  it('renders existing metadata as key/value rows', () => {
    const onChange = vi.fn();
    const todo = createMockTodo({
      metadata: { 'agent:worktree': '/path/to/tree', 'github:labels': 'bug' },
    });
    render(<MetadataField onChange={onChange} todo={todo} />);

    expect(screen.getByText('Metadata (2)')).toBeInTheDocument();
    const keyInputs = screen.getAllByLabelText('Metadata key');
    expect(keyInputs).toHaveLength(2);
    expect(keyInputs[0]).toHaveValue('agent:worktree');
    expect(keyInputs[1]).toHaveValue('github:labels');
  });

  it('calls onChange when adding a new key/value pair', () => {
    const onChange = vi.fn();
    render(<MetadataField onChange={onChange} todo={createMockTodo()} />);

    const keyInput = screen.getByLabelText('New metadata key');
    const valueInput = screen.getByLabelText('New metadata value');
    const addButton = screen.getByLabelText('Add metadata entry');

    fireEvent.change(keyInput, { target: { value: 'agent:test' } });
    fireEvent.change(valueInput, { target: { value: 'test-value' } });
    fireEvent.click(addButton);

    expect(onChange).toHaveBeenCalledWith(expect.any(Function));
    const updater = onChange.mock.calls[0][0];
    const result = updater(createMockTodo());
    expect(result.metadata).toEqual({ 'agent:test': 'test-value' });
  });

  it('calls onChange when deleting a metadata entry', () => {
    const onChange = vi.fn();
    const todo = createMockTodo({
      metadata: { key1: 'value1', key2: 'value2' },
    });
    render(<MetadataField onChange={onChange} todo={todo} />);

    const deleteButtons = screen.getAllByLabelText('Delete metadata entry');
    fireEvent.click(deleteButtons[0]);

    expect(onChange).toHaveBeenCalled();
    const updater = onChange.mock.calls[0][0];
    const result = updater(todo);
    expect(result.metadata).toEqual({ key2: 'value2' });
  });

  it('calls onChange when editing a key', () => {
    const onChange = vi.fn();
    const todo = createMockTodo({ metadata: { oldKey: 'value' } });
    render(<MetadataField onChange={onChange} todo={todo} />);

    const keyInput = screen.getByLabelText('Metadata key');
    fireEvent.change(keyInput, { target: { value: 'newKey' } });

    expect(onChange).toHaveBeenCalled();
    const updater = onChange.mock.calls[0][0];
    const result = updater(todo);
    expect(result.metadata).toEqual({ newKey: 'value' });
  });

  it('calls onChange when editing a value', () => {
    const onChange = vi.fn();
    const todo = createMockTodo({ metadata: { key: 'oldValue' } });
    render(<MetadataField onChange={onChange} todo={todo} />);

    const valueInput = screen.getByLabelText('Metadata value');
    fireEvent.change(valueInput, { target: { value: 'newValue' } });

    expect(onChange).toHaveBeenCalled();
    const updater = onChange.mock.calls[0][0];
    const result = updater(todo);
    expect(result.metadata).toEqual({ key: 'newValue' });
  });

  it('shows duplicate key warning', () => {
    const onChange = vi.fn();
    const todo = createMockTodo({ metadata: { key1: 'value1' } });
    render(<MetadataField onChange={onChange} todo={todo} />);

    // Add a duplicate key
    const keyInput = screen.getByLabelText('New metadata key');
    const valueInput = screen.getByLabelText('New metadata value');
    const addButton = screen.getByLabelText('Add metadata entry');

    fireEvent.change(keyInput, { target: { value: 'key1' } });
    fireEvent.change(valueInput, { target: { value: 'value2' } });
    fireEvent.click(addButton);

    expect(screen.getByText(/Duplicate keys detected/)).toBeInTheDocument();
  });

  it('clears metadata when all entries are deleted', () => {
    const onChange = vi.fn();
    const todo = createMockTodo({ metadata: { key: 'value' } });
    render(<MetadataField onChange={onChange} todo={todo} />);

    const deleteButton = screen.getByLabelText('Delete metadata entry');
    fireEvent.click(deleteButton);

    expect(onChange).toHaveBeenCalled();
    const updater = onChange.mock.calls[0][0];
    const result = updater(todo);
    expect(result.metadata).toBeUndefined();
  });

  it('adds entry on Enter key press in key input', () => {
    const onChange = vi.fn();
    render(<MetadataField onChange={onChange} todo={createMockTodo()} />);

    const keyInput = screen.getByLabelText('New metadata key');
    const valueInput = screen.getByLabelText('New metadata value');

    fireEvent.change(keyInput, { target: { value: 'test-key' } });
    fireEvent.change(valueInput, { target: { value: 'test-value' } });
    fireEvent.keyDown(keyInput, { key: 'Enter' });

    expect(onChange).toHaveBeenCalled();
  });

  it('has datalist with namespace suggestions', () => {
    const onChange = vi.fn();
    render(<MetadataField onChange={onChange} todo={createMockTodo()} />);

    const datalist = document.getElementById('metadata-key-suggestions');
    expect(datalist).toBeInTheDocument();
    expect(datalist?.querySelectorAll('option').length).toBeGreaterThan(0);
  });
});
