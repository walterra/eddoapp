/**
 * Context for sharing highlighted todo ID between components.
 * Used for cross-component highlighting (e.g., sidebar hover → graph node).
 */
import { createContext, type FC, type ReactNode, useContext, useState } from 'react';

interface HighlightContextValue {
  /** Currently highlighted todo ID, or null if none */
  highlightedTodoId: string | null;
  /** Set the highlighted todo ID */
  setHighlightedTodoId: (id: string | null) => void;
}

const HighlightContext = createContext<HighlightContextValue | null>(null);

interface HighlightProviderProps {
  children: ReactNode;
}

/** Provider for highlight state */
export const HighlightProvider: FC<HighlightProviderProps> = ({ children }) => {
  const [highlightedTodoId, setHighlightedTodoId] = useState<string | null>(null);

  return (
    <HighlightContext.Provider value={{ highlightedTodoId, setHighlightedTodoId }}>
      {children}
    </HighlightContext.Provider>
  );
};

/** Hook to access highlight context */
export const useHighlightContext = (): HighlightContextValue => {
  const context = useContext(HighlightContext);
  if (!context) {
    throw new Error('useHighlightContext must be used within a HighlightProvider');
  }
  return context;
};
