import { type FC, useState } from 'react';
import { MdFilterList } from 'react-icons/md';

import { CLEAR_BUTTON, getDropdownItemClass, getFilterButtonClass } from '../styles/interactive';
import { TagDisplay } from './tag_display';

interface TagFilterProps {
  availableTags: string[];
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
}

interface FilterHeaderProps {
  selectedCount: number;
  onClearAll: () => void;
}

const FilterHeader: FC<FilterHeaderProps> = ({ selectedCount, onClearAll }) => (
  <div className="mb-3 flex items-center justify-between">
    <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Tags</h3>
    {selectedCount > 0 && (
      <button className={CLEAR_BUTTON} onClick={onClearAll} type="button">
        Clear all
      </button>
    )}
  </div>
);

interface SelectedTagsDisplayProps {
  selectedTags: string[];
}

const SelectedTagsDisplay: FC<SelectedTagsDisplayProps> = ({ selectedTags }) =>
  selectedTags.length > 0 ? (
    <div className="mb-3">
      <div className="mb-1 text-xs text-gray-500 dark:text-gray-400">Selected:</div>
      <TagDisplay size="xs" tags={selectedTags} />
    </div>
  ) : null;

interface TagListProps {
  tags: string[];
  selectedTags: string[];
  onToggle: (tag: string) => void;
}

const TagList: FC<TagListProps> = ({ tags, selectedTags, onToggle }) => (
  <div className="space-y-1">
    {tags.map((tag) => (
      <button
        className={getDropdownItemClass(selectedTags.includes(tag))}
        key={tag}
        onClick={() => onToggle(tag)}
        type="button"
      >
        {tag}
      </button>
    ))}
  </div>
);

export const TagFilter: FC<TagFilterProps> = ({ availableTags, selectedTags, onTagsChange }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (availableTags.length === 0) return null;

  const toggleTag = (tag: string) => {
    onTagsChange(
      selectedTags.includes(tag) ? selectedTags.filter((t) => t !== tag) : [...selectedTags, tag],
    );
  };

  return (
    <div className="relative">
      <button
        className={getFilterButtonClass(selectedTags.length > 0)}
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        <MdFilterList size="1.2em" />
        <span>Tags</span>
        {selectedTags.length > 0 && (
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800 dark:bg-blue-800 dark:text-blue-200">
            {selectedTags.length}
          </span>
        )}
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full z-20 mt-1 max-h-96 w-64 overflow-y-auto rounded-lg border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-600 dark:bg-gray-800">
            <FilterHeader onClearAll={() => onTagsChange([])} selectedCount={selectedTags.length} />
            <SelectedTagsDisplay selectedTags={selectedTags} />
            <TagList onToggle={toggleTag} selectedTags={selectedTags} tags={availableTags} />
          </div>
        </>
      )}
    </div>
  );
};
