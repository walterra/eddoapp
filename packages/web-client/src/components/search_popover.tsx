/**
 * Search popover component with autocomplete and results.
 */
import { Popover } from 'flowbite-react';
import type { FC } from 'react';
import { HiOutlineSearch } from 'react-icons/hi';

import type { SearchResult } from '../hooks/use_search';
import { useSearchPopover } from '../hooks/use_search_popover';
import { FOCUS_RING, TRANSITION } from '../styles/interactive';
import { IncludeCompletedCheckbox, SearchInput, SearchResults } from './search_popover_content';

/** Props for SearchPopover */
export interface SearchPopoverProps {
  onSelectTodo: (todoId: string) => void;
}

/** Search popover content */
const PopoverContent: FC<{
  error: string | null;
  includeCompleted: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  isSearching: boolean;
  onClear: () => void;
  onIncludeCompletedChange: (checked: boolean) => void;
  onQueryChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSelect: (todoId: string) => void;
  query: string;
  results: SearchResult[];
}> = (props) => (
  <div className="flex max-h-[32rem] w-96 flex-col">
    <div className="border-b border-neutral-200 p-3 dark:border-neutral-700">
      <SearchInput
        inputRef={props.inputRef}
        onChange={props.onQueryChange}
        onClear={props.onClear}
        query={props.query}
      />
      <IncludeCompletedCheckbox
        checked={props.includeCompleted}
        onChange={props.onIncludeCompletedChange}
      />
    </div>
    <div className="flex-1 overflow-y-auto">
      <SearchResults
        error={props.error}
        isSearching={props.isSearching}
        onSelect={props.onSelect}
        query={props.query}
        results={props.results}
      />
    </div>
    {props.results.length > 0 && (
      <div className="border-t border-neutral-200 px-3 py-2 text-xs text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
        {props.results.length} result{props.results.length !== 1 ? 's' : ''} • Powered by ES|QL
      </div>
    )}
  </div>
);

/** Search trigger button */
const SearchButton: FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    aria-label="Search todos"
    className={`flex h-8 items-center gap-1.5 rounded-lg px-2 text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-700 ${TRANSITION} ${FOCUS_RING}`}
    onClick={onClick}
    title="Search todos (⌘K)"
    type="button"
  >
    <HiOutlineSearch className="h-5 w-5" />
    <span className="hidden text-xs sm:inline">Search</span>
    <kbd className="hidden items-center gap-0.5 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-500 sm:inline-flex dark:bg-neutral-700 dark:text-neutral-400">
      ⌘K
    </kbd>
  </button>
);

/** Search popover with input and results */
export const SearchPopover: FC<SearchPopoverProps> = ({ onSelectTodo }) => {
  const state = useSearchPopover(onSelectTodo);

  return (
    <Popover
      arrow={false}
      content={
        <PopoverContent
          error={state.error}
          includeCompleted={state.includeCompleted}
          inputRef={state.inputRef}
          isSearching={state.isSearching}
          onClear={state.handleClear}
          onIncludeCompletedChange={state.handleIncludeCompletedChange}
          onQueryChange={state.handleQueryChange}
          onSelect={state.handleSelect}
          query={state.query}
          results={state.results}
        />
      }
      onOpenChange={state.setIsOpen}
      open={state.isOpen}
      placement="bottom-start"
    >
      <SearchButton onClick={() => state.setIsOpen(true)} />
    </Popover>
  );
};
