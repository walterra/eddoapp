/**
 * Tests for TagsPopover component
 */
import '@testing-library/jest-dom';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import '../test-polyfill';
import { createTestPouchDb, destroyTestPouchDb } from '../test-setup';
import { createTestTodo, renderWithPouchDb } from '../test-utils';
import { TagsPopover } from './tags_popover';

// Mock the useTags hook
vi.mock('../hooks/use_tags', () => ({
  useTags: () => ({
    allTags: ['work', 'personal', 'urgent', 'gtd:next'],
    isLoading: false,
    error: null,
  }),
}));

// Mock the InlineTagInput to simplify testing
vi.mock('./tags_popover_input', () => ({
  InlineTagInput: ({
    onChange,
    tags,
    autoFocus: _autoFocus,
    suggestions: _suggestions,
  }: {
    onChange: (tags: string[]) => void;
    tags: string[];
    autoFocus?: boolean;
    suggestions?: string[];
  }) => (
    <div data-testid="inline-tag-input">
      <input
        data-testid="tag-input-field"
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
        placeholder="Add tags..."
        value={tags.join(',')}
      />
    </div>
  ),
}));

describe('TagsPopover', () => {
  let testDb: ReturnType<typeof createTestPouchDb>;

  beforeEach(() => {
    testDb = createTestPouchDb();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await destroyTestPouchDb(testDb.db);
  });

  describe('rendering', () => {
    it('should render tags when todo has tags', () => {
      const todo = {
        ...createTestTodo({ _id: '2025-01-15T10:00:00.000Z' }),
        _rev: '1-abc',
        tags: ['work', 'urgent'],
      };

      renderWithPouchDb(<TagsPopover todo={todo} />, { testDb: testDb.contextValue });

      expect(screen.getByText('work')).toBeInTheDocument();
      expect(screen.getByText('urgent')).toBeInTheDocument();
    });

    it('should render placeholder when todo has no tags', () => {
      const todo = {
        ...createTestTodo({ _id: '2025-01-15T10:00:00.000Z' }),
        _rev: '1-abc',
        tags: [],
      };

      renderWithPouchDb(<TagsPopover todo={todo} />, { testDb: testDb.contextValue });

      expect(screen.getByText('Add tags...')).toBeInTheDocument();
    });

    it('should show +N indicator when more than 3 tags', () => {
      const todo = {
        ...createTestTodo({ _id: '2025-01-15T10:00:00.000Z' }),
        _rev: '1-abc',
        tags: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5'],
      };

      renderWithPouchDb(<TagsPopover todo={todo} />, { testDb: testDb.contextValue });

      expect(screen.getByText('tag1')).toBeInTheDocument();
      expect(screen.getByText('tag2')).toBeInTheDocument();
      expect(screen.getByText('tag3')).toBeInTheDocument();
      expect(screen.getByText('+2')).toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('should open popover when clicked', async () => {
      const todo = {
        ...createTestTodo({ _id: '2025-01-15T10:00:00.000Z' }),
        _rev: '1-abc',
        tags: ['work'],
      };

      renderWithPouchDb(<TagsPopover todo={todo} />, { testDb: testDb.contextValue });

      const trigger = screen.getByTitle('Edit tags');
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByTestId('inline-tag-input')).toBeInTheDocument();
      });
    });

    it('should close popover on escape key', async () => {
      const todo = {
        ...createTestTodo({ _id: '2025-01-15T10:00:00.000Z' }),
        _rev: '1-abc',
        tags: ['work'],
      };

      renderWithPouchDb(<TagsPopover todo={todo} />, { testDb: testDb.contextValue });

      const trigger = screen.getByTitle('Edit tags');
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByTestId('inline-tag-input')).toBeInTheDocument();
      });

      fireEvent.keyDown(document, { key: 'Escape' });

      await waitFor(() => {
        expect(screen.queryByTestId('inline-tag-input')).not.toBeInTheDocument();
      });
    });

    it('should call mutation when tags change on close', async () => {
      const safePutSpy = vi.spyOn(testDb.contextValue.safeDb, 'safePut').mockResolvedValue({
        _id: '2025-01-15T10:00:00.000Z',
        _rev: '2-def',
      } as never);

      const todo = {
        ...createTestTodo({ _id: '2025-01-15T10:00:00.000Z' }),
        _rev: '1-abc',
        tags: ['work'],
      };

      renderWithPouchDb(<TagsPopover todo={todo} />, { testDb: testDb.contextValue });

      const trigger = screen.getByTitle('Edit tags');
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByTestId('inline-tag-input')).toBeInTheDocument();
      });

      // Change tags in the input
      const input = screen.getByTestId('tag-input-field');
      fireEvent.change(input, { target: { value: 'work,newtag' } });

      // Close popover by pressing escape
      fireEvent.keyDown(document, { key: 'Escape' });

      await waitFor(() => {
        expect(safePutSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            tags: ['work', 'newtag'],
          }),
        );
      });
    });

    it('should not save if tags unchanged', async () => {
      const safePutSpy = vi.spyOn(testDb.contextValue.safeDb, 'safePut');

      const todo = {
        ...createTestTodo({ _id: '2025-01-15T10:00:00.000Z' }),
        _rev: '1-abc',
        tags: ['work'],
      };

      renderWithPouchDb(<TagsPopover todo={todo} />, { testDb: testDb.contextValue });

      const trigger = screen.getByTitle('Edit tags');
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByTestId('inline-tag-input')).toBeInTheDocument();
      });

      // Close without making changes
      fireEvent.keyDown(document, { key: 'Escape' });

      await waitFor(() => {
        expect(screen.queryByTestId('inline-tag-input')).not.toBeInTheDocument();
      });

      // Should not have called safePut since tags didn't change
      expect(safePutSpy).not.toHaveBeenCalled();
    });
  });
});
