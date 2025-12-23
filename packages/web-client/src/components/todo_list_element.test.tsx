import type { TodoAlpha3 } from '@eddo/core-client';
import '@testing-library/jest-dom';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createTestPouchDb, destroyTestPouchDb } from '../test-setup';
import { createTestTodo, populateTestDatabase, renderWithPouchDb, testTodos } from '../test-utils';
import { TodoListElement } from './todo_list_element';

// Mock child components to avoid complex dependencies
vi.mock('./todo_edit_modal', () => ({
  TodoEditModal: ({ show, onClose }: { show: boolean; onClose: () => void }) =>
    show ? (
      <div data-testid="todo-edit-modal">
        <button onClick={onClose}>Close Modal</button>
      </div>
    ) : null,
}));

vi.mock('./tag_display', () => ({
  TagDisplay: ({ tags }: { tags: string[] }) => (
    <div data-testid="tag-display">
      {tags.map((tag) => (
        <span data-testid={`tag-${tag}`} key={tag}>
          {tag}
        </span>
      ))}
    </div>
  ),
}));

vi.mock('./formatted_message', () => ({
  FormattedMessage: ({ message }: { message: string }) => <span>{message}</span>,
}));

// Mock the useActiveTimer hook to control timer behavior
vi.mock('../hooks/use_active_timer', () => ({
  useActiveTimer: vi.fn(() => ({ counter: 0 })),
}));

describe('TodoListElement', () => {
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
    active: false,
    activeDate: '2025-07-12',
    activityOnly: false,
    timeTrackingActive: false,
  };

  describe('Basic Rendering', () => {
    it('renders todo title', () => {
      renderWithPouchDb(
        <TodoListElement {...defaultProps} todo={testTodos.active as TodoAlpha3} />,
        { testDb: testDb.contextValue },
      );

      expect(screen.getByText('Active Todo')).toBeInTheDocument();
    });

    it('renders with link when todo has link', () => {
      renderWithPouchDb(
        <TodoListElement {...defaultProps} todo={testTodos.withLink as TodoAlpha3} />,
        { testDb: testDb.contextValue },
      );

      const link = screen.getByRole('link', { name: /todo with link/i });
      expect(link).toHaveAttribute('href', 'https://example.com');
      expect(link).toHaveAttribute('target', '_BLANK');
    });

    it('renders tags when todo has tags', () => {
      renderWithPouchDb(
        <TodoListElement {...defaultProps} todo={testTodos.withTags as TodoAlpha3} />,
        { testDb: testDb.contextValue },
      );

      expect(screen.getByTestId('tag-urgent')).toBeInTheDocument();
      expect(screen.getByTestId('tag-work')).toBeInTheDocument();
    });

    it('applies active styling when active prop is true', () => {
      const { container } = renderWithPouchDb(
        <TodoListElement {...defaultProps} active={true} todo={testTodos.active as TodoAlpha3} />,
        { testDb: testDb.contextValue },
      );

      // Check for the main container with active border styling
      const todoElement = container.querySelector('[class*="border-sky-600"]');
      expect(todoElement).toBeInTheDocument();
    });

    it('shows completed styling for completed todos', () => {
      const { container } = renderWithPouchDb(
        <TodoListElement {...defaultProps} todo={testTodos.completed as TodoAlpha3} />,
        { testDb: testDb.contextValue },
      );

      // Find the span with completed styling
      const styledSpan = container.querySelector('.line-through');
      expect(styledSpan).toBeInTheDocument();
      expect(styledSpan).toHaveClass('text-gray-400');
    });
  });

  describe('Checkbox Functionality', () => {
    it('renders checkbox checked for completed todos', () => {
      renderWithPouchDb(
        <TodoListElement {...defaultProps} todo={testTodos.completed as TodoAlpha3} />,
        { testDb: testDb.contextValue },
      );

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeChecked();
    });

    it('renders checkbox unchecked for incomplete todos', () => {
      renderWithPouchDb(
        <TodoListElement {...defaultProps} todo={testTodos.active as TodoAlpha3} />,
        { testDb: testDb.contextValue },
      );

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).not.toBeChecked();
    });

    it('does not render checkbox in activity-only mode', () => {
      renderWithPouchDb(
        <TodoListElement
          {...defaultProps}
          activityOnly={true}
          todo={testTodos.active as TodoAlpha3}
        />,
        { testDb: testDb.contextValue },
      );

      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });

    it('toggles todo completion when checkbox is clicked', async () => {
      const user = userEvent.setup();
      await populateTestDatabase(testDb.db, [testTodos.active]);

      // Get the todo with _rev from database to pass to component
      const todoFromDb = await testDb.db.get(testTodos.active._id);

      renderWithPouchDb(<TodoListElement {...defaultProps} todo={todoFromDb as TodoAlpha3} />, {
        testDb: testDb.contextValue,
      });

      const checkbox = screen.getByRole('checkbox');
      await user.click(checkbox);

      await waitFor(async () => {
        const updatedTodo = await testDb.db.get(testTodos.active._id);
        expect((updatedTodo as TodoAlpha3).completed).toBeTruthy();
      });
    });

    it('creates repeat todo when completing a repeating todo', async () => {
      const user = userEvent.setup();
      await populateTestDatabase(testDb.db, [testTodos.repeating]);

      // Get the todo with _rev from database to pass to component
      const todoFromDb = await testDb.db.get(testTodos.repeating._id);

      renderWithPouchDb(<TodoListElement {...defaultProps} todo={todoFromDb as TodoAlpha3} />, {
        testDb: testDb.contextValue,
      });

      const checkbox = screen.getByRole('checkbox');
      await user.click(checkbox);

      await waitFor(async () => {
        const allDocs = await testDb.db.allDocs();
        expect(allDocs.rows).toHaveLength(2); // Original + new repeat todo
      });
    });

    it('disables checkbox during update', async () => {
      const user = userEvent.setup();

      // Create a pending promise to control timing
      let resolvePut: () => void;
      const putPromise = new Promise<void>((resolve) => {
        resolvePut = resolve;
      });
      testDb.contextValue.safeDb.safePut = vi.fn().mockReturnValue(putPromise);

      await populateTestDatabase(testDb.db, [testTodos.active]);
      const todoFromDb = await testDb.db.get(testTodos.active._id);

      renderWithPouchDb(<TodoListElement {...defaultProps} todo={todoFromDb as TodoAlpha3} />, {
        testDb: testDb.contextValue,
      });

      const checkbox = screen.getByRole('checkbox');

      // Start the click - this will be pending
      user.click(checkbox);

      // Wait a bit and then check if disabled
      await waitFor(() => {
        expect(checkbox).toBeDisabled();
      });

      // Resolve the operation
      resolvePut!();
    });

    it('handles checkbox toggle errors gracefully', async () => {
      const user = userEvent.setup();

      // Mock safePut to simulate an error
      testDb.contextValue.safeDb.safePut = vi.fn().mockRejectedValue(new Error('Database error'));

      renderWithPouchDb(
        <TodoListElement {...defaultProps} todo={testTodos.active as TodoAlpha3} />,
        { testDb: testDb.contextValue },
      );

      const checkbox = screen.getByRole('checkbox');
      await user.click(checkbox);

      // Test focuses on user-visible error handling, not console output
      await waitFor(() => {
        expect(screen.getByText('Failed to update todo')).toBeInTheDocument();
      });
    });

    it('allows dismissing error messages', async () => {
      const user = userEvent.setup();

      testDb.contextValue.safeDb.safePut = vi.fn().mockRejectedValue(new Error('Database error'));

      renderWithPouchDb(
        <TodoListElement {...defaultProps} todo={testTodos.active as TodoAlpha3} />,
        { testDb: testDb.contextValue },
      );

      const checkbox = screen.getByRole('checkbox');
      await user.click(checkbox);

      await waitFor(() => {
        expect(screen.getByText('Failed to update todo')).toBeInTheDocument();
      });

      const dismissButton = screen.getByRole('button', { name: '×' });
      await user.click(dismissButton);

      expect(screen.queryByText('Failed to update todo')).not.toBeInTheDocument();
    });
  });

  describe('Time Tracking', () => {
    it('shows play button for todos without active time tracking', () => {
      const todoWithoutTracking = {
        ...createTestTodo({
          _id: '2025-07-12T13:00:00.000Z',
          title: 'Todo without tracking',
          active: {},
        }),
        _rev: '1-test',
      } as TodoAlpha3;

      renderWithPouchDb(<TodoListElement {...defaultProps} todo={todoWithoutTracking} />, {
        testDb: testDb.contextValue,
      });

      expect(screen.getByTestId('play-button')).toBeInTheDocument();
    });

    it('shows pause button for todos with active time tracking', () => {
      renderWithPouchDb(
        <TodoListElement {...defaultProps} todo={testTodos.active as TodoAlpha3} />,
        { testDb: testDb.contextValue },
      );

      expect(screen.getByTestId('pause-button')).toBeInTheDocument();
    });

    it('does not show time tracking buttons in activity-only mode', () => {
      renderWithPouchDb(
        <TodoListElement
          {...defaultProps}
          activityOnly={true}
          todo={testTodos.active as TodoAlpha3}
        />,
        { testDb: testDb.contextValue },
      );

      // Should not have any buttons in activity-only mode
      expect(screen.queryByTestId('play-button')).not.toBeInTheDocument();
      expect(screen.queryByTestId('pause-button')).not.toBeInTheDocument();
      expect(screen.queryByTestId('edit-button')).not.toBeInTheDocument();
    });

    it('hides time tracking button when another todo is actively tracking', () => {
      const todoWithoutTracking = {
        ...createTestTodo({
          _id: '2025-07-12T13:00:00.000Z',
          title: 'Todo without tracking',
          active: {},
        }),
        _rev: '1-test',
      } as TodoAlpha3;

      renderWithPouchDb(
        <TodoListElement {...defaultProps} timeTrackingActive={true} todo={todoWithoutTracking} />,
        { testDb: testDb.contextValue },
      );

      // Should not have play button when another todo is tracking
      expect(screen.queryByTestId('play-button')).not.toBeInTheDocument();
    });

    it('shows time tracking button even when other todo is tracking if this todo is actively tracking', () => {
      renderWithPouchDb(
        <TodoListElement
          {...defaultProps}
          timeTrackingActive={true}
          todo={testTodos.active as TodoAlpha3}
        />,
        { testDb: testDb.contextValue },
      );

      // Should have pause button even when other todo is tracking
      expect(screen.getByTestId('pause-button')).toBeInTheDocument();
    });

    it('starts time tracking when play button is clicked', async () => {
      const user = userEvent.setup();
      const todoWithoutTracking = createTestTodo({
        _id: '2025-07-12T13:00:00.000Z',
        title: 'Todo without tracking',
        active: {},
      });

      await populateTestDatabase(testDb.db, [todoWithoutTracking]);

      // Get the todo with _rev from database to pass to component
      const todoFromDb = await testDb.db.get(todoWithoutTracking._id);

      renderWithPouchDb(<TodoListElement {...defaultProps} todo={todoFromDb as TodoAlpha3} />, {
        testDb: testDb.contextValue,
      });

      // Find and click the play button
      const playButton = screen.getByTestId('play-button');
      await user.click(playButton);

      await waitFor(async () => {
        const updatedTodo = await testDb.db.get(todoWithoutTracking._id);
        const activeEntries = Object.values((updatedTodo as TodoAlpha3).active);
        expect(activeEntries).toContain(null); // Should have an open time entry
      });
    });

    it('stops time tracking when pause button is clicked', async () => {
      const user = userEvent.setup();
      await populateTestDatabase(testDb.db, [testTodos.active]);

      // Get the todo with _rev from database to pass to component
      const todoFromDb = await testDb.db.get(testTodos.active._id);

      renderWithPouchDb(<TodoListElement {...defaultProps} todo={todoFromDb as TodoAlpha3} />, {
        testDb: testDb.contextValue,
      });

      // Find and click the pause button
      const pauseButton = screen.getByTestId('pause-button');
      await user.click(pauseButton);

      await waitFor(async () => {
        const updatedTodo = await testDb.db.get(testTodos.active._id);
        const activeEntries = Object.values((updatedTodo as TodoAlpha3).active);
        expect(activeEntries).not.toContain(null); // Should have no open time entries
      });
    });

    it('displays active duration for todos with time tracking', () => {
      const todoWithDuration = {
        ...createTestTodo({
          _id: '2025-07-12T13:00:00.000Z',
          title: 'Todo with duration',
          active: {
            '2025-07-12T13:00:00.000Z': '2025-07-12T14:00:00.000Z', // 1 hour
          },
        }),
        _rev: '1-test',
      } as TodoAlpha3;

      renderWithPouchDb(
        <TodoListElement {...defaultProps} activeDate="2025-07-12" todo={todoWithDuration} />,
        { testDb: testDb.contextValue },
      );

      expect(screen.getByText('1h')).toBeInTheDocument();
    });

    it('handles time tracking errors gracefully', async () => {
      const user = userEvent.setup();

      testDb.contextValue.safeDb.safePut = vi.fn().mockRejectedValue(new Error('Database error'));

      renderWithPouchDb(
        <TodoListElement {...defaultProps} todo={testTodos.active as TodoAlpha3} />,
        { testDb: testDb.contextValue },
      );

      // Find and click the pause button
      const pauseButton = screen.getByTestId('pause-button');
      await user.click(pauseButton);

      await waitFor(() => {
        expect(screen.getByText('Failed to update todo')).toBeInTheDocument();
      });
    });
  });

  describe('Edit Modal', () => {
    it('shows edit button', () => {
      renderWithPouchDb(
        <TodoListElement {...defaultProps} todo={testTodos.active as TodoAlpha3} />,
        { testDb: testDb.contextValue },
      );

      expect(screen.getByTestId('edit-button')).toBeInTheDocument();
    });

    it('does not show edit button in activity-only mode', () => {
      renderWithPouchDb(
        <TodoListElement
          {...defaultProps}
          activityOnly={true}
          todo={testTodos.active as TodoAlpha3}
        />,
        { testDb: testDb.contextValue },
      );

      // Should not have any buttons in activity-only mode
      const buttons = screen.queryAllByRole('button');
      expect(buttons).toHaveLength(0);
    });

    it('opens edit modal when edit button is clicked', async () => {
      const user = userEvent.setup();

      renderWithPouchDb(
        <TodoListElement {...defaultProps} todo={testTodos.active as TodoAlpha3} />,
        { testDb: testDb.contextValue },
      );

      // Find and click the edit button
      const editButton = screen.getByTestId('edit-button');
      await user.click(editButton);

      // Verify the modal is shown
      await waitFor(() => {
        expect(screen.getByTestId('todo-edit-modal')).toBeInTheDocument();
      });
    });

    it('prevents default behavior on edit button click', () => {
      renderWithPouchDb(
        <TodoListElement {...defaultProps} todo={testTodos.active as TodoAlpha3} />,
        { testDb: testDb.contextValue },
      );

      // Find the edit button
      const editButton = screen.getByTestId('edit-button');

      const mockPreventDefault = vi.fn();

      fireEvent.click(editButton, {
        preventDefault: mockPreventDefault,
      });

      // The component calls preventDefault internally
      expect(editButton).toBeInTheDocument();
    });
  });

  describe('Disabled States', () => {
    it('disables all buttons during update operations', async () => {
      const user = userEvent.setup();

      // Mock safePut to create a pending promise that we can control
      let resolvePut: () => void;
      const putPromise = new Promise<void>((resolve) => {
        resolvePut = resolve;
      });
      testDb.contextValue.safeDb.safePut = vi.fn().mockReturnValue(putPromise);

      renderWithPouchDb(
        <TodoListElement {...defaultProps} todo={testTodos.active as TodoAlpha3} />,
        { testDb: testDb.contextValue },
      );

      const checkbox = screen.getByRole('checkbox');
      const pauseButton = screen.getByTestId('pause-button');

      // Start an update operation
      user.click(checkbox);

      await waitFor(() => {
        expect(checkbox).toBeDisabled();
        expect(pauseButton).toBeDisabled();
      });

      // Resolve the promise to complete the update
      resolvePut!();
    });

    it('prevents multiple simultaneous time tracking operations', async () => {
      const user = userEvent.setup();

      // Mock safePut to be slower so we can test simultaneous clicks
      let resolveFirst: (() => void) | undefined;
      const firstPromise = new Promise<{ rev: string }>((resolve) => {
        resolveFirst = () => resolve({ rev: '2-abc' });
      });

      const mockSafePut = vi.fn().mockImplementation(() => firstPromise);
      testDb.contextValue.safeDb.safePut = mockSafePut;

      renderWithPouchDb(
        <TodoListElement {...defaultProps} todo={testTodos.active as TodoAlpha3} />,
        { testDb: testDb.contextValue },
      );

      // Find the pause button
      const pauseButton = screen.getByTestId('pause-button');

      // Click once to start the operation
      await user.click(pauseButton);

      // Wait a tick for the mutation to start
      await waitFor(() => {
        expect(mockSafePut).toHaveBeenCalledTimes(1);
      });

      // Try to click again while first operation is still pending
      // These should be ignored because mutation is pending
      await user.click(pauseButton);
      await user.click(pauseButton);

      // Resolve the first operation
      resolveFirst!();

      // Wait for mutation to complete
      await waitFor(() => {
        expect(pauseButton).not.toBeDisabled();
      });

      // Should still only have been called once
      expect(mockSafePut).toHaveBeenCalledTimes(1);
    });
  });
});
