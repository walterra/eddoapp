/**
 * Search popover content component.
 */
import { Spinner, TextInput } from 'flowbite-react';
import type { FC, RefObject } from 'react';
import { HiOutlineSearch, HiOutlineX } from 'react-icons/hi';

import type { SearchResult } from '../hooks/use_search';
import { FOCUS_RING, TRANSITION } from '../styles/interactive';

/** Props for search result item */
interface SearchResultItemProps {
  result: SearchResult;
  onSelect: (todoId: string) => void;
}

/** Individual search result item */
const SearchResultItem: FC<SearchResultItemProps> = ({ onSelect, result }) => {
  const isCompleted = result.completed !== null;

  return (
    <button
      className={`w-full px-3 py-2 text-left hover:bg-neutral-100 dark:hover:bg-neutral-700 ${TRANSITION} ${FOCUS_RING} rounded`}
      onClick={() => onSelect(result.todoId)}
      type="button"
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div
            className={`truncate text-sm font-medium ${
              isCompleted
                ? 'text-neutral-500 line-through dark:text-neutral-400'
                : 'text-neutral-900 dark:text-white'
            }`}
          >
            {result.title}
          </div>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">{result.context}</span>
            {result.tags && Array.isArray(result.tags) && result.tags.length > 0 && (
              <span className="text-primary-600 dark:text-primary-400 text-xs">
                {result.tags.slice(0, 2).join(', ')}
                {result.tags.length > 2 && '...'}
              </span>
            )}
          </div>
        </div>
        <div className="text-xs whitespace-nowrap text-neutral-400 dark:text-neutral-500">
          {result._score.toFixed(1)}
        </div>
      </div>
    </button>
  );
};

/** Renders the search input field with clear button */
export const SearchInput: FC<{
  inputRef: RefObject<HTMLInputElement | null>;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
  query: string;
}> = ({ inputRef, onChange, onClear, query }) => (
  <div className="relative">
    <TextInput
      icon={HiOutlineSearch}
      onChange={onChange}
      placeholder="Search todos... (⌘K)"
      ref={inputRef}
      sizing="sm"
      value={query}
    />
    {query && (
      <button
        className="absolute top-1/2 right-2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
        onClick={onClear}
        type="button"
      >
        <HiOutlineX className="h-4 w-4" />
      </button>
    )}
  </div>
);

/** Renders the include completed checkbox */
export const IncludeCompletedCheckbox: FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
}> = ({ checked, onChange }) => (
  <label className="mt-2 flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
    <input
      checked={checked}
      className="rounded border-neutral-300 dark:border-neutral-600"
      onChange={(e) => onChange(e.target.checked)}
      type="checkbox"
    />
    Include completed
  </label>
);

/** Renders the query syntax help text */
const QuerySyntaxHelp: FC = () => (
  <div className="px-3 py-4 text-sm text-neutral-500 dark:text-neutral-400">
    <div className="mb-3 text-center">Type at least 2 characters to search</div>
    <div className="space-y-1 border-t border-neutral-200 pt-3 text-xs dark:border-neutral-700">
      <div className="font-medium text-neutral-600 dark:text-neutral-300">Query syntax:</div>
      <div>
        <code className="text-primary-600 dark:text-primary-400">tag:value</code> - Filter by tag
      </div>
      <div>
        <code className="text-primary-600 dark:text-primary-400">context:value</code> - Filter by
        context
      </div>
      <div>
        <code className="text-primary-600 dark:text-primary-400">completed:false</code> - Only
        pending
      </div>
      <div>
        <code className="text-primary-600 dark:text-primary-400">due:overdue</code> - Overdue todos
      </div>
    </div>
  </div>
);

/** Renders the search results list or status messages */
export const SearchResults: FC<{
  error: string | null;
  isSearching: boolean;
  onSelect: (todoId: string) => void;
  query: string;
  results: SearchResult[];
}> = ({ error, isSearching, onSelect, query, results }) => {
  if (isSearching) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner size="md" />
      </div>
    );
  }

  if (error) {
    return <div className="px-3 py-4 text-sm text-red-600 dark:text-red-400">{error}</div>;
  }

  if (results.length === 0 && query.length >= 2) {
    return (
      <div className="px-3 py-8 text-center text-sm text-neutral-500 dark:text-neutral-400">
        No results found for &quot;{query}&quot;
      </div>
    );
  }

  if (query.length < 2) {
    return <QuerySyntaxHelp />;
  }

  return (
    <div className="py-2">
      {results.map((result) => (
        <SearchResultItem key={result.todoId} onSelect={onSelect} result={result} />
      ))}
    </div>
  );
};
