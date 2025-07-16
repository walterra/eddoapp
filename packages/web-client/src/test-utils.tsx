// Test utilities for React component testing with real PouchDB
import type { TodoAlpha3 } from '@eddo/core-client';
import { type RenderOptions, render } from '@testing-library/react';
import { type ReactElement, type ReactNode } from 'react';

import { PouchDbContext, type PouchDbContextType } from './pouch_db_types';
import { createTestPouchDb } from './test-setup';

// Local test todo factory to avoid import issues
export const createTestTodo = (
  overrides: Partial<TodoAlpha3> & { _id: string },
): Omit<TodoAlpha3, '_rev'> => {
  return {
    _id: overrides._id,
    title: overrides.title ?? 'Test Todo',
    description: overrides.description ?? '',
    completed: overrides.completed ?? null,
    due: overrides.due ?? '2025-01-02',
    context: overrides.context ?? 'test',
    tags: overrides.tags ?? [],
    active: overrides.active ?? {},
    repeat: overrides.repeat ?? null,
    link: overrides.link ?? null,
    version: 'alpha3',
  };
};

// Test wrapper component that provides PouchDB context
export const TestWrapper = ({
  children,
  testDb,
}: {
  children: ReactNode;
  testDb?: PouchDbContextType;
}) => {
  const { contextValue } = testDb
    ? { contextValue: testDb }
    : createTestPouchDb();

  return (
    <PouchDbContext.Provider value={contextValue}>
      {children}
    </PouchDbContext.Provider>
  );
};

// Custom render function with real PouchDB context
export const renderWithPouchDb = (
  ui: ReactElement,
  options?: RenderOptions & { testDb?: PouchDbContextType },
): ReturnType<typeof render> => {
  const { testDb, ...renderOptions } = options || {};

  return render(ui, {
    wrapper: ({ children }) => (
      <TestWrapper testDb={testDb}>{children}</TestWrapper>
    ),
    ...renderOptions,
  });
};

// Create multiple test todos
export const createTestTodos = (
  count: number,
  baseOverrides: Partial<TodoAlpha3> = {},
): Omit<TodoAlpha3, '_rev'>[] => {
  return Array.from({ length: count }, (_, index) =>
    createTestTodo({
      _id: new Date(Date.now() + index).toISOString(),
      title: `Test Todo ${index + 1}`,
      ...baseOverrides,
    }),
  );
};

// Helper to populate database with test data
export const populateTestDatabase = async (
  db: PouchDB.Database,
  todos: Omit<TodoAlpha3, '_rev'>[],
) => {
  for (const todo of todos) {
    await db.put(todo);
  }
};

// Helper to setup design documents for testing
export const setupTestDesignDocuments = async (_db: PouchDB.Database) => {
  // For testing, we can skip design document setup
  // or import the actual ensureDesignDocuments function if needed
  console.log('Design documents setup skipped in tests');
};

// Common test data using the shared factory
export const testTodos = {
  completed: createTestTodo({
    _id: '2025-07-12T08:00:00.000Z',
    title: 'Completed Todo',
    completed: '2025-07-12T08:30:00.000Z',
  }),
  active: createTestTodo({
    _id: '2025-07-12T09:00:00.000Z',
    title: 'Active Todo',
    active: { '2025-07-12T09:00:00.000Z': null },
  }),
  withTags: createTestTodo({
    _id: '2025-07-12T10:00:00.000Z',
    title: 'Tagged Todo',
    tags: ['urgent', 'work'],
  }),
  withLink: createTestTodo({
    _id: '2025-07-12T11:00:00.000Z',
    title: 'Todo with Link',
    link: 'https://example.com',
  }),
  repeating: createTestTodo({
    _id: '2025-07-12T12:00:00.000Z',
    title: 'Daily Todo',
    repeat: 1,
  }),
};
