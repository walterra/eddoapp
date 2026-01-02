import { type FC, useState } from 'react';
import { MdFilterList } from 'react-icons/md';

import { CLEAR_BUTTON, getDropdownItemClass, getFilterButtonClass } from '../styles/interactive';

interface EddoContextFilterProps {
  availableContexts: string[];
  selectedContexts: string[];
  onContextsChange: (contexts: string[]) => void;
}

interface FilterHeaderProps {
  selectedCount: number;
  onClearAll: () => void;
}

const FilterHeader: FC<FilterHeaderProps> = ({ selectedCount, onClearAll }) => (
  <div className="mb-3 flex items-center justify-between">
    <h3 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Context</h3>
    {selectedCount > 0 && (
      <button className={CLEAR_BUTTON} onClick={onClearAll} type="button">
        Clear all
      </button>
    )}
  </div>
);

interface SelectedContextsDisplayProps {
  selectedContexts: string[];
}

const SelectedContextsDisplay: FC<SelectedContextsDisplayProps> = ({ selectedContexts }) =>
  selectedContexts.length > 0 ? (
    <div className="mb-3">
      <div className="mb-1 text-xs text-neutral-500 dark:text-neutral-400">Selected:</div>
      <div className="flex flex-wrap gap-1">
        {selectedContexts.map((context) => (
          <span
            className="bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200 rounded px-2 py-0.5 text-xs"
            key={context}
          >
            {context}
          </span>
        ))}
      </div>
    </div>
  ) : null;

interface ContextListProps {
  contexts: string[];
  selectedContexts: string[];
  onToggle: (context: string) => void;
}

const ContextList: FC<ContextListProps> = ({ contexts, selectedContexts, onToggle }) => (
  <div className="space-y-1">
    {contexts.map((context) => (
      <button
        className={getDropdownItemClass(selectedContexts.includes(context))}
        key={context}
        onClick={() => onToggle(context)}
        type="button"
      >
        {context}
      </button>
    ))}
  </div>
);

export const EddoContextFilter: FC<EddoContextFilterProps> = ({
  availableContexts,
  selectedContexts,
  onContextsChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  if (availableContexts.length === 0) return null;

  const toggleContext = (context: string) => {
    onContextsChange(
      selectedContexts.includes(context)
        ? selectedContexts.filter((c) => c !== context)
        : [...selectedContexts, context],
    );
  };

  return (
    <div className="relative">
      <button
        className={getFilterButtonClass(selectedContexts.length > 0)}
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        <MdFilterList size="1.2em" />
        <span>Context</span>
        {selectedContexts.length > 0 && (
          <span className="bg-primary-100 text-primary-800 dark:bg-primary-800 dark:text-primary-200 rounded-full px-2 py-0.5 text-xs">
            {selectedContexts.length}
          </span>
        )}
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full z-20 mt-1 max-h-96 w-64 overflow-y-auto rounded-lg border border-neutral-200 bg-white p-3 shadow-lg dark:border-neutral-600 dark:bg-neutral-800">
            <FilterHeader
              onClearAll={() => onContextsChange([])}
              selectedCount={selectedContexts.length}
            />
            <SelectedContextsDisplay selectedContexts={selectedContexts} />
            <ContextList
              contexts={availableContexts}
              onToggle={toggleContext}
              selectedContexts={selectedContexts}
            />
          </div>
        </>
      )}
    </div>
  );
};
