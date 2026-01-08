/**
 * Tests for AddTodoPopover component
 */
import '@testing-library/jest-dom';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import '../test-polyfill';
import { createTestPouchDb, destroyTestPouchDb } from '../test-setup';
import { renderWithPouchDb } from '../test-utils';
import { AddTodoPopover } from './add_todo_popover';

// Mock the useTags hook
vi.mock('../hooks/use_tags', () => ({
  useTags: () => ({
    allTags: ['work', 'personal', 'gtd:next'],
    isLoading: false,
    error: null,
  }),
}));

// Mock useAuditLog to avoid AuthProvider dependency
vi.mock('../hooks/use_audit_log', () => ({
  useAuditLog: () => ({
    logAudit: vi.fn(),
  }),
}));

describe('AddTodoPopover', () => {
  let testDb: ReturnType<typeof createTestPouchDb>;

  beforeEach(() => {
    testDb = createTestPouchDb();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await destroyTestPouchDb(testDb.db);
  });

  describe('rendering', () => {
    it('should render trigger button with label', () => {
      renderWithPouchDb(<AddTodoPopover />, { testDb: testDb.contextValue });

      expect(screen.getByRole('button', { name: /add todo/i })).toBeInTheDocument();
      expect(screen.getByText('Add todo')).toBeInTheDocument();
    });

    it('should show keyboard shortcut hint in title', () => {
      renderWithPouchDb(<AddTodoPopover />, { testDb: testDb.contextValue });

      const button = screen.getByRole('button', { name: /add todo/i });
      expect(button).toHaveAttribute('title', 'Add todo (n)');
    });
  });

  describe('popover interactions', () => {
    it('should open popover when button clicked', async () => {
      renderWithPouchDb(<AddTodoPopover />, { testDb: testDb.contextValue });

      const button = screen.getByRole('button', { name: /add todo/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('What needs to be done?')).toBeInTheDocument();
      });
    });

    it('should close popover on escape key', async () => {
      renderWithPouchDb(<AddTodoPopover />, { testDb: testDb.contextValue });

      const button = screen.getByRole('button', { name: /add todo/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('What needs to be done?')).toBeInTheDocument();
      });

      fireEvent.keyDown(document, { key: 'Escape' });

      await waitFor(() => {
        expect(screen.queryByPlaceholderText('What needs to be done?')).not.toBeInTheDocument();
      });
    });

    it('should close popover when cancel button clicked', async () => {
      renderWithPouchDb(<AddTodoPopover />, { testDb: testDb.contextValue });

      const button = screen.getByRole('button', { name: /add todo/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('Cancel')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Cancel'));

      await waitFor(() => {
        expect(screen.queryByPlaceholderText('What needs to be done?')).not.toBeInTheDocument();
      });
    });
  });

  describe('keyboard shortcut', () => {
    it('should open popover when n key pressed', async () => {
      renderWithPouchDb(<AddTodoPopover />, { testDb: testDb.contextValue });

      fireEvent.keyDown(document, { key: 'n' });

      await waitFor(() => {
        expect(screen.getByPlaceholderText('What needs to be done?')).toBeInTheDocument();
      });
    });

    it('should not open when n pressed with modifier keys', async () => {
      renderWithPouchDb(<AddTodoPopover />, { testDb: testDb.contextValue });

      fireEvent.keyDown(document, { key: 'n', ctrlKey: true });
      fireEvent.keyDown(document, { key: 'n', metaKey: true });
      fireEvent.keyDown(document, { key: 'n', altKey: true });

      // Popover should not open
      expect(screen.queryByPlaceholderText('What needs to be done?')).not.toBeInTheDocument();
    });

    it('should not open when n pressed while typing in input', async () => {
      renderWithPouchDb(
        <div>
          <input data-testid="other-input" type="text" />
          <AddTodoPopover />
        </div>,
        { testDb: testDb.contextValue },
      );

      const input = screen.getByTestId('other-input');
      input.focus();

      fireEvent.keyDown(input, { key: 'n' });

      // Popover should not open
      expect(screen.queryByPlaceholderText('What needs to be done?')).not.toBeInTheDocument();
    });
  });

  describe('form submission', () => {
    it('should have disabled add button when title is empty', async () => {
      renderWithPouchDb(<AddTodoPopover />, { testDb: testDb.contextValue });

      fireEvent.click(screen.getByRole('button', { name: /add todo/i }));

      await waitFor(() => {
        const addButton = screen.getByRole('button', { name: 'Add' });
        expect(addButton).toBeDisabled();
      });
    });

    it('should enable add button when title is entered', async () => {
      renderWithPouchDb(<AddTodoPopover />, { testDb: testDb.contextValue });

      fireEvent.click(screen.getByRole('button', { name: /add todo/i }));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('What needs to be done?')).toBeInTheDocument();
      });

      const titleInput = screen.getByPlaceholderText('What needs to be done?');
      fireEvent.change(titleInput, { target: { value: 'New todo item' } });

      const addButton = screen.getByRole('button', { name: 'Add' });
      expect(addButton).not.toBeDisabled();
    });

    it('should create todo and close popover on successful submission', async () => {
      const safePutSpy = vi.spyOn(testDb.contextValue.safeDb, 'safePut').mockResolvedValue({
        _id: '2026-01-08T10:00:00.000Z',
        _rev: '1-abc',
      } as never);

      renderWithPouchDb(<AddTodoPopover />, { testDb: testDb.contextValue });

      fireEvent.click(screen.getByRole('button', { name: /add todo/i }));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('What needs to be done?')).toBeInTheDocument();
      });

      const titleInput = screen.getByPlaceholderText('What needs to be done?');
      fireEvent.change(titleInput, { target: { value: 'New todo item' } });

      const form = titleInput.closest('form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(safePutSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'New todo item',
            version: 'alpha3',
          }),
        );
      });

      // Popover should close after successful submission
      await waitFor(() => {
        expect(screen.queryByPlaceholderText('What needs to be done?')).not.toBeInTheDocument();
      });
    });
  });

  describe('form fields', () => {
    it('should render all form fields', async () => {
      renderWithPouchDb(<AddTodoPopover />, { testDb: testDb.contextValue });

      fireEvent.click(screen.getByRole('button', { name: /add todo/i }));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('What needs to be done?')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('context')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('url (optional)')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('tags')).toBeInTheDocument();
      });
    });

    it('should have default context value', async () => {
      renderWithPouchDb(<AddTodoPopover />, { testDb: testDb.contextValue });

      fireEvent.click(screen.getByRole('button', { name: /add todo/i }));

      await waitFor(() => {
        const contextInput = screen.getByPlaceholderText('context');
        expect(contextInput).toHaveValue('private');
      });
    });

    it('should have today as default due date', async () => {
      renderWithPouchDb(<AddTodoPopover />, { testDb: testDb.contextValue });

      fireEvent.click(screen.getByRole('button', { name: /add todo/i }));

      await waitFor(() => {
        const dueDateInput = screen.getByLabelText('Due date');
        const today = new Date().toISOString().split('T')[0];
        expect(dueDateInput).toHaveValue(today);
      });
    });
  });
});
