/**
 * Metadata field component for todo editing
 * Provides a key/value CRUD interface instead of raw JSON editing
 */
import { type Todo } from '@eddo/core-client';
import { Button, Label, TextInput } from 'flowbite-react';
import { type FC, useState } from 'react';
import { BiPlus, BiTrash } from 'react-icons/bi';

interface TodoFieldProps {
  todo: Todo;
  onChange: (updater: (todo: Todo) => Todo) => void;
}

interface MetadataEntry {
  key: string;
  value: string;
  isArray: boolean;
}

/** Common namespace prefixes for metadata keys */
const KEY_SUGGESTIONS = [
  'agent:session',
  'agent:model',
  'agent:cwd',
  'agent:branch',
  'agent:name',
  'agent:worktree',
  'github:labels',
  'github:milestone',
  'rss:feed_title',
  'rss:pub_date',
];

interface MetadataRowProps {
  entry: MetadataEntry;
  onKeyChange: (newKey: string) => void;
  onValueChange: (newValue: string) => void;
  onToggleArray: () => void;
  onDelete: () => void;
  isKeyDuplicate: boolean;
}

const MetadataRow: FC<MetadataRowProps> = ({
  entry,
  onKeyChange,
  onValueChange,
  onToggleArray,
  onDelete,
  isKeyDuplicate,
}) => (
  <div className="flex items-center gap-2">
    <div className="flex-1">
      <TextInput
        aria-label="Metadata key"
        className={isKeyDuplicate ? 'border-red-500' : ''}
        list="metadata-key-suggestions"
        onChange={(e) => onKeyChange(e.target.value)}
        placeholder="key (e.g., agent:name)"
        sizing="sm"
        type="text"
        value={entry.key}
      />
    </div>
    <div className="flex-1">
      <TextInput
        aria-label="Metadata value"
        onChange={(e) => onValueChange(e.target.value)}
        placeholder={entry.isArray ? 'comma-separated values' : 'value'}
        sizing="sm"
        type="text"
        value={entry.value}
      />
    </div>
    <Button
      aria-label={entry.isArray ? 'Switch to single value' : 'Switch to array'}
      color={entry.isArray ? 'purple' : 'gray'}
      onClick={onToggleArray}
      size="xs"
      title={entry.isArray ? 'Array mode (comma-separated)' : 'Single value mode'}
    >
      [ ]
    </Button>
    <Button aria-label="Delete metadata entry" color="red" onClick={onDelete} size="xs">
      <BiTrash size="1em" />
    </Button>
  </div>
);

interface AddMetadataRowProps {
  onAdd: (key: string, value: string) => void;
}

/** Hook for managing new entry input state */
function useNewEntryState() {
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  const reset = () => {
    setNewKey('');
    setNewValue('');
  };

  return { newKey, setNewKey, newValue, setNewValue, reset };
}

interface AddRowInputsProps {
  newKey: string;
  newValue: string;
  onKeyChange: (value: string) => void;
  onValueChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

const AddRowInputs: FC<AddRowInputsProps> = (props) => (
  <>
    <div className="flex-1">
      <TextInput
        aria-label="New metadata key"
        list="metadata-key-suggestions"
        onChange={(e) => props.onKeyChange(e.target.value)}
        onKeyDown={props.onKeyDown}
        placeholder="new key"
        sizing="sm"
        type="text"
        value={props.newKey}
      />
    </div>
    <div className="flex-1">
      <TextInput
        aria-label="New metadata value"
        onChange={(e) => props.onValueChange(e.target.value)}
        onKeyDown={props.onKeyDown}
        placeholder="new value"
        sizing="sm"
        type="text"
        value={props.newValue}
      />
    </div>
  </>
);

const AddMetadataRow: FC<AddMetadataRowProps> = ({ onAdd }) => {
  const { newKey, setNewKey, newValue, setNewValue, reset } = useNewEntryState();

  const handleAdd = () => {
    if (newKey.trim()) {
      onAdd(newKey.trim(), newValue);
      reset();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newKey.trim()) {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div className="flex items-center gap-2">
      <AddRowInputs
        newKey={newKey}
        newValue={newValue}
        onKeyChange={setNewKey}
        onKeyDown={handleKeyDown}
        onValueChange={setNewValue}
      />
      <Button
        aria-label="Add metadata entry"
        color="blue"
        disabled={!newKey.trim()}
        onClick={handleAdd}
        size="xs"
      >
        <BiPlus size="1em" />
      </Button>
    </div>
  );
};

/** Convert metadata object to array of entries for editing */
function metadataToEntries(
  metadata: Record<string, string | string[]> | undefined,
): MetadataEntry[] {
  if (!metadata) return [];
  return Object.entries(metadata).map(([key, value]) => {
    if (Array.isArray(value)) {
      return { key, value: value.join(', '), isArray: true };
    }
    return { key, value, isArray: false };
  });
}

/** Convert entries array back to metadata object */
function entriesToMetadata(
  entries: MetadataEntry[],
): Record<string, string | string[]> | undefined {
  const validEntries = entries.filter((e) => e.key.trim() !== '');
  if (validEntries.length === 0) return undefined;
  return Object.fromEntries(
    validEntries.map((e) => {
      if (e.isArray) {
        // Split by comma and trim each value, filter empty strings
        const arrayValue = e.value
          .split(',')
          .map((v) => v.trim())
          .filter((v) => v !== '');
        return [e.key, arrayValue.length > 0 ? arrayValue : ['']];
      }
      return [e.key, e.value];
    }),
  );
}

/** Find duplicate keys in entries */
function findDuplicateKeys(entries: MetadataEntry[]): Set<string> {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const entry of entries) {
    const key = entry.key.trim();
    if (key && seen.has(key)) {
      duplicates.add(key);
    }
    seen.add(key);
  }
  return duplicates;
}

interface MetadataHandlers {
  handleKeyChange: (index: number, newKey: string) => void;
  handleValueChange: (index: number, newValue: string) => void;
  handleToggleArray: (index: number) => void;
  handleDelete: (index: number) => void;
  handleAdd: (key: string, value: string) => void;
}

/** Hook for metadata entry CRUD operations */
function useMetadataHandlers(
  entries: MetadataEntry[],
  setEntries: React.Dispatch<React.SetStateAction<MetadataEntry[]>>,
  onChange: TodoFieldProps['onChange'],
): MetadataHandlers {
  const updateEntries = (newEntries: MetadataEntry[]) => {
    setEntries(newEntries);
    onChange((t) => ({ ...t, metadata: entriesToMetadata(newEntries) }));
  };

  return {
    handleKeyChange: (index: number, newKey: string) => {
      const newEntries = [...entries];
      newEntries[index] = { ...newEntries[index], key: newKey };
      updateEntries(newEntries);
    },
    handleValueChange: (index: number, newValue: string) => {
      const newEntries = [...entries];
      newEntries[index] = { ...newEntries[index], value: newValue };
      updateEntries(newEntries);
    },
    handleToggleArray: (index: number) => {
      const newEntries = [...entries];
      newEntries[index] = { ...newEntries[index], isArray: !newEntries[index].isArray };
      updateEntries(newEntries);
    },
    handleDelete: (index: number) => {
      updateEntries(entries.filter((_, i) => i !== index));
    },
    handleAdd: (key: string, value: string) => {
      updateEntries([...entries, { key, value, isArray: false }]);
    },
  };
}

interface MetadataListProps {
  entries: MetadataEntry[];
  duplicateKeys: Set<string>;
  handlers: MetadataHandlers;
}

const MetadataList: FC<MetadataListProps> = ({ entries, duplicateKeys, handlers }) => (
  <div className="space-y-2">
    {entries.map((entry, index) => (
      <MetadataRow
        entry={entry}
        isKeyDuplicate={duplicateKeys.has(entry.key.trim())}
        key={index}
        onDelete={() => handlers.handleDelete(index)}
        onKeyChange={(newKey) => handlers.handleKeyChange(index, newKey)}
        onToggleArray={() => handlers.handleToggleArray(index)}
        onValueChange={(newValue) => handlers.handleValueChange(index, newValue)}
      />
    ))}
    <AddMetadataRow onAdd={handlers.handleAdd} />
  </div>
);

/** Datalist for key suggestions - rendered once and shared */
const KeySuggestionsDatalist: FC = () => (
  <datalist id="metadata-key-suggestions">
    {KEY_SUGGESTIONS.map((key) => (
      <option key={key} value={key} />
    ))}
  </datalist>
);

export const MetadataField: FC<TodoFieldProps> = ({ todo, onChange }) => {
  const [entries, setEntries] = useState<MetadataEntry[]>(() => metadataToEntries(todo.metadata));
  const duplicateKeys = findDuplicateKeys(entries);
  const handlers = useMetadataHandlers(entries, setEntries, onChange);

  return (
    <div>
      <div className="mb-2 block">
        <Label>Metadata {entries.length > 0 && `(${entries.length})`}</Label>
      </div>
      <MetadataList duplicateKeys={duplicateKeys} entries={entries} handlers={handlers} />
      {duplicateKeys.size > 0 && (
        <p className="mt-1 text-sm text-red-500">
          Duplicate keys detected. Each key must be unique.
        </p>
      )}
      <KeySuggestionsDatalist />
    </div>
  );
};
