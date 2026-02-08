/**
 * Graph-based todo visualization using React Flow.
 * Supports full graph mode and focused dependency mode.
 */
import { type DatabaseError } from '@eddo/core-client';
import { type Edge, type Node, ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Spinner } from 'flowbite-react';
import { type FC, useEffect, useMemo, useRef, useState } from 'react';
import './todo_graph.css';

import { useForceLayout } from '../hooks/use_force_layout';
import { useHighlightedTodoId } from '../hooks/use_highlight_context';
import { useIsometricLayout } from '../hooks/use_isometric_layout';
import { usePouchDb } from '../pouch_db';
import { DatabaseErrorFallback } from './database_error_fallback';
import { DatabaseErrorMessage } from './database_error_message';
import { EmptyState } from './empty_state';
import type { CompletionStatus } from './status_filter';
import type { TimeRange } from './time_range_filter';
import { useDbInitialization } from './todo_board_state';
import { GraphThemeProvider, useGraphTheme } from './todo_graph/themes/context';
import { type TodoGraphDataProps, useGraphData } from './todo_graph_data';
import { GraphRenderer } from './todo_graph_renderer';

interface TodoGraphProps {
  currentDate: Date;
  selectedTags: string[];
  selectedContexts: string[];
  selectedStatus: CompletionStatus;
  selectedTimeRange: TimeRange;
  dependencyRootTodoId?: string | null;
  onBackToTable?: () => void;
}

interface TodoGraphContentProps {
  nodes: Node[];
  edges: Edge[];
  highlightedTodoId: string | null;
}

interface LayoutOptions {
  width: number;
  height: number;
}

/** Loading spinner shown while todos are loading */
const LoadingSpinner: FC = () => (
  <div
    aria-label="Loading todos"
    className="flex min-h-64 items-center justify-center bg-neutral-50 dark:bg-neutral-800"
    role="status"
  >
    <Spinner aria-label="Loading" size="lg" />
    <span className="ml-3 text-neutral-600 dark:text-neutral-400">Loading todos...</span>
  </div>
);

/** Full-page fallback for initial graph load errors */
const ErrorFallback: FC<{ error: DatabaseError; onRetry: () => void }> = ({ error, onRetry }) => (
  <div className="bg-neutral-50 p-8 dark:bg-neutral-800">
    <DatabaseErrorFallback error={error} onDismiss={onRetry} onRetry={onRetry} />
  </div>
);

/** Theme loading spinner */
const ThemeLoadingSpinner: FC = () => (
  <div className="flex h-full items-center justify-center">
    <div className="text-center">
      <Spinner aria-label="Loading theme" size="lg" />
      <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">Loading theme...</p>
    </div>
  </div>
);

/** Button used in dependency-focused graph mode to return to table */
const BackToTableButton: FC<{ onBackToTable: () => void }> = ({ onBackToTable }) => (
  <div className="px-4 pt-3">
    <button
      className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100 dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-600"
      onClick={onBackToTable}
      type="button"
    >
      ← Back to table
    </button>
  </div>
);

/** Force layout content */
const ForceLayoutContent: FC<{
  nodes: Node[];
  edges: Edge[];
  options: LayoutOptions;
  highlightedTodoId: string | null;
}> = ({ nodes, edges, options, highlightedTodoId }) => {
  const result = useForceLayout(nodes, edges, options);

  return (
    <GraphRenderer
      edges={result.edges}
      highlightedTodoId={highlightedTodoId}
      isLayouting={result.isLayouting}
      nodes={result.nodes}
    />
  );
};

/** Isometric layout content */
const IsometricLayoutContent: FC<{
  nodes: Node[];
  edges: Edge[];
  options: LayoutOptions;
  highlightedTodoId: string | null;
}> = ({ nodes, edges, options, highlightedTodoId }) => {
  const result = useIsometricLayout(nodes, edges, options);

  return (
    <GraphRenderer
      edges={result.edges}
      highlightedTodoId={highlightedTodoId}
      isLayouting={result.isLayouting}
      nodes={result.nodes}
      originalNodes={nodes}
      roadNetwork={result.roadNetwork}
    />
  );
};

/** Graph content with theme-aware layout */
const TodoGraphContent: FC<TodoGraphContentProps> = ({
  nodes: initialNodes,
  edges: initialEdges,
  highlightedTodoId,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const { theme, isLoading: isThemeLoading } = useGraphTheme();

  useEffect(() => {
    const updateDimensions = () => {
      if (!containerRef.current) {
        return;
      }

      const { width, height } = containerRef.current.getBoundingClientRect();
      if (width > 0 && height > 0) {
        setDimensions({ width, height });
      }
    };

    requestAnimationFrame(updateDimensions);
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  const layoutOptions = useMemo(() => dimensions ?? { width: 1600, height: 800 }, [dimensions]);
  const LayoutContent = theme?.layout === 'isometric' ? IsometricLayoutContent : ForceLayoutContent;

  return (
    <div className="h-[calc(100vh-200px)] w-full" ref={containerRef}>
      {isThemeLoading || !theme ? (
        <ThemeLoadingSpinner />
      ) : dimensions ? (
        <LayoutContent
          edges={initialEdges}
          highlightedTodoId={highlightedTodoId}
          nodes={initialNodes}
          options={layoutOptions}
        />
      ) : (
        <div className="flex h-full items-center justify-center">
          <span className="text-neutral-500">Loading...</span>
        </div>
      )}
    </div>
  );
};

/** Build graph data props from TodoGraph props */
const getGraphDataProps = (props: TodoGraphProps): TodoGraphDataProps => ({
  currentDate: props.currentDate,
  dependencyRootTodoId: props.dependencyRootTodoId,
  selectedContexts: props.selectedContexts,
  selectedStatus: props.selectedStatus,
  selectedTags: props.selectedTags,
  selectedTimeRange: props.selectedTimeRange,
});

/** Build empty state description based on mode and filters */
const getEmptyDescription = (
  dependencyRootTodoId: string | null | undefined,
  hasActiveFilters: boolean,
): string => {
  if (dependencyRootTodoId) {
    return 'No dependency graph found for this todo in the current filters and date range.';
  }

  if (hasActiveFilters) {
    return 'Try adjusting your filters or select a different time range.';
  }

  return 'Get started by adding your first todo above.';
};

/** Main TodoGraph component */
export const TodoGraph: FC<TodoGraphProps> = (props) => {
  const { safeDb, rawDb } = usePouchDb();
  const { error, setError, isInitialized } = useDbInitialization(safeDb, rawDb);
  const data = useGraphData(getGraphDataProps(props), isInitialized, error);
  const highlightedTodoId = useHighlightedTodoId();

  const handleRetry = () => {
    setError(null);
    data.todosQuery.refetch();
    data.activitiesQuery.refetch();
  };

  if (data.displayError && data.nodes.length === 0 && !data.isLoading) {
    return <ErrorFallback error={data.displayError} onRetry={handleRetry} />;
  }

  if (data.showLoadingSpinner) {
    return <LoadingSpinner />;
  }

  const emptyDescription = getEmptyDescription(props.dependencyRootTodoId, data.hasActiveFilters);

  return (
    <div className="bg-neutral-50 dark:bg-neutral-800">
      {props.onBackToTable ? <BackToTableButton onBackToTable={props.onBackToTable} /> : null}
      {data.displayError && data.nodes.length > 0 ? (
        <div className="px-4 pt-2">
          <DatabaseErrorMessage error={data.displayError} onDismiss={() => setError(null)} />
        </div>
      ) : null}
      {data.hasNoTodos ? (
        <EmptyState description={emptyDescription} title="No todos found" />
      ) : (
        <GraphThemeProvider>
          <ReactFlowProvider>
            <TodoGraphContent
              edges={data.edges}
              highlightedTodoId={highlightedTodoId}
              nodes={data.nodes}
            />
          </ReactFlowProvider>
        </GraphThemeProvider>
      )}
    </div>
  );
};
