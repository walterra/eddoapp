/**
 * Todo picker popover with search and autocomplete
 */
import { TextInput } from 'flowbite-react';
import { type FC, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useFloatingPosition } from '../hooks/use_floating_position';
import { useSearch } from '../hooks/use_search';
import { TRANSITION_FAST } from '../styles/interactive';
import { SearchResults } from './search_popover_content';

interface TodoPickerPopoverProps {
  anchorRef: React.RefObject<HTMLElement | null>;
  excludeIds?: string[];
  isOpen: boolean;
  onClose: () => void;
  onSelect: (todoId: string) => void;
}

interface PopoverState {
  floatingStyles: object;
  menuRef: React.RefObject<HTMLDivElement | null>;
  query: string;
  setFloatingRef: (node: HTMLDivElement | null) => void;
  setQuery: (value: string) => void;
}

const POPOVER_STYLES =
  'z-50 w-96 rounded-lg border border-neutral-200 bg-white p-3 shadow-lg dark:border-neutral-600 dark:bg-neutral-800';

const usePopoverDismiss = (
  menuRef: React.RefObject<HTMLDivElement | null>,
  onClose: () => void,
): void => {
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [menuRef, onClose]);
};

const useAnchorReference = (
  anchorRef: React.RefObject<HTMLElement | null>,
  isOpen: boolean,
  setReference: (node: HTMLElement | null) => void,
): void => {
  useEffect(() => {
    if (!isOpen) return;
    if (anchorRef.current) setReference(anchorRef.current);
  }, [anchorRef, isOpen, setReference]);
};

const useSearchQuery = (
  isOpen: boolean,
  query: string,
  searchTodos: (params: { query: string; limit: number; includeCompleted: boolean }) => void,
  clearResults: () => void,
): void => {
  useEffect(() => {
    if (!isOpen) return;
    if (query.length < 2) {
      clearResults();
      return;
    }

    const timeout = setTimeout(() => {
      void searchTodos({ query, limit: 10, includeCompleted: true });
    }, 200);

    return () => clearTimeout(timeout);
  }, [clearResults, isOpen, query, searchTodos]);
};

const usePopoverState = (
  anchorRef: React.RefObject<HTMLElement | null>,
  isOpen: boolean,
  onClose: () => void,
): PopoverState => {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState('');
  const { refs, floatingStyles } = useFloatingPosition({
    placement: 'bottom-start',
    open: isOpen,
  });

  useAnchorReference(anchorRef, isOpen, refs.setReference);
  usePopoverDismiss(menuRef, onClose);

  return {
    floatingStyles,
    menuRef,
    query,
    setFloatingRef: refs.setFloating,
    setQuery,
  };
};

const useQueryReset = (isOpen: boolean, resetQuery: () => void, clearResults: () => void): void => {
  useEffect(() => {
    if (!isOpen) {
      resetQuery();
      clearResults();
    }
  }, [clearResults, isOpen, resetQuery]);
};

const getFilteredResults = (
  results: { todoId: string }[],
  excludeIds?: string[],
): { todoId: string }[] => {
  if (!excludeIds || excludeIds.length === 0) return results;
  return results.filter((result) => !excludeIds.includes(result.todoId));
};

interface TodoPickerContentProps {
  error: string | null;
  floatingStyles: object;
  isSearching: boolean;
  menuRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
  onSelect: (todoId: string) => void;
  query: string;
  results: { todoId: string }[];
  setFloatingRef: (node: HTMLDivElement | null) => void;
  setQuery: (value: string) => void;
}

const TodoPickerContent: FC<TodoPickerContentProps> = ({
  error,
  floatingStyles,
  isSearching,
  menuRef,
  onClose,
  onSelect,
  query,
  results,
  setFloatingRef,
  setQuery,
}) => (
  <div
    className={`${POPOVER_STYLES} ${TRANSITION_FAST}`}
    ref={(node) => {
      menuRef.current = node;
      setFloatingRef(node);
    }}
    style={floatingStyles as React.CSSProperties}
  >
    <div className="flex flex-col gap-2">
      <div className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Search todos</div>
      <TextInput
        autoFocus
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Type to search..."
        sizing="sm"
        type="text"
        value={query}
      />
      <SearchResults
        error={error}
        isSearching={isSearching}
        onSelect={(todoId) => {
          onSelect(todoId);
          onClose();
        }}
        query={query}
        results={results}
      />
    </div>
  </div>
);

export const TodoPickerPopover: FC<TodoPickerPopoverProps> = ({
  anchorRef,
  excludeIds,
  isOpen,
  onClose,
  onSelect,
}) => {
  const { results, isSearching, error, searchTodos, clearResults } = useSearch();
  const { floatingStyles, menuRef, query, setFloatingRef, setQuery } = usePopoverState(
    anchorRef,
    isOpen,
    onClose,
  );
  useSearchQuery(isOpen, query, searchTodos, clearResults);
  useQueryReset(isOpen, () => setQuery(''), clearResults);

  const filteredResults = useMemo(
    () => getFilteredResults(results, excludeIds),
    [excludeIds, results],
  );

  if (!isOpen) {
    return null;
  }

  return createPortal(
    <TodoPickerContent
      error={error}
      floatingStyles={floatingStyles}
      isSearching={isSearching}
      menuRef={menuRef}
      onClose={onClose}
      onSelect={onSelect}
      query={query}
      results={filteredResults}
      setFloatingRef={setFloatingRef}
      setQuery={setQuery}
    />,
    document.body,
  );
};
