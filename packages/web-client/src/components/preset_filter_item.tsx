/**
 * Individual preset item with edit/delete actions
 */
import { type FC, useState } from 'react';
import { MdBookmark, MdDelete, MdEdit } from 'react-icons/md';

import { DROPDOWN_ITEM, ICON_BUTTON, INPUT_BASE } from '../styles/interactive';

import type { PresetItemProps } from './preset_filter_types';

interface EditingInputProps {
  value: string;
  isLoading: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

const EditingInput: FC<EditingInputProps> = ({ value, isLoading, onChange, onSave, onCancel }) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') onSave();
    else if (e.key === 'Escape') onCancel();
  };

  return (
    <div className="flex items-center gap-2 px-2 py-1">
      <input
        autoFocus
        className={`flex-1 ${INPUT_BASE} py-0.5 text-sm`}
        disabled={isLoading}
        onBlur={onSave}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        type="text"
        value={value}
      />
    </div>
  );
};

interface PresetButtonProps {
  name: string;
  isFixed: boolean;
  isLoading: boolean;
  onApply: () => void;
}

const PresetButton: FC<PresetButtonProps> = ({ name, isFixed, isLoading, onApply }) => (
  <button
    className={`flex-1 ${DROPDOWN_ITEM} flex items-center gap-2`}
    disabled={isLoading}
    onClick={onApply}
    type="button"
  >
    <MdBookmark className="text-primary-500" size="1em" />
    <span className="truncate">{name}</span>
    {isFixed && <span className="ml-auto text-xs text-neutral-400">fixed</span>}
  </button>
);

interface ActionButtonsProps {
  isLoading: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

const ActionButtons: FC<ActionButtonsProps> = ({ isLoading, onEdit, onDelete }) => (
  <>
    <button
      className={`${ICON_BUTTON} opacity-0 group-hover:opacity-100`}
      disabled={isLoading}
      onClick={onEdit}
      title="Rename"
      type="button"
    >
      <MdEdit size="1em" />
    </button>
    <button
      className={`${ICON_BUTTON} opacity-0 group-hover:opacity-100 hover:text-red-500`}
      disabled={isLoading}
      onClick={onDelete}
      title="Delete"
      type="button"
    >
      <MdDelete size="1em" />
    </button>
  </>
);

export const PresetItem: FC<PresetItemProps> = ({
  preset,
  onApply,
  onRename,
  onDelete,
  isLoading,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(preset.name);

  const handleSave = () => {
    if (editName.trim() && editName.trim() !== preset.name) onRename(editName.trim());
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <EditingInput
        isLoading={isLoading}
        onCancel={() => {
          setEditName(preset.name);
          setIsEditing(false);
        }}
        onChange={setEditName}
        onSave={handleSave}
        value={editName}
      />
    );
  }

  return (
    <div className="group flex items-center gap-1">
      <PresetButton
        isFixed={preset.dateMode === 'fixed'}
        isLoading={isLoading}
        name={preset.name}
        onApply={onApply}
      />
      <ActionButtons isLoading={isLoading} onDelete={onDelete} onEdit={() => setIsEditing(true)} />
    </div>
  );
};
