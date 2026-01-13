/**
 * Context for sharing highlighted todo ID between components.
 * Used for cross-component highlighting (e.g., sidebar hover → graph node).
 *
 * Split into two contexts to prevent unnecessary re-renders:
 * - StateContext: provides current highlightedTodoId (changes trigger re-renders)
 * - DispatchContext: provides setHighlightedTodoId (stable reference, no re-renders)
 */
import {
  createContext,
  type FC,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

type SetHighlightedTodoId = (id: string | null) => void;

/** Context for reading highlighted state - consumers re-render on change */
const HighlightStateContext = createContext<string | null>(null);

/** Context for setting highlighted state - stable reference, no re-renders */
const HighlightDispatchContext = createContext<SetHighlightedTodoId | null>(null);

interface HighlightProviderProps {
  children: ReactNode;
}

/** Provider for highlight state */
export const HighlightProvider: FC<HighlightProviderProps> = ({ children }) => {
  const [highlightedTodoId, setHighlightedTodoId] = useState<string | null>(null);

  // Stable callback reference - never changes
  const setHighlight = useCallback((id: string | null) => setHighlightedTodoId(id), []);

  return (
    <HighlightDispatchContext.Provider value={setHighlight}>
      <HighlightStateContext.Provider value={highlightedTodoId}>
        {children}
      </HighlightStateContext.Provider>
    </HighlightDispatchContext.Provider>
  );
};

/** Hook to read highlighted todo ID - will re-render when it changes */
export const useHighlightedTodoId = (): string | null => {
  return useContext(HighlightStateContext);
};

/** Hook to get setter function - stable reference, won't cause re-renders */
export const useSetHighlightedTodoId = (): SetHighlightedTodoId => {
  const dispatch = useContext(HighlightDispatchContext);
  if (!dispatch) {
    throw new Error('useSetHighlightedTodoId must be used within a HighlightProvider');
  }
  return dispatch;
};

/** Legacy interface for backward compatibility */
interface HighlightContextValue {
  /** Currently highlighted todo ID, or null if none */
  highlightedTodoId: string | null;
  /** Set the highlighted todo ID */
  setHighlightedTodoId: SetHighlightedTodoId;
}

/**
 * Combined hook for both reading and setting.
 * Note: prefer useHighlightedTodoId or useSetHighlightedTodoId for better performance.
 * @deprecated Use useHighlightedTodoId or useSetHighlightedTodoId instead
 */
export const useHighlightContext = (): HighlightContextValue => {
  const highlightedTodoId = useHighlightedTodoId();
  const setHighlightedTodoId = useSetHighlightedTodoId();

  return useMemo(
    () => ({ highlightedTodoId, setHighlightedTodoId }),
    [highlightedTodoId, setHighlightedTodoId],
  );
};
