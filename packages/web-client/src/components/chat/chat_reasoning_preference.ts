import { useEffect, useState } from 'react';

const REASONING_VISIBILITY_KEY = 'eddo.chat.showReasoning';

export type ReasoningPreferenceSetter = (value: boolean) => void;

export interface ReasoningPreferenceState {
  showReasoning: boolean;
  setShowReasoning: ReasoningPreferenceSetter;
}

function getStoredReasoningPreference(): boolean {
  try {
    const value = localStorage.getItem(REASONING_VISIBILITY_KEY);
    if (value === null) return true;
    return value === 'true';
  } catch {
    return true;
  }
}

function storeReasoningPreference(value: boolean): void {
  try {
    localStorage.setItem(REASONING_VISIBILITY_KEY, String(value));
  } catch {
    // Ignore localStorage errors
  }
}

export function useReasoningPreference(): ReasoningPreferenceState {
  const [showReasoning, setShowReasoning] = useState<boolean>(getStoredReasoningPreference);

  useEffect(() => {
    storeReasoningPreference(showReasoning);
  }, [showReasoning]);

  return { showReasoning, setShowReasoning };
}
