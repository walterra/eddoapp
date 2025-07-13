import {
  type DatabaseError,
  DatabaseErrorType,
  type TodoAlpha3,
} from '@eddo/core';
import '@testing-library/jest-dom';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import '../test-polyfill';
import { createTestPouchDb, destroyTestPouchDb } from '../test-setup';
import {
  createTestTodo,
  populateTestDatabase,
  renderWithPouchDb,
  testTodos,
} from '../test-utils';
import { TodoEditModal } from './todo_edit_modal';

// Mock child components to avoid complex dependencies
vi.mock('./tag_input', () => ({
  TagInput: ({
    onChange,
    tags,
    placeholder,
    suggestions: _suggestions,
  }: {
    onChange: (tags: string[]) => void;
    tags: string[];
    placeholder: string;
    suggestions: string[];
  }) => (
    <input
      data-testid="tag-input"
      onChange={(e) => {
        const value = e.target.value;
        const newTags = value
          ? value
              .split(',')
              .map((tag) => tag.trim())
              .filter(Boolean)
          : [];
        onChange(newTags);
      }}
      placeholder={placeholder}
      value={tags.join(',')}
    />
  ),
}));

// Mock the useTags hook
vi.mock('../hooks/use_tags', () => ({
  useTags: () => ({
    allTags: ['work', 'personal', 'urgent'],
    isLoading: false,
    error: null,
  }),
}));

describe('TodoEditModal', () => {
  let testDb: ReturnType<typeof createTestPouchDb>;

  beforeEach(() => {
    testDb = createTestPouchDb();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    if (testDb?.db) {
      await destroyTestPouchDb(testDb.db);
    }
  });

  const defaultProps = {
    show: true,
    onClose: vi.fn(),
    todo: testTodos.active as TodoAlpha3,
  };

  describe('Modal Rendering', () => {
    it('renders modal when show is true', () => {
      renderWithPouchDb(<TodoEditModal {...defaultProps} />, {
        testDb: testDb.contextValue,
      });

      expect(screen.getByText('Edit Todo')).toBeInTheDocument();
    });

    it('does not render modal when show is false', () => {
      renderWithPouchDb(<TodoEditModal {...defaultProps} show={false} />, {
        testDb: testDb.contextValue,
      });

      expect(screen.queryByText('Edit Todo')).not.toBeInTheDocument();
    });

    it('renders all form fields', () => {
      renderWithPouchDb(<TodoEditModal {...defaultProps} />, {
        testDb: testDb.contextValue,
      });

      expect(screen.getByLabelText('Context')).toBeInTheDocument();
      expect(screen.getByLabelText('Todo')).toBeInTheDocument();
      expect(screen.getByLabelText('Link')).toBeInTheDocument();
      expect(screen.getByLabelText('Due date')).toBeInTheDocument();
      expect(screen.getByLabelText('Repeat')).toBeInTheDocument();
      expect(screen.getByLabelText('Completed')).toBeInTheDocument();
      expect(screen.getByTestId('tag-input')).toBeInTheDocument();
    });

    it('displays creation date', () => {
      const todo = {
        ...testTodos.active,
        _id: '2025-07-12T10:30:00.000Z',
      } as TodoAlpha3;

      renderWithPouchDb(<TodoEditModal {...defaultProps} todo={todo} />, {
        testDb: testDb.contextValue,
      });

      expect(screen.getByText('2025-07-12T10:30:00.000Z')).toBeInTheDocument();
    });

    it('renders save and delete buttons', () => {
      renderWithPouchDb(<TodoEditModal {...defaultProps} />, {
        testDb: testDb.contextValue,
      });

      expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Delete' }),
      ).toBeInTheDocument();
    });
  });

  describe('Form Field Updates', () => {
    it('updates context field', async () => {
      renderWithPouchDb(<TodoEditModal {...defaultProps} />, {
        testDb: testDb.contextValue,
      });

      const contextInput = screen.getByLabelText('Context');

      // Use fireEvent.change for controlled inputs
      fireEvent.change(contextInput, { target: { value: 'work' } });

      await waitFor(() => {
        expect(contextInput).toHaveValue('work');
      });
    });

    it('updates title field', async () => {
      renderWithPouchDb(<TodoEditModal {...defaultProps} />, {
        testDb: testDb.contextValue,
      });

      const titleInput = screen.getByLabelText('Todo');
      fireEvent.change(titleInput, { target: { value: 'Updated todo' } });

      await waitFor(() => {
        expect(titleInput).toHaveValue('Updated todo');
      });
    });

    it('updates link field', async () => {
      renderWithPouchDb(<TodoEditModal {...defaultProps} />, {
        testDb: testDb.contextValue,
      });

      const linkInput = screen.getByLabelText('Link');
      fireEvent.change(linkInput, { target: { value: 'https://example.com' } });

      await waitFor(() => {
        expect(linkInput).toHaveValue('https://example.com');
      });
    });

    it('clears link when empty string is entered', async () => {
      const user = userEvent.setup();
      const todoWithLink = {
        ...testTodos.withLink,
      } as TodoAlpha3;

      renderWithPouchDb(
        <TodoEditModal {...defaultProps} todo={todoWithLink} />,
        { testDb: testDb.contextValue },
      );

      const linkInput = screen.getByLabelText('Link');
      expect(linkInput).toHaveValue('https://example.com');

      await user.clear(linkInput);
      expect(linkInput).toHaveValue('');
    });

    it('updates due date field', async () => {
      renderWithPouchDb(<TodoEditModal {...defaultProps} />, {
        testDb: testDb.contextValue,
      });

      const dueDateInput = screen.getByLabelText('Due date');
      fireEvent.change(dueDateInput, {
        target: { value: '2025-08-01T23:59:59.999Z' },
      });

      expect(dueDateInput).toHaveValue('2025-08-01T23:59:59.999Z');
    });

    it('sets due date to today when button is clicked', async () => {
      const user = userEvent.setup();

      // Mock the current date for predictable testing
      const mockDate = '2025-07-15';
      vi.setSystemTime(new Date(`${mockDate}T10:00:00.000Z`));

      const todoWithTime = {
        ...testTodos.active,
        due: '2025-07-12T23:59:59.999Z',
      } as TodoAlpha3;

      renderWithPouchDb(
        <TodoEditModal {...defaultProps} todo={todoWithTime} />,
        { testDb: testDb.contextValue },
      );

      await user.click(screen.getByRole('button', { name: 'Set to today' }));

      const dueDateInput = screen.getByLabelText('Due date');
      expect(dueDateInput).toHaveValue('2025-07-15T23:59:59.999Z');

      vi.useRealTimers();
    });

    it('updates repeat field', async () => {
      renderWithPouchDb(<TodoEditModal {...defaultProps} />, {
        testDb: testDb.contextValue,
      });

      const repeatInput = screen.getByLabelText('Repeat');
      fireEvent.change(repeatInput, { target: { value: '7' } });

      await waitFor(() => {
        expect(repeatInput).toHaveValue('7');
      });
    });

    it('clears repeat when empty string is entered', async () => {
      const user = userEvent.setup();
      const todoWithRepeat = {
        ...testTodos.repeating,
      } as TodoAlpha3;

      renderWithPouchDb(
        <TodoEditModal {...defaultProps} todo={todoWithRepeat} />,
        { testDb: testDb.contextValue },
      );

      const repeatInput = screen.getByLabelText('Repeat');
      expect(repeatInput).toHaveValue('1');

      await user.clear(repeatInput);
      expect(repeatInput).toHaveValue('');
    });

    it('toggles completion status', async () => {
      const user = userEvent.setup();
      renderWithPouchDb(<TodoEditModal {...defaultProps} />, {
        testDb: testDb.contextValue,
      });

      const completedCheckbox = screen.getByLabelText('Completed');
      expect(completedCheckbox).not.toBeChecked();

      await user.click(completedCheckbox);
      expect(completedCheckbox).toBeChecked();
    });

    it('updates tags through TagInput component', async () => {
      renderWithPouchDb(<TodoEditModal {...defaultProps} />, {
        testDb: testDb.contextValue,
      });

      const tagInput = screen.getByTestId('tag-input');
      fireEvent.change(tagInput, { target: { value: 'work,urgent' } });

      await waitFor(() => {
        expect(tagInput).toHaveValue('work,urgent');
      });
    });
  });

  describe('Time Tracking Fields', () => {
    it('displays time tracking entries', () => {
      const todoWithTracking = {
        ...createTestTodo({
          _id: '2025-07-12T14:00:00.000Z',
          title: 'Todo with tracking',
          active: {
            '2025-07-12T14:00:00.000Z': '2025-07-12T15:00:00.000Z',
          },
        }),
        _rev: '1-test',
      } as TodoAlpha3;

      renderWithPouchDb(
        <TodoEditModal {...defaultProps} todo={todoWithTracking} />,
        { testDb: testDb.contextValue },
      );

      expect(
        screen.getByDisplayValue('2025-07-12T14:00:00.000Z'),
      ).toBeInTheDocument();
      expect(
        screen.getByDisplayValue('2025-07-12T15:00:00.000Z'),
      ).toBeInTheDocument();
      expect(screen.getByText('1h')).toBeInTheDocument();
    });

    it('updates time tracking from field', async () => {
      const todoWithTracking = {
        ...createTestTodo({
          _id: '2025-07-12T14:00:00.000Z',
          title: 'Todo with tracking',
          active: {
            '2025-07-12T14:00:00.000Z': '2025-07-12T15:00:00.000Z',
          },
        }),
        _rev: '1-test',
      } as TodoAlpha3;

      renderWithPouchDb(
        <TodoEditModal {...defaultProps} todo={todoWithTracking} />,
        { testDb: testDb.contextValue },
      );

      const fromInput = screen.getByDisplayValue('2025-07-12T14:00:00.000Z');
      fireEvent.change(fromInput, {
        target: { value: '2025-07-12T13:00:00.000Z' },
      });

      expect(fromInput).toHaveValue('2025-07-12T13:00:00.000Z');
      expect(screen.getByText('2h')).toBeInTheDocument();
    });

    it('updates time tracking to field', async () => {
      const todoWithTracking = {
        ...createTestTodo({
          _id: '2025-07-12T14:00:00.000Z',
          title: 'Todo with tracking',
          active: {
            '2025-07-12T14:00:00.000Z': '2025-07-12T15:00:00.000Z',
          },
        }),
        _rev: '1-test',
      } as TodoAlpha3;

      renderWithPouchDb(
        <TodoEditModal {...defaultProps} todo={todoWithTracking} />,
        { testDb: testDb.contextValue },
      );

      const toInput = screen.getByDisplayValue('2025-07-12T15:00:00.000Z');
      fireEvent.change(toInput, {
        target: { value: '2025-07-12T16:00:00.000Z' },
      });

      await waitFor(() => {
        expect(toInput).toHaveValue('2025-07-12T16:00:00.000Z');
      });
      expect(screen.getByText('2h')).toBeInTheDocument();
    });

    it('shows n/a for invalid time tracking entries', async () => {
      const user = userEvent.setup();
      const todoWithTracking = {
        ...createTestTodo({
          _id: '2025-07-12T14:00:00.000Z',
          title: 'Todo with tracking',
          active: {
            '2025-07-12T14:00:00.000Z': '2025-07-12T15:00:00.000Z',
          },
        }),
        _rev: '1-test',
      } as TodoAlpha3;

      renderWithPouchDb(
        <TodoEditModal {...defaultProps} todo={todoWithTracking} />,
        { testDb: testDb.contextValue },
      );

      const fromInput = screen.getByDisplayValue('2025-07-12T14:00:00.000Z');
      await user.clear(fromInput);
      await user.type(fromInput, 'invalid-date');

      expect(screen.getByText('n/a')).toBeInTheDocument();
    });
  });

  describe('Save Functionality', () => {
    it('saves todo with updated data', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      await populateTestDatabase(testDb.db, [testTodos.active]);
      const todoFromDb = await testDb.db.get(testTodos.active._id);

      renderWithPouchDb(
        <TodoEditModal
          {...defaultProps}
          onClose={onClose}
          todo={todoFromDb as TodoAlpha3}
        />,
        { testDb: testDb.contextValue },
      );

      // Update the title
      const titleInput = screen.getByLabelText('Todo');
      fireEvent.change(titleInput, { target: { value: 'Updated Todo Title' } });

      await waitFor(() => {
        expect(titleInput).toHaveValue('Updated Todo Title');
      });

      // Save the todo
      await user.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(async () => {
        const updatedTodo = await testDb.db.get(testTodos.active._id);
        expect((updatedTodo as TodoAlpha3).title).toBe('Updated Todo Title');
      });

      expect(onClose).toHaveBeenCalled();
    });

    it('creates repeat todo when completing a repeating todo', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      await populateTestDatabase(testDb.db, [testTodos.repeating]);
      const todoFromDb = await testDb.db.get(testTodos.repeating._id);

      renderWithPouchDb(
        <TodoEditModal
          {...defaultProps}
          onClose={onClose}
          todo={todoFromDb as TodoAlpha3}
        />,
        { testDb: testDb.contextValue },
      );

      // Complete the todo
      const completedCheckbox = screen.getByLabelText('Completed');
      await user.click(completedCheckbox);

      // Save the todo
      await user.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(async () => {
        const allDocs = await testDb.db.allDocs();
        expect(allDocs.rows).toHaveLength(2); // Original + new repeat todo
      });

      expect(onClose).toHaveBeenCalled();
    });

    it('shows loading state during save', async () => {
      const user = userEvent.setup();

      // Mock safePut to be slower so we can see loading state
      let resolveSave: () => void;
      const savePromise = new Promise<void>((resolve) => {
        resolveSave = resolve;
      });
      testDb.contextValue.safeDb.safePut = vi.fn().mockReturnValue(savePromise);

      renderWithPouchDb(<TodoEditModal {...defaultProps} />, {
        testDb: testDb.contextValue,
      });

      const saveButton = screen.getByRole('button', { name: 'Save' });
      user.click(saveButton);

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: 'Saving...' }),
        ).toBeInTheDocument();
        expect(
          screen.getByRole('button', { name: 'Saving...' }),
        ).toBeDisabled();
      });

      resolveSave!();
    });

    it('disables save button for invalid time tracking', async () => {
      const user = userEvent.setup();
      const todoWithTracking = {
        ...createTestTodo({
          _id: '2025-07-12T14:00:00.000Z',
          title: 'Todo with tracking',
          active: {
            '2025-07-12T14:00:00.000Z': '2025-07-12T15:00:00.000Z',
          },
        }),
        _rev: '1-test',
      } as TodoAlpha3;

      renderWithPouchDb(
        <TodoEditModal {...defaultProps} todo={todoWithTracking} />,
        { testDb: testDb.contextValue },
      );

      // Make time tracking invalid
      const fromInput = screen.getByDisplayValue('2025-07-12T14:00:00.000Z');
      await user.clear(fromInput);
      await user.type(fromInput, 'invalid-date');

      const saveButton = screen.getByRole('button', { name: 'Save' });
      expect(saveButton).toBeDisabled();
    });

    it('handles save errors gracefully', async () => {
      const user = userEvent.setup();
      const mockError: DatabaseError = {
        name: 'DatabaseError',
        message: 'Failed to save todo',
        type: DatabaseErrorType.NETWORK_ERROR,
        retryable: true,
      };

      testDb.contextValue.safeDb.safePut = vi.fn().mockRejectedValue(mockError);

      renderWithPouchDb(<TodoEditModal {...defaultProps} />, {
        testDb: testDb.contextValue,
      });

      await user.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(screen.getByText('Failed to save todo')).toBeInTheDocument();
      });
    });

    it('shows special message for sync conflicts', async () => {
      const user = userEvent.setup();
      const syncError: DatabaseError = {
        name: 'DatabaseError',
        message: 'Sync conflict',
        type: DatabaseErrorType.SYNC_CONFLICT,
        retryable: false,
      };

      testDb.contextValue.safeDb.safePut = vi.fn().mockRejectedValue(syncError);

      renderWithPouchDb(<TodoEditModal {...defaultProps} />, {
        testDb: testDb.contextValue,
      });

      await user.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(
          screen.getByText(/this todo was modified by another device/i),
        ).toBeInTheDocument();
      });
    });
  });

  describe('Delete Functionality', () => {
    it('deletes todo when delete button is clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      await populateTestDatabase(testDb.db, [testTodos.active]);
      const todoFromDb = await testDb.db.get(testTodos.active._id);

      renderWithPouchDb(
        <TodoEditModal
          {...defaultProps}
          onClose={onClose}
          todo={todoFromDb as TodoAlpha3}
        />,
        { testDb: testDb.contextValue },
      );

      await user.click(screen.getByRole('button', { name: 'Delete' }));

      await waitFor(async () => {
        try {
          await testDb.db.get(testTodos.active._id);
          throw new Error('Todo should have been deleted');
        } catch (err: unknown) {
          expect((err as { name: string }).name).toBe('not_found');
        }
      });

      expect(onClose).toHaveBeenCalled();
    });

    it('shows loading state during delete', async () => {
      const user = userEvent.setup();

      // Mock safeRemove to be slower so we can see loading state
      let resolveDelete: () => void;
      const deletePromise = new Promise<void>((resolve) => {
        resolveDelete = resolve;
      });
      testDb.contextValue.safeDb.safeRemove = vi
        .fn()
        .mockReturnValue(deletePromise);

      renderWithPouchDb(<TodoEditModal {...defaultProps} />, {
        testDb: testDb.contextValue,
      });

      const deleteButton = screen.getByRole('button', { name: 'Delete' });
      user.click(deleteButton);

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: 'Deleting...' }),
        ).toBeInTheDocument();
        expect(
          screen.getByRole('button', { name: 'Deleting...' }),
        ).toBeDisabled();
      });

      resolveDelete!();
    });

    it('handles delete errors gracefully', async () => {
      const user = userEvent.setup();
      const mockError: DatabaseError = {
        name: 'DatabaseError',
        message: 'Failed to delete todo',
        type: DatabaseErrorType.NETWORK_ERROR,
        retryable: true,
      };

      testDb.contextValue.safeDb.safeRemove = vi
        .fn()
        .mockRejectedValue(mockError);

      renderWithPouchDb(<TodoEditModal {...defaultProps} />, {
        testDb: testDb.contextValue,
      });

      await user.click(screen.getByRole('button', { name: 'Delete' }));

      await waitFor(() => {
        expect(screen.getByText('Failed to delete todo')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('allows dismissing error messages', async () => {
      const user = userEvent.setup();
      const mockError: DatabaseError = {
        name: 'DatabaseError',
        message: 'Test error',
        type: DatabaseErrorType.NETWORK_ERROR,
        retryable: true,
      };

      testDb.contextValue.safeDb.safePut = vi.fn().mockRejectedValue(mockError);

      renderWithPouchDb(<TodoEditModal {...defaultProps} />, {
        testDb: testDb.contextValue,
      });

      // Trigger error
      await user.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(screen.getByText('Test error')).toBeInTheDocument();
      });

      // Click the dismiss button directly using test structure
      // The dismiss button is inside the error div
      const errorDiv = screen.getByText('Test error').closest('.mb-4');
      const dismissButton = errorDiv?.querySelector('button[type="button"]');
      expect(dismissButton).toBeTruthy();
      await user.click(dismissButton as Element);

      expect(screen.queryByText('Test error')).not.toBeInTheDocument();
    });

    it('clears errors when starting new operations', async () => {
      const user = userEvent.setup();
      const mockError: DatabaseError = {
        name: 'DatabaseError',
        message: 'Test error',
        type: DatabaseErrorType.NETWORK_ERROR,
        retryable: true,
      };

      // First operation fails
      testDb.contextValue.safeDb.safePut = vi.fn().mockRejectedValue(mockError);

      renderWithPouchDb(<TodoEditModal {...defaultProps} />, {
        testDb: testDb.contextValue,
      });

      await user.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(screen.getByText('Test error')).toBeInTheDocument();
      });

      // Second operation should clear the error
      testDb.contextValue.safeDb.safePut = vi.fn().mockResolvedValue({});
      await user.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(screen.queryByText('Test error')).not.toBeInTheDocument();
      });
    });
  });

  describe('Modal State Management', () => {
    it('resets edited todo when todo prop changes', () => {
      const { rerender } = renderWithPouchDb(
        <TodoEditModal
          {...defaultProps}
          todo={testTodos.active as TodoAlpha3}
        />,
        { testDb: testDb.contextValue },
      );

      expect(screen.getByDisplayValue('Active Todo')).toBeInTheDocument();

      // Change the todo prop
      rerender(
        <TodoEditModal
          {...defaultProps}
          todo={testTodos.withTags as TodoAlpha3}
        />,
      );

      expect(screen.getByDisplayValue('Tagged Todo')).toBeInTheDocument();
    });

    it('maintains form state during a single session', async () => {
      const user = userEvent.setup();
      renderWithPouchDb(<TodoEditModal {...defaultProps} />, {
        testDb: testDb.contextValue,
      });

      // Update a field
      const titleInput = screen.getByLabelText('Todo');
      await user.clear(titleInput);
      await user.type(titleInput, 'Modified Title');

      expect(titleInput).toHaveValue('Modified Title');

      // Re-render with same props should maintain the edited state
      const { rerender } = renderWithPouchDb(
        <TodoEditModal {...defaultProps} />,
        { testDb: testDb.contextValue },
      );

      rerender(<TodoEditModal {...defaultProps} />);

      expect(screen.getByDisplayValue('Modified Title')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels on all form inputs', () => {
      renderWithPouchDb(<TodoEditModal {...defaultProps} />, {
        testDb: testDb.contextValue,
      });

      expect(screen.getByLabelText('Context')).toBeInTheDocument();
      expect(screen.getByLabelText('Todo')).toBeInTheDocument();
      expect(screen.getByLabelText('Link')).toBeInTheDocument();
      expect(screen.getByLabelText('Due date')).toBeInTheDocument();
      expect(screen.getByLabelText('Repeat')).toBeInTheDocument();
      expect(screen.getByLabelText('Completed')).toBeInTheDocument();
    });

    it('has proper form structure with labels', () => {
      renderWithPouchDb(<TodoEditModal {...defaultProps} />, {
        testDb: testDb.contextValue,
      });

      // Check that labels are properly associated with inputs
      const contextLabel = screen.getByText('Context');
      const todoLabel = screen.getByText('Todo');
      const linkLabel = screen.getByText('Link');

      expect(contextLabel).toBeInTheDocument();
      expect(todoLabel).toBeInTheDocument();
      expect(linkLabel).toBeInTheDocument();
    });
  });
});
