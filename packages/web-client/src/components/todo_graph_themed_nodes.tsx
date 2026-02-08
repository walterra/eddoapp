/**
 * Themed node wrappers for React Flow.
 * These components bridge React Flow's node system with the theme context.
 */
import { Handle, Position } from '@xyflow/react';
import { type FC, useCallback } from 'react';

import { useTodoFlyoutContext } from '../hooks/use_todo_flyout';
import { useCurrentTheme } from './todo_graph/themes/context';
import type { FileNodeData } from './todo_graph_file_node';
import type { MetadataNodeData } from './todo_graph_metadata_node';
import type { TodoNodeData } from './todo_graph_node';
import type { UserNodeData } from './todo_graph_user_node';
import { useRowState } from './todo_table_row_actions';
import { RowActionsMenu } from './todo_table_row_actions_menu';

/** Centered handles for node connections */
const CenteredHandles: FC = () => (
  <>
    <Handle
      className="!top-1/2 !left-1/2 !h-1 !min-h-0 !w-1 !min-w-0 !-translate-x-1/2 !-translate-y-1/2 !border-0 !bg-transparent"
      id="center"
      position={Position.Top}
      type="source"
    />
    <Handle
      className="!top-1/2 !left-1/2 !h-1 !min-h-0 !w-1 !min-w-0 !-translate-x-1/2 !-translate-y-1/2 !border-0 !bg-transparent"
      id="center"
      position={Position.Top}
      type="target"
    />
  </>
);

/** Props from React Flow */
interface ReactFlowNodeProps<T> {
  data: T;
}

interface ActionableTodoMenuProps {
  todo: TodoNodeData['todo'];
}

/** Action menu shown on focused dependency graph nodes */
const ActionableTodoMenu: FC<ActionableTodoMenuProps> = ({ todo }) => {
  const { openTodoInEdit } = useTodoFlyoutContext();
  const rowState = useRowState(todo, 0);

  return (
    <div className="nodrag nopan pointer-events-auto absolute -top-2 -right-2 opacity-0 transition-opacity group-hover:opacity-100">
      <RowActionsMenu
        onDelete={rowState.handleDelete}
        onOpenEdit={() => openTodoInEdit(todo)}
        onToggleTimeTracking={rowState.handleToggleTimeTracking}
        timeTrackingLabel={rowState.thisButtonActive ? 'Stop time tracking' : 'Start time tracking'}
        todo={todo}
      />
    </div>
  );
};

/** Themed todo node - wraps theme's TodoNode and adds React Flow handles */
export const ThemedTodoNode: FC<ReactFlowNodeProps<TodoNodeData>> = ({ data }) => {
  const theme = useCurrentTheme();
  const { openTodo } = useTodoFlyoutContext();
  const handleClick = useCallback(() => openTodo(data.todo), [openTodo, data.todo]);

  return (
    <div className="group relative">
      <theme.nodes.TodoNode data={data} onClick={handleClick} />
      {data.showActions ? <ActionableTodoMenu todo={data.todo} /> : null}
      <CenteredHandles />
    </div>
  );
};

/** Themed file node */
export const ThemedFileNode: FC<ReactFlowNodeProps<FileNodeData>> = ({ data }) => {
  const theme = useCurrentTheme();

  return (
    <div className="relative">
      <theme.nodes.FileNode data={data} />
      <CenteredHandles />
    </div>
  );
};

/** Themed metadata node */
export const ThemedMetadataNode: FC<ReactFlowNodeProps<MetadataNodeData>> = ({ data }) => {
  const theme = useCurrentTheme();

  return (
    <div className="relative">
      <theme.nodes.MetadataNode data={data} />
      <CenteredHandles />
    </div>
  );
};

/** Themed user node */
export const ThemedUserNode: FC<ReactFlowNodeProps<UserNodeData>> = ({ data }) => {
  const theme = useCurrentTheme();

  return (
    <div className="relative">
      <theme.nodes.UserNode data={data} />
      <CenteredHandles />
    </div>
  );
};
