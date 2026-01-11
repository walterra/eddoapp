/**
 * Note Management Tools - Add, update, and delete notes on todos
 */
import type { TodoAlpha3, TodoNote } from '@eddo/core-server';
import { z } from 'zod';

import { logMcpAudit, pushAuditIdToTodo } from './audit-helper.js';
import { createErrorResponse, createSuccessResponse } from './response-helpers.js';
import type { GetUserDb, ToolContext } from './types.js';

/** Generates a UUID v4 for note identification */
function generateNoteId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Creates a new note object */
function createNote(content: string): TodoNote {
  return {
    id: generateNoteId(),
    content,
    createdAt: new Date().toISOString(),
  };
}

/** Finds note index in array, returns -1 if not found */
function findNoteIndex(notes: TodoNote[], noteId: string): number {
  return notes.findIndex((n) => n.id === noteId);
}

/** Builds note not found error response */
function noteNotFoundResponse(noteId: string, todoId: string, operation: string): string {
  return createErrorResponse({
    summary: 'Note not found',
    error: new Error(`Note with ID ${noteId} not found on todo ${todoId}`),
    operation,
    recoverySuggestions: [
      'Use getTodo to list available notes on this todo',
      'Verify the note ID is correct',
    ],
  });
}

interface AuditAndRespondOptions {
  context: ToolContext;
  db: ReturnType<GetUserDb>;
  before: TodoAlpha3;
  after: TodoAlpha3;
  responseData: Record<string, unknown>;
  operation: string;
  startTime: number;
}

/** Maps operation name to past tense verb */
function getOperationVerb(operation: string): string {
  const verbs: Record<string, string> = {
    add_note: 'added',
    update_note: 'updated',
    delete_note: 'deleted',
  };
  return verbs[operation] ?? operation;
}

/** Logs audit and returns success response for note operations */
async function logAndRespond(options: AuditAndRespondOptions): Promise<string> {
  const { context, db, before, after, responseData, operation, startTime } = options;
  const auditId = await logMcpAudit(context, {
    action: 'update',
    entityId: after._id,
    before,
    after,
  });
  if (auditId) {
    await pushAuditIdToTodo(db, after._id, auditId, context);
  }
  return createSuccessResponse({
    summary: `Note ${getOperationVerb(operation)} successfully`,
    data: responseData,
    operation,
    executionTime: Date.now() - startTime,
  });
}

// ============================================================================
// ADD NOTE
// ============================================================================

export const addNoteDescription = `Add a note to an existing todo. Notes function as a work diary for tracking progress, decisions, and context. Content supports markdown formatting.`;

export const addNoteParameters = z.object({
  todoId: z.string().describe('The unique identifier of the todo to add a note to'),
  content: z.string().describe('The note content (supports markdown formatting)'),
});

export type AddNoteArgs = z.infer<typeof addNoteParameters>;

/** Adds a new note to a todo */
export async function executeAddNote(
  args: AddNoteArgs,
  context: ToolContext,
  getUserDb: GetUserDb,
): Promise<string> {
  const db = getUserDb(context);
  context.log.info('Adding note to todo', { userId: context.session?.userId, todoId: args.todoId });

  try {
    const startTime = Date.now();
    const todo = (await db.get(args.todoId)) as TodoAlpha3;
    const newNote = createNote(args.content);
    const updatedTodo: TodoAlpha3 = { ...todo, notes: [...(todo.notes ?? []), newNote] };

    await db.insert(updatedTodo);
    context.log.info('Note added successfully', { todoId: args.todoId, noteId: newNote.id });

    return logAndRespond({
      context,
      db,
      before: todo,
      after: updatedTodo,
      startTime,
      operation: 'add_note',
      responseData: {
        todoId: updatedTodo._id,
        noteId: newNote.id,
        notesCount: updatedTodo.notes?.length ?? 0,
      },
    });
  } catch (error) {
    return createErrorResponse({
      summary: 'Failed to add note',
      error,
      operation: 'add_note',
      recoverySuggestions: ['Verify the todo ID exists using listTodos'],
    });
  }
}

// ============================================================================
// UPDATE NOTE
// ============================================================================

export const updateNoteDescription = `Update an existing note on a todo. Use this to edit note content.`;

export const updateNoteParameters = z.object({
  todoId: z.string().describe('The unique identifier of the todo containing the note'),
  noteId: z.string().describe('The unique identifier of the note to update'),
  content: z.string().describe('The updated note content (supports markdown formatting)'),
});

export type UpdateNoteArgs = z.infer<typeof updateNoteParameters>;

/** Updates an existing note on a todo */
export async function executeUpdateNote(
  args: UpdateNoteArgs,
  context: ToolContext,
  getUserDb: GetUserDb,
): Promise<string> {
  const db = getUserDb(context);
  context.log.info('Updating note', { userId: context.session?.userId, todoId: args.todoId });

  try {
    const startTime = Date.now();
    const todo = (await db.get(args.todoId)) as TodoAlpha3;
    const existingNotes = todo.notes ?? [];
    const noteIndex = findNoteIndex(existingNotes, args.noteId);

    if (noteIndex === -1) {
      return noteNotFoundResponse(args.noteId, args.todoId, 'update_note');
    }

    const now = new Date().toISOString();
    const updatedNotes = [...existingNotes];
    updatedNotes[noteIndex] = {
      ...existingNotes[noteIndex],
      content: args.content,
      updatedAt: now,
    };
    const updatedTodo: TodoAlpha3 = { ...todo, notes: updatedNotes };

    await db.insert(updatedTodo);
    context.log.info('Note updated successfully', { todoId: args.todoId, noteId: args.noteId });

    return logAndRespond({
      context,
      db,
      before: todo,
      after: updatedTodo,
      startTime,
      operation: 'update_note',
      responseData: { todoId: updatedTodo._id, noteId: args.noteId, updatedAt: now },
    });
  } catch (error) {
    return createErrorResponse({
      summary: 'Failed to update note',
      error,
      operation: 'update_note',
      recoverySuggestions: ['Verify the todo and note IDs exist'],
    });
  }
}

// ============================================================================
// DELETE NOTE
// ============================================================================

export const deleteNoteDescription = `Delete a note from a todo.`;

export const deleteNoteParameters = z.object({
  todoId: z.string().describe('The unique identifier of the todo containing the note'),
  noteId: z.string().describe('The unique identifier of the note to delete'),
});

export type DeleteNoteArgs = z.infer<typeof deleteNoteParameters>;

/** Deletes a note from a todo */
export async function executeDeleteNote(
  args: DeleteNoteArgs,
  context: ToolContext,
  getUserDb: GetUserDb,
): Promise<string> {
  const db = getUserDb(context);
  context.log.info('Deleting note', { userId: context.session?.userId, todoId: args.todoId });

  try {
    const startTime = Date.now();
    const todo = (await db.get(args.todoId)) as TodoAlpha3;
    const existingNotes = todo.notes ?? [];
    const noteIndex = findNoteIndex(existingNotes, args.noteId);

    if (noteIndex === -1) {
      return noteNotFoundResponse(args.noteId, args.todoId, 'delete_note');
    }

    const deletedNote = existingNotes[noteIndex];
    const updatedNotes = existingNotes.filter((n) => n.id !== args.noteId);
    const updatedTodo: TodoAlpha3 = { ...todo, notes: updatedNotes };

    await db.insert(updatedTodo);
    context.log.info('Note deleted successfully', { todoId: args.todoId, noteId: args.noteId });

    const preview =
      deletedNote.content.substring(0, 50) + (deletedNote.content.length > 50 ? '...' : '');
    return logAndRespond({
      context,
      db,
      before: todo,
      after: updatedTodo,
      startTime,
      operation: 'delete_note',
      responseData: {
        todoId: updatedTodo._id,
        deletedNoteId: args.noteId,
        deletedContent: preview,
        remainingNotesCount: updatedNotes.length,
      },
    });
  } catch (error) {
    return createErrorResponse({
      summary: 'Failed to delete note',
      error,
      operation: 'delete_note',
      recoverySuggestions: ['Verify the todo and note IDs exist'],
    });
  }
}
