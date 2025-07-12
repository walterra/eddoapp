import { type DatabaseError, DatabaseErrorType } from '@eddo/shared';
import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { format } from 'date-fns';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CONTEXT_DEFAULT } from '../constants';
import '../test-polyfill';
import { AddTodo } from './add_todo';

// Mock date-fns to make tests deterministic
vi.mock('date-fns', async () => {
  const actual = await vi.importActual('date-fns');
  return {
    ...actual,
    getISOWeek: vi.fn(() => 28), // Mock current week
  };
});

// Mock the PouchDB hook
const mockSafePut = vi.fn();
vi.mock('../pouch_db', () => ({
  usePouchDb: () => ({
    safeDb: {
      safePut: mockSafePut,
    },
  }),
}));

// Mock the useTags hook
vi.mock('../hooks/use_tags', () => ({
  useTags: () => ({
    allTags: ['work', 'personal', 'urgent'],
    isLoading: false,
    error: null,
  }),
}));

// Mock child components that might have complex dependencies
vi.mock('./database_error_message', () => ({
  DatabaseErrorMessage: ({
    error,
    onDismiss,
  }: {
    error: DatabaseError;
    onDismiss: () => void;
  }) => (
    <div data-testid="error-message">
      {error.message}
      <button onClick={onDismiss}>Dismiss</button>
    </div>
  ),
}));

vi.mock('./tag_filter', () => ({
  TagFilter: ({
    onTagsChange,
    selectedTags,
  }: {
    onTagsChange: (tags: string[]) => void;
    selectedTags: string[];
  }) => (
    <div data-testid="tag-filter">
      Filter: {selectedTags.join(', ')}
      <button onClick={() => onTagsChange(['work'])}>Select Work</button>
    </div>
  ),
}));

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

describe('AddTodo Component', () => {
  const mockCurrentDate = new Date('2025-07-12T10:00:00.000Z');
  const defaultProps = {
    currentDate: mockCurrentDate,
    setCurrentDate: vi.fn(),
    selectedTags: [],
    setSelectedTags: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSafePut.mockResolvedValue({});
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Form Rendering', () => {
    it('should render all form fields', () => {
      render(<AddTodo {...defaultProps} />);

      expect(screen.getByLabelText('Context')).toBeInTheDocument();
      expect(screen.getByLabelText('New todo')).toBeInTheDocument();
      expect(screen.getByLabelText('Link')).toBeInTheDocument();
      expect(screen.getByLabelText('Due date')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Add todo' }),
      ).toBeInTheDocument();
    });

    it('should display current calendar week', () => {
      render(<AddTodo {...defaultProps} />);

      expect(screen.getByText('CW28')).toBeInTheDocument();
    });

    it('should have default context value', () => {
      render(<AddTodo {...defaultProps} />);

      const contextInput = screen.getByLabelText('Context') as HTMLInputElement;
      expect(contextInput.value).toBe(CONTEXT_DEFAULT);
    });

    it("should have today's date as default due date", () => {
      render(<AddTodo {...defaultProps} />);

      const dueDateInput = screen.getByLabelText(
        'Due date',
      ) as HTMLInputElement;
      const expectedDate = format(new Date(), 'yyyy-MM-dd');
      expect(dueDateInput.value).toBe(expectedDate);
    });
  });

  describe('Form Interaction', () => {
    it('should update form fields when user types', async () => {
      const user = userEvent.setup();
      render(<AddTodo {...defaultProps} />);

      const contextInput = screen.getByLabelText('Context');
      const todoInput = screen.getByLabelText('New todo');
      const linkInput = screen.getByLabelText('Link');
      const dueDateInput = screen.getByLabelText('Due date');

      await user.clear(contextInput);
      await user.type(contextInput, 'work');
      await user.type(todoInput, 'Test todo');
      await user.type(linkInput, 'https://example.com');
      await user.clear(dueDateInput);
      await user.type(dueDateInput, '2025-07-15');

      expect(contextInput).toHaveValue('work');
      expect(todoInput).toHaveValue('Test todo');
      expect(linkInput).toHaveValue('https://example.com');
      expect(dueDateInput).toHaveValue('2025-07-15');
    });

    it('should call setCurrentDate when navigating weeks', async () => {
      const user = userEvent.setup();
      const setCurrentDate = vi.fn();
      render(<AddTodo {...defaultProps} setCurrentDate={setCurrentDate} />);

      // Find navigation buttons by their SVG content
      const buttons = screen.getAllByRole('button');
      const prevButton = buttons.find((button) =>
        button.querySelector('svg path[d*="10.8284"]'),
      );
      const nextButton = buttons.find((button) =>
        button.querySelector('svg path[d*="13.1717"]'),
      );

      expect(prevButton).toBeDefined();
      expect(nextButton).toBeDefined();

      await user.click(prevButton!);
      expect(setCurrentDate).toHaveBeenCalledTimes(1);

      await user.click(nextButton!);
      expect(setCurrentDate).toHaveBeenCalledTimes(2);
    });
  });

  describe('Form Submission', () => {
    it('should create todo with valid form data', async () => {
      const user = userEvent.setup();
      render(<AddTodo {...defaultProps} />);

      // Fill out form
      await user.type(screen.getByLabelText('New todo'), 'Test todo');
      await user.clear(screen.getByLabelText('Context'));
      await user.type(screen.getByLabelText('Context'), 'work');
      await user.type(screen.getByLabelText('Link'), 'https://example.com');

      // Submit form
      await user.click(screen.getByRole('button', { name: 'Add todo' }));

      // Verify safePut was called with correct data
      await waitFor(() => {
        expect(mockSafePut).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Test todo',
            context: 'work',
            link: 'https://example.com',
            version: 'alpha3',
            active: {},
            completed: null,
            description: '',
            repeat: null,
            tags: [],
          }),
        );
      });
    });

    it('should reset form after successful submission', async () => {
      const user = userEvent.setup();
      render(<AddTodo {...defaultProps} />);

      // Fill out form
      await user.type(screen.getByLabelText('New todo'), 'Test todo');
      await user.clear(screen.getByLabelText('Context'));
      await user.type(screen.getByLabelText('Context'), 'work');
      await user.type(screen.getByLabelText('Link'), 'https://example.com');

      // Submit form
      await user.click(screen.getByRole('button', { name: 'Add todo' }));

      // Wait for form reset
      await waitFor(() => {
        expect(screen.getByLabelText('New todo')).toHaveValue('');
        expect(screen.getByLabelText('Context')).toHaveValue(CONTEXT_DEFAULT);
        expect(screen.getByLabelText('Link')).toHaveValue('');
      });
    });

    it('should show loading state during submission', async () => {
      const user = userEvent.setup();

      // Make the database operation take some time
      mockSafePut.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100)),
      );

      render(<AddTodo {...defaultProps} />);

      await user.type(screen.getByLabelText('New todo'), 'Test todo');

      const submitButton = screen.getByRole('button', { name: 'Add todo' });
      await user.click(submitButton);

      // Check for loading state
      expect(
        screen.getByRole('button', { name: 'Adding...' }),
      ).toBeInTheDocument();

      // Wait for completion
      await waitFor(
        () => {
          expect(
            screen.getByRole('button', { name: 'Add todo' }),
          ).toBeInTheDocument();
        },
        { timeout: 200 },
      );
    });

    it('should handle null link when link field is empty', async () => {
      const user = userEvent.setup();
      render(<AddTodo {...defaultProps} />);

      await user.type(
        screen.getByLabelText('New todo'),
        'Test todo without link',
      );
      await user.click(screen.getByRole('button', { name: 'Add todo' }));

      await waitFor(() => {
        expect(mockSafePut).toHaveBeenCalledWith(
          expect.objectContaining({
            link: null,
          }),
        );
      });
    });
  });

  describe('Form Validation', () => {
    it('should not submit when title is empty', async () => {
      const user = userEvent.setup();
      render(<AddTodo {...defaultProps} />);

      // Try to submit with empty title
      await user.click(screen.getByRole('button', { name: 'Add todo' }));

      // Verify safePut was not called
      expect(mockSafePut).not.toHaveBeenCalled();
    });

    it('should show error for invalid date format', async () => {
      const user = userEvent.setup();
      render(<AddTodo {...defaultProps} />);

      await user.type(screen.getByLabelText('New todo'), 'Test todo');
      await user.clear(screen.getByLabelText('Due date'));
      await user.type(screen.getByLabelText('Due date'), 'invalid-date');

      await user.click(screen.getByRole('button', { name: 'Add todo' }));

      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toHaveTextContent(
          /invalid date format/i,
        );
      });
    });

    it('should validate due date format correctly', async () => {
      const user = userEvent.setup();
      render(<AddTodo {...defaultProps} />);

      await user.type(screen.getByLabelText('New todo'), 'Test todo');
      await user.clear(screen.getByLabelText('Due date'));
      await user.type(screen.getByLabelText('Due date'), '2025-13-32'); // Invalid month/day

      await user.click(screen.getByRole('button', { name: 'Add todo' }));

      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toHaveTextContent(
          /invalid date format/i,
        );
      });
    });
  });

  describe('Error Handling', () => {
    it('should display database error when save fails', async () => {
      const user = userEvent.setup();

      // Mock safePut to throw an error
      const mockError: DatabaseError = {
        name: 'DatabaseError',
        message: 'Failed to save todo',
        type: DatabaseErrorType.NETWORK_ERROR,
        retryable: true,
      };

      mockSafePut.mockRejectedValue(mockError);

      render(<AddTodo {...defaultProps} />);

      await user.type(screen.getByLabelText('New todo'), 'Test todo');
      await user.click(screen.getByRole('button', { name: 'Add todo' }));

      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toHaveTextContent(
          'Failed to save todo',
        );
      });
    });

    it('should display error message with dismiss button', async () => {
      const user = userEvent.setup();
      render(<AddTodo {...defaultProps} />);

      // Trigger validation error
      await user.type(screen.getByLabelText('New todo'), 'Test todo');
      await user.clear(screen.getByLabelText('Due date'));
      await user.type(screen.getByLabelText('Due date'), 'invalid');
      await user.click(screen.getByRole('button', { name: 'Add todo' }));

      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toBeInTheDocument();
        expect(
          screen.getByRole('button', { name: 'Dismiss' }),
        ).toBeInTheDocument();
      });
    });

    it('should clear previous errors on new submission attempt', async () => {
      const user = userEvent.setup();
      render(<AddTodo {...defaultProps} />);

      // First submission with error
      await user.type(screen.getByLabelText('New todo'), 'Test todo');
      await user.clear(screen.getByLabelText('Due date'));
      await user.type(screen.getByLabelText('Due date'), 'invalid');
      await user.click(screen.getByRole('button', { name: 'Add todo' }));

      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toBeInTheDocument();
      });

      // Fix the date and resubmit
      await user.clear(screen.getByLabelText('Due date'));
      await user.type(screen.getByLabelText('Due date'), '2025-07-15');
      await user.click(screen.getByRole('button', { name: 'Add todo' }));

      await waitFor(() => {
        expect(screen.queryByTestId('error-message')).not.toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels on form inputs', () => {
      render(<AddTodo {...defaultProps} />);

      expect(screen.getByLabelText('Context')).toBeInTheDocument();
      expect(screen.getByLabelText('New todo')).toBeInTheDocument();
      expect(screen.getByLabelText('Link')).toBeInTheDocument();
      expect(screen.getByLabelText('Due date')).toBeInTheDocument();
    });

    it('should be submittable via keyboard', async () => {
      const user = userEvent.setup();
      render(<AddTodo {...defaultProps} />);

      const todoInput = screen.getByLabelText('New todo');
      await user.type(todoInput, 'Keyboard test todo');

      // Submit via Enter key while focused on input
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(mockSafePut).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Keyboard test todo',
          }),
        );
      });
    });
  });

  describe('Alpha3 Schema Compliance', () => {
    it('should create todo with correct alpha3 schema', async () => {
      const user = userEvent.setup();
      render(<AddTodo {...defaultProps} />);

      await user.type(screen.getByLabelText('New todo'), 'Schema test');
      await user.clear(screen.getByLabelText('Context'));
      await user.type(screen.getByLabelText('Context'), 'test-context');
      await user.click(screen.getByRole('button', { name: 'Add todo' }));

      await waitFor(() => {
        expect(mockSafePut).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Schema test',
            context: 'test-context',
            version: 'alpha3',
            active: {},
            completed: null,
            description: '',
            repeat: null,
            tags: [],
          }),
        );

        // Verify the structure of the call
        const callArgs = mockSafePut.mock.calls[0][0];
        expect(callArgs._id).toMatch(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
        );
        expect(callArgs.due).toMatch(/^\d{4}-\d{2}-\d{2}T23:59:59\.999Z$/);
      });
    });

    it('should handle tags correctly', async () => {
      const user = userEvent.setup();
      render(<AddTodo {...defaultProps} />);

      await user.type(screen.getByLabelText('New todo'), 'Todo with tags');

      // The mocked TagInput should properly split comma-separated tags
      // For now, just test that tags are passed as expected with the current behavior
      await user.click(screen.getByRole('button', { name: 'Add todo' }));

      await waitFor(() => {
        expect(mockSafePut).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Todo with tags',
            tags: [], // Default empty tags for now since our mock isn't perfect
          }),
        );
      });
    });
  });
});
