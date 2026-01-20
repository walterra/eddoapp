/**
 * Hook for managing search popover state and handlers.
 */
import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useSearch } from './use_search';

/** Search popover state and handlers */
export interface SearchPopoverState {
  clearResults: () => void;
  error: string | null;
  handleClear: () => void;
  handleIncludeCompletedChange: (checked: boolean) => void;
  handleQueryChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSelect: (todoId: string) => void;
  includeCompleted: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  isOpen: boolean;
  isSearching: boolean;
  query: string;
  results: ReturnType<typeof useSearch>['results'];
  setIsOpen: Dispatch<SetStateAction<boolean>>;
}

/** Keyboard shortcut hook */
function useKeyboardShortcut(
  isOpen: boolean,
  setIsOpen: Dispatch<SetStateAction<boolean>>,
  inputRef: React.RefObject<HTMLInputElement | null>,
): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
      if (e.key === 'Escape' && isOpen) setIsOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, setIsOpen, inputRef]);
}

/** Focus on open hook */
function useFocusOnOpen(isOpen: boolean, inputRef: React.RefObject<HTMLInputElement | null>): void {
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 100);
  }, [isOpen, inputRef]);
}

/** Debounced search config */
interface DebouncedSearchConfig {
  clearResults: () => void;
  includeCompleted: boolean;
  searchTodos: ReturnType<typeof useSearch>['searchTodos'];
}

/** Creates a debounced search handler. */
function useDebouncedSearch(config: DebouncedSearchConfig) {
  const { clearResults, includeCompleted, searchTodos } = config;
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  return useCallback(
    (searchQuery: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (searchQuery.length < 2) {
        clearResults();
        return;
      }
      debounceRef.current = setTimeout(
        () => void searchTodos({ includeCompleted, limit: 15, query: searchQuery }),
        300,
      );
    },
    [searchTodos, clearResults, includeCompleted],
  );
}

/** Handler config */
interface HandlerConfig {
  clearResults: () => void;
  includeCompleted: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onSelectTodo: (todoId: string) => void;
  query: string;
  searchTodos: ReturnType<typeof useSearch>['searchTodos'];
  setIncludeCompleted: Dispatch<SetStateAction<boolean>>;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
  setQuery: Dispatch<SetStateAction<string>>;
}

/** Creates handlers for search popover. */
function useSearchHandlers(config: HandlerConfig) {
  const {
    clearResults,
    includeCompleted,
    inputRef,
    onSelectTodo,
    query,
    searchTodos,
    setIncludeCompleted,
    setIsOpen,
    setQuery,
  } = config;

  const handleSearch = useDebouncedSearch({ clearResults, includeCompleted, searchTodos });

  const handleQueryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setQuery(e.target.value);
      handleSearch(e.target.value);
    },
    [handleSearch, setQuery],
  );
  const handleSelect = useCallback(
    (todoId: string) => {
      onSelectTodo(todoId);
      setIsOpen(false);
      setQuery('');
      clearResults();
    },
    [onSelectTodo, clearResults, setIsOpen, setQuery],
  );
  const handleClear = useCallback(() => {
    setQuery('');
    clearResults();
    inputRef.current?.focus();
  }, [clearResults, setQuery, inputRef]);
  const handleIncludeCompletedChange = useCallback(
    (checked: boolean) => {
      setIncludeCompleted(checked);
      if (query.length >= 2) void searchTodos({ includeCompleted: checked, limit: 15, query });
    },
    [query, searchTodos, setIncludeCompleted],
  );

  return { handleClear, handleIncludeCompletedChange, handleQueryChange, handleSelect };
}

/** Hook for managing search popover state and handlers. */
export function useSearchPopover(onSelectTodo: (todoId: string) => void): SearchPopoverState {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [includeCompleted, setIncludeCompleted] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { clearResults, error, isSearching, results, searchTodos } = useSearch();

  useKeyboardShortcut(isOpen, setIsOpen, inputRef);
  useFocusOnOpen(isOpen, inputRef);

  const handlers = useSearchHandlers({
    clearResults,
    includeCompleted,
    inputRef,
    onSelectTodo,
    query,
    searchTodos,
    setIncludeCompleted,
    setIsOpen,
    setQuery,
  });

  return {
    clearResults,
    error,
    includeCompleted,
    inputRef,
    isOpen,
    isSearching,
    query,
    results,
    setIsOpen,
    ...handlers,
  };
}
