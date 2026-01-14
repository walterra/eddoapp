/**
 * Notes field component for todo editing with attachment support
 */
import { type Todo, type TodoNote } from '@eddo/core-client';
import { Button, Label, Textarea } from 'flowbite-react';
import { type FC, useState } from 'react';
import { BiNote, BiPlus, BiTrash } from 'react-icons/bi';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { NoteAttachments } from './note_attachments';

/** Generates a UUID v4 for note identification */
function generateNoteId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Formats a date for display */
function formatNoteDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface NoteEditorHeaderProps {
  createdAt: string;
  updatedAt?: string;
  isEditing: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

const NoteEditorHeader: FC<NoteEditorHeaderProps> = ({
  createdAt,
  updatedAt,
  isEditing,
  onEdit,
  onDelete,
}) => (
  <div className="mb-2 flex items-center justify-between">
    <span className="text-xs text-neutral-500 dark:text-neutral-400">
      {formatNoteDate(createdAt)}
      {updatedAt && <span className="italic"> (edited)</span>}
    </span>
    {!isEditing && (
      <div className="flex gap-1">
        <Button color="gray" onClick={onEdit} size="xs">
          Edit
        </Button>
        <Button color="red" onClick={onDelete} size="xs">
          <BiTrash size="1em" />
        </Button>
      </div>
    )}
  </div>
);

interface NoteEditorFormProps {
  content: string;
  onChange: (content: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

const NoteEditorForm: FC<NoteEditorFormProps> = ({ content, onChange, onSave, onCancel }) => (
  <div className="space-y-2">
    <Textarea onChange={(e) => onChange(e.target.value)} rows={3} value={content} />
    <div className="flex justify-end gap-2">
      <Button color="gray" onClick={onCancel} size="xs">
        Cancel
      </Button>
      <Button color="blue" onClick={onSave} size="xs">
        Save
      </Button>
    </div>
  </div>
);

interface NoteEditorProps {
  todoId: string;
  note: TodoNote;
  onUpdate: (content: string, attachments?: string[]) => void;
  onDelete: () => void;
}

const NoteEditor: FC<NoteEditorProps> = ({ todoId, note, onUpdate, onDelete }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(note.content);

  const handleSave = () => {
    onUpdate(editContent);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditContent(note.content);
    setIsEditing(false);
  };

  const handleAttachmentsChange = (attachments: string[]) => {
    onUpdate(note.content, attachments);
  };

  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-600 dark:bg-neutral-700">
      <NoteEditorHeader
        createdAt={note.createdAt}
        isEditing={isEditing}
        onDelete={onDelete}
        onEdit={() => setIsEditing(true)}
        updatedAt={note.updatedAt}
      />
      {isEditing ? (
        <NoteEditorForm
          content={editContent}
          onCancel={handleCancel}
          onChange={setEditContent}
          onSave={handleSave}
        />
      ) : (
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <Markdown remarkPlugins={[remarkGfm]}>{note.content}</Markdown>
        </div>
      )}
      <NoteAttachments
        attachments={note.attachments}
        noteId={note.id}
        onAttachmentsChange={handleAttachmentsChange}
        todoId={todoId}
      />
    </div>
  );
};

interface AddNoteFormProps {
  todoId: string;
  noteId: string;
  content: string;
  attachments: string[];
  onChange: (content: string) => void;
  onAttachmentsChange: (attachments: string[]) => void;
  onAdd: () => void;
  onCancel: () => void;
}

const AddNoteForm: FC<AddNoteFormProps> = ({
  todoId,
  noteId,
  content,
  attachments,
  onChange,
  onAttachmentsChange,
  onAdd,
  onCancel,
}) => (
  <div className="mb-3 space-y-2 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/30">
    <Textarea
      onChange={(e) => onChange(e.target.value)}
      placeholder="Add a note... (supports Markdown)"
      rows={3}
      value={content}
    />
    <NoteAttachments
      attachments={attachments}
      noteId={noteId}
      onAttachmentsChange={onAttachmentsChange}
      todoId={todoId}
    />
    <div className="flex justify-end gap-2">
      <Button color="gray" onClick={onCancel} size="xs">
        Cancel
      </Button>
      <Button color="blue" disabled={!content.trim()} onClick={onAdd} size="xs">
        Add Note
      </Button>
    </div>
  </div>
);

interface NotesFieldProps {
  todo: Todo;
  onChange: (updater: (todo: Todo) => Todo) => void;
}

/** Creates handlers for note operations */
function useNoteHandlers(onChange: NotesFieldProps['onChange']) {
  const addNote = (noteId: string, content: string, attachments?: string[]) => {
    const newNote: TodoNote = {
      id: noteId,
      content,
      createdAt: new Date().toISOString(),
      ...(attachments && attachments.length > 0 && { attachments }),
    };
    onChange((t) => ({ ...t, notes: [...(t.notes ?? []), newNote] }));
  };

  const updateNote = (noteId: string, content: string, attachments?: string[]) => {
    onChange((t) => ({
      ...t,
      notes: (t.notes ?? []).map((n) =>
        n.id === noteId
          ? {
              ...n,
              content,
              updatedAt: new Date().toISOString(),
              ...(attachments !== undefined && { attachments }),
            }
          : n,
      ),
    }));
  };

  const deleteNote = (noteId: string) => {
    onChange((t) => ({ ...t, notes: (t.notes ?? []).filter((n) => n.id !== noteId) }));
  };

  return { addNote, updateNote, deleteNote };
}

interface NotesListProps {
  todoId: string;
  notes: TodoNote[];
  onUpdate: (noteId: string, content: string, attachments?: string[]) => void;
  onDelete: (noteId: string) => void;
}

const NotesList: FC<NotesListProps> = ({ todoId, notes, onUpdate, onDelete }) => {
  const sortedNotes = [...notes].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <div className="space-y-2">
      {sortedNotes.map((note) => (
        <NoteEditor
          key={note.id}
          note={note}
          onDelete={() => onDelete(note.id)}
          onUpdate={(content, attachments) => onUpdate(note.id, content, attachments)}
          todoId={todoId}
        />
      ))}
    </div>
  );
};

/** State for the new note form */
interface NewNoteState {
  content: string;
  attachments: string[];
  noteId: string;
  isAdding: boolean;
}

const initialNewNoteState: NewNoteState = {
  content: '',
  attachments: [],
  noteId: '',
  isAdding: false,
};

/** Hook for managing new note form state */
function useNewNoteState(addNote: ReturnType<typeof useNoteHandlers>['addNote']) {
  const [state, setState] = useState<NewNoteState>(initialNewNoteState);

  const start = () =>
    setState({ ...initialNewNoteState, noteId: generateNoteId(), isAdding: true });
  const cancel = () => setState(initialNewNoteState);
  const setContent = (content: string) => setState((s) => ({ ...s, content }));
  const setAttachments = (attachments: string[]) => setState((s) => ({ ...s, attachments }));

  const submit = () => {
    if (!state.content.trim()) return;
    addNote(state.noteId, state.content.trim(), state.attachments);
    setState(initialNewNoteState);
  };

  return { state, start, cancel, setContent, setAttachments, submit };
}

export const NotesField: FC<NotesFieldProps> = ({ todo, onChange }) => {
  const { addNote, updateNote, deleteNote } = useNoteHandlers(onChange);
  const newNote = useNewNoteState(addNote);
  const notes = todo.notes ?? [];

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <Label className="flex items-center gap-1.5">
          <BiNote size="1.1em" />
          Notes {notes.length > 0 && `(${notes.length})`}
        </Label>
        {!newNote.state.isAdding && (
          <Button color="gray" onClick={newNote.start} size="xs">
            <BiPlus className="mr-1" size="1em" />
            Add Note
          </Button>
        )}
      </div>
      {newNote.state.isAdding && (
        <AddNoteForm
          attachments={newNote.state.attachments}
          content={newNote.state.content}
          noteId={newNote.state.noteId}
          onAdd={newNote.submit}
          onAttachmentsChange={newNote.setAttachments}
          onCancel={newNote.cancel}
          onChange={newNote.setContent}
          todoId={todo._id}
        />
      )}
      {notes.length > 0 && (
        <NotesList notes={notes} onDelete={deleteNote} onUpdate={updateNote} todoId={todo._id} />
      )}
      {notes.length === 0 && !newNote.state.isAdding && (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          No notes yet. Add notes to track progress and decisions.
        </p>
      )}
    </div>
  );
};
