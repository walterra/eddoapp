import { type FC, useState } from 'react';
import { MdFilterList } from 'react-icons/md';

interface EddoContextFilterProps {
  availableContexts: string[];
  selectedContexts: string[];
  onContextsChange: (contexts: string[]) => void;
}

const getButtonClassName = (hasSelected: boolean): string =>
  hasSelected
    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
    : 'border-gray-300 bg-white text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300';

const getOptionClassName = (isSelected: boolean): string =>
  isSelected
    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
    : 'text-gray-700 dark:text-gray-300';

interface FilterHeaderProps {
  selectedCount: number;
  onClearAll: () => void;
}

const FilterHeader: FC<FilterHeaderProps> = ({ selectedCount, onClearAll }) => (
  <div className="mb-3 flex items-center justify-between">
    <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Context</h3>
    {selectedCount > 0 && (
      <button
        className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
        onClick={onClearAll}
        type="button"
      >
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
      <div className="mb-1 text-xs text-gray-500 dark:text-gray-400">Selected:</div>
      <div className="flex flex-wrap gap-1">
        {selectedContexts.map((context) => (
          <span
            className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-800 dark:bg-blue-900 dark:text-blue-200"
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
        className={`block w-full rounded px-2 py-1 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${getOptionClassName(selectedContexts.includes(context))}`}
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
        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 ${getButtonClassName(selectedContexts.length > 0)}`}
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        <MdFilterList size="1.2em" />
        <span>Context</span>
        {selectedContexts.length > 0 && (
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800 dark:bg-blue-800 dark:text-blue-200">
            {selectedContexts.length}
          </span>
        )}
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full z-20 mt-1 max-h-96 w-64 overflow-y-auto rounded-lg border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-600 dark:bg-gray-800">
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
