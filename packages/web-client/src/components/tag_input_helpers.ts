/**
 * Helper functions for TagInput component
 */
import { useEffect, useRef, useState } from 'react';

export interface TagInputState {
  inputValue: string;
  showSuggestions: boolean;
  selectedSuggestionIndex: number;
}

export const INITIAL_TAG_INPUT_STATE: TagInputState = {
  inputValue: '',
  showSuggestions: false,
  selectedSuggestionIndex: -1,
};

/** Filter suggestions based on input value and existing tags */
export function filterSuggestions(
  suggestions: string[],
  inputValue: string,
  existingTags: string[],
): string[] {
  return suggestions.filter(
    (suggestion) =>
      suggestion.toLowerCase().includes(inputValue.toLowerCase()) &&
      !existingTags.includes(suggestion),
  );
}

/** Handle keyboard navigation in suggestions */
export function handleNavigationKey(
  key: 'ArrowDown' | 'ArrowUp',
  currentIndex: number,
  totalItems: number,
): number {
  if (key === 'ArrowDown') {
    return currentIndex < totalItems - 1 ? currentIndex + 1 : 0;
  }
  return currentIndex > 0 ? currentIndex - 1 : totalItems - 1;
}

/** Hook for click outside detection */
export function useClickOutside(
  inputRef: React.RefObject<HTMLInputElement | null>,
  suggestionsRef: React.RefObject<HTMLDivElement | null>,
  onClickOutside: () => void,
): void {
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        inputRef.current &&
        !inputRef.current.contains(event.target as Node) &&
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node)
      ) {
        onClickOutside();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [inputRef, suggestionsRef, onClickOutside]);
}

/** Hook for tag input state management */
export function useTagInputState() {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const reset = () => {
    setInputValue('');
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
  };

  return {
    inputValue,
    setInputValue,
    showSuggestions,
    setShowSuggestions,
    selectedSuggestionIndex,
    setSelectedSuggestionIndex,
    inputRef,
    suggestionsRef,
    reset,
  };
}
