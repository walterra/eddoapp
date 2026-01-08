/**
 * Unit tests for note management tools
 */
import { describe, expect, it, vi } from 'vitest';

import { executeAddNote, executeDeleteNote, executeUpdateNote } from './note-tools.js';
import type { GetUserDb, ToolContext } from './types.js';

/** Creates a mock tool context */
function createMockContext(): ToolContext {
  return {
    log: {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    },
    session: { userId: 'test-user', dbName: 'eddo_test', username: 'testuser' },
    reportProgress: vi.fn(),
  } as unknown as ToolContext;
}

/** Creates a mock database with customizable behavior */
function createMockDb(todo: Record<string, unknown> = {}) {
  const defaultTodo = {
    _id: '2026-01-08T10:00:00.000Z',
    _rev: '1-abc',
    title: 'Test Todo',
    description: '',
    context: 'test',
    due: '2026-01-08T23:59:59.999Z',
    tags: [],
    completed: null,
    active: {},
    repeat: null,
    link: null,
    parentId: null,
    notes: [],
    version: 'alpha3',
    ...todo,
  };

  return {
    get: vi.fn().mockResolvedValue(defaultTodo),
    insert: vi.fn().mockResolvedValue({ id: defaultTodo._id, rev: '2-def' }),
  };
}

describe('note-tools', () => {
  describe('executeAddNote', () => {
    it('adds a note to a todo without existing notes', async () => {
      const mockDb = createMockDb({ notes: undefined });
      const getUserDb = vi.fn().mockReturnValue(mockDb) as unknown as GetUserDb;
      const context = createMockContext();

      const result = await executeAddNote(
        { todoId: '2026-01-08T10:00:00.000Z', content: 'Test note content' },
        context,
        getUserDb,
      );

      const parsed = JSON.parse(result);
      expect(parsed.summary).toBe('Note added successfully');
      expect(parsed.data.notesCount).toBe(1);
      expect(mockDb.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          notes: expect.arrayContaining([
            expect.objectContaining({ content: 'Test note content' }),
          ]),
        }),
      );
    });

    it('adds a note to a todo with existing notes', async () => {
      const existingNote = {
        id: 'existing-note-id',
        content: 'Existing note',
        createdAt: '2026-01-07T10:00:00.000Z',
      };
      const mockDb = createMockDb({ notes: [existingNote] });
      const getUserDb = vi.fn().mockReturnValue(mockDb) as unknown as GetUserDb;
      const context = createMockContext();

      const result = await executeAddNote(
        { todoId: '2026-01-08T10:00:00.000Z', content: 'New note' },
        context,
        getUserDb,
      );

      const parsed = JSON.parse(result);
      expect(parsed.data.notesCount).toBe(2);
    });

    it('returns error when todo not found', async () => {
      const mockDb = createMockDb();
      mockDb.get = vi.fn().mockRejectedValue(new Error('not found'));
      const getUserDb = vi.fn().mockReturnValue(mockDb) as unknown as GetUserDb;
      const context = createMockContext();

      const result = await executeAddNote(
        { todoId: 'non-existent', content: 'Test note' },
        context,
        getUserDb,
      );

      const parsed = JSON.parse(result);
      expect(parsed.summary).toBe('Failed to add note');
    });
  });

  describe('executeUpdateNote', () => {
    it('updates an existing note', async () => {
      const existingNote = {
        id: 'note-to-update',
        content: 'Original content',
        createdAt: '2026-01-07T10:00:00.000Z',
      };
      const mockDb = createMockDb({ notes: [existingNote] });
      const getUserDb = vi.fn().mockReturnValue(mockDb) as unknown as GetUserDb;
      const context = createMockContext();

      const result = await executeUpdateNote(
        {
          todoId: '2026-01-08T10:00:00.000Z',
          noteId: 'note-to-update',
          content: 'Updated content',
        },
        context,
        getUserDb,
      );

      const parsed = JSON.parse(result);
      expect(parsed.summary).toBe('Note updated successfully');
      expect(mockDb.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          notes: expect.arrayContaining([
            expect.objectContaining({
              id: 'note-to-update',
              content: 'Updated content',
              updatedAt: expect.any(String),
            }),
          ]),
        }),
      );
    });

    it('returns error when note not found', async () => {
      const mockDb = createMockDb({ notes: [] });
      const getUserDb = vi.fn().mockReturnValue(mockDb) as unknown as GetUserDb;
      const context = createMockContext();

      const result = await executeUpdateNote(
        { todoId: '2026-01-08T10:00:00.000Z', noteId: 'non-existent', content: 'Test' },
        context,
        getUserDb,
      );

      const parsed = JSON.parse(result);
      expect(parsed.summary).toBe('Note not found');
    });
  });

  describe('executeDeleteNote', () => {
    it('deletes an existing note', async () => {
      const noteToDelete = {
        id: 'note-to-delete',
        content: 'This will be deleted',
        createdAt: '2026-01-07T10:00:00.000Z',
      };
      const mockDb = createMockDb({ notes: [noteToDelete] });
      const getUserDb = vi.fn().mockReturnValue(mockDb) as unknown as GetUserDb;
      const context = createMockContext();

      const result = await executeDeleteNote(
        { todoId: '2026-01-08T10:00:00.000Z', noteId: 'note-to-delete' },
        context,
        getUserDb,
      );

      const parsed = JSON.parse(result);
      expect(parsed.summary).toBe('Note deleted successfully');
      expect(parsed.data.remainingNotesCount).toBe(0);
      expect(mockDb.insert).toHaveBeenCalledWith(expect.objectContaining({ notes: [] }));
    });

    it('returns error when note not found', async () => {
      const mockDb = createMockDb({ notes: [] });
      const getUserDb = vi.fn().mockReturnValue(mockDb) as unknown as GetUserDb;
      const context = createMockContext();

      const result = await executeDeleteNote(
        { todoId: '2026-01-08T10:00:00.000Z', noteId: 'non-existent' },
        context,
        getUserDb,
      );

      const parsed = JSON.parse(result);
      expect(parsed.summary).toBe('Note not found');
    });

    it('truncates long note content in response', async () => {
      const longNote = {
        id: 'long-note',
        content: 'A'.repeat(100),
        createdAt: '2026-01-07T10:00:00.000Z',
      };
      const mockDb = createMockDb({ notes: [longNote] });
      const getUserDb = vi.fn().mockReturnValue(mockDb) as unknown as GetUserDb;
      const context = createMockContext();

      const result = await executeDeleteNote(
        { todoId: '2026-01-08T10:00:00.000Z', noteId: 'long-note' },
        context,
        getUserDb,
      );

      const parsed = JSON.parse(result);
      expect(parsed.data.deletedContent).toHaveLength(53); // 50 + '...'
      expect(parsed.data.deletedContent).toMatch(/\.\.\.$/);
    });
  });
});
