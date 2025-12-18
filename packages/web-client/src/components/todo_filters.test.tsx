import '@testing-library/jest-dom';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import '../test-polyfill';
import { createTestPouchDb, destroyTestPouchDb } from '../test-setup';
import { renderWithPouchDb } from '../test-utils';
import { TodoFilters } from './todo_filters';

// Mock hooks
vi.mock('../hooks/use_tags', () => ({
  useTags: () => ({
    allTags: ['work', 'personal', 'urgent'],
    isLoading: false,
    error: null,
  }),
}));

vi.mock('../hooks/use_eddo_contexts', () => ({
  useEddoContexts: () => ({
    allContexts: ['private', 'work', 'home'],
    isLoading: false,
    error: null,
  }),
}));

// Mock date-fns to make tests deterministic
vi.mock('date-fns', async () => {
  const actual = await vi.importActual('date-fns');
  return {
    ...actual,
    getISOWeek: vi.fn(() => 28),
  };
});

describe('TodoFilters Component', () => {
  let testDb: ReturnType<typeof createTestPouchDb>;
  const mockCurrentDate = new Date('2025-07-12T10:00:00.000Z');
  const defaultProps = {
    currentDate: mockCurrentDate,
    setCurrentDate: vi.fn(),
    selectedTags: [],
    setSelectedTags: vi.fn(),
    selectedContexts: [],
    setSelectedContexts: vi.fn(),
    selectedStatus: 'all' as const,
    setSelectedStatus: vi.fn(),
    selectedTimeRange: { type: 'current-week' as const },
    setSelectedTimeRange: vi.fn(),
    viewMode: 'kanban' as const,
    onViewModeChange: vi.fn(),
    tableColumns: ['title', 'due', 'tags', 'timeTracked', 'status'],
    onTableColumnsChange: vi.fn(),
    isViewPrefsLoading: false,
  };

  beforeEach(() => {
    testDb = createTestPouchDb();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    if (testDb?.db) {
      await destroyTestPouchDb(testDb.db);
    }
  });

  describe('Rendering', () => {
    it('should display current calendar week for current-week time range', () => {
      renderWithPouchDb(<TodoFilters {...defaultProps} />, { testDb: testDb.contextValue });

      expect(screen.getByText('CW28')).toBeInTheDocument();
    });

    it('should display navigation buttons for current-week time range', () => {
      renderWithPouchDb(<TodoFilters {...defaultProps} />, { testDb: testDb.contextValue });

      const buttons = screen.getAllByRole('button');
      const prevButton = buttons.find((button) => button.querySelector('svg'));
      const nextButton = buttons.find(
        (button) => button.querySelector('svg') && button !== prevButton,
      );

      expect(prevButton).toBeDefined();
      expect(nextButton).toBeDefined();
    });

    it('should not display navigation buttons for all-time time range', () => {
      const props = {
        ...defaultProps,
        selectedTimeRange: { type: 'all-time' as const },
      };
      renderWithPouchDb(<TodoFilters {...props} />, { testDb: testDb.contextValue });

      expect(screen.queryByText(/CW/)).not.toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('should call setCurrentDate when clicking previous period button', async () => {
      const user = userEvent.setup();
      const setCurrentDate = vi.fn();
      const props = { ...defaultProps, setCurrentDate };

      renderWithPouchDb(<TodoFilters {...props} />, { testDb: testDb.contextValue });

      const buttons = screen.getAllByRole('button');
      const prevButton = buttons.find((button) => button.querySelector('svg path[d*="10.8284"]'));

      if (prevButton) {
        await user.click(prevButton);
        expect(setCurrentDate).toHaveBeenCalledTimes(1);
      }
    });

    it('should call setCurrentDate when clicking next period button', async () => {
      const user = userEvent.setup();
      const setCurrentDate = vi.fn();
      const props = { ...defaultProps, setCurrentDate };

      renderWithPouchDb(<TodoFilters {...props} />, { testDb: testDb.contextValue });

      const buttons = screen.getAllByRole('button');
      const nextButton = buttons.find((button) => button.querySelector('svg path[d*="13.1717"]'));

      if (nextButton) {
        await user.click(nextButton);
        expect(setCurrentDate).toHaveBeenCalledTimes(1);
      }
    });
  });
});
