/**
 * Metadata field component for todo editing
 */
import { type Todo } from '@eddo/core-client';
import { Label, Textarea } from 'flowbite-react';
import { type FC, useState } from 'react';

interface TodoFieldProps {
  todo: Todo;
  onChange: (updater: (todo: Todo) => Todo) => void;
}

/**
 * Parses metadata from JSON string, returns undefined on error
 */
function parseMetadata(value: string): Record<string, string> | undefined {
  if (value.trim() === '') return undefined;
  try {
    const parsed = JSON.parse(value);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return undefined;
    // Validate all values are strings
    for (const v of Object.values(parsed)) {
      if (typeof v !== 'string') return undefined;
    }
    return parsed as Record<string, string>;
  } catch {
    return undefined;
  }
}

export const MetadataField: FC<TodoFieldProps> = ({ todo, onChange }) => {
  const [localValue, setLocalValue] = useState(
    todo.metadata ? JSON.stringify(todo.metadata, null, 2) : '',
  );
  const [isValid, setIsValid] = useState(true);

  const handleChange = (value: string) => {
    setLocalValue(value);
    if (value.trim() === '') {
      setIsValid(true);
      onChange((t) => ({ ...t, metadata: undefined }));
      return;
    }
    const parsed = parseMetadata(value);
    if (parsed !== undefined) {
      setIsValid(true);
      onChange((t) => ({ ...t, metadata: parsed }));
    } else {
      setIsValid(false);
    }
  };

  return (
    <div>
      <div className="mb-2 block">
        <Label htmlFor="eddoTodoMetadata">Metadata (JSON)</Label>
      </div>
      <Textarea
        aria-label="Metadata"
        className={!isValid ? 'border-red-500 dark:border-red-500' : ''}
        id="eddoTodoMetadata"
        onChange={(e) => handleChange(e.target.value)}
        placeholder='{"agent:worktree": "/path/to/worktree"}'
        rows={3}
        value={localValue}
      />
      {!isValid && (
        <p className="mt-1 text-sm text-red-500">
          Invalid JSON. Must be an object with string values.
        </p>
      )}
    </div>
  );
};
