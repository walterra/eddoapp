/**
 * Global flyout for todos opened via context (e.g., from audit sidebar).
 * Renders based on currentTodo from TodoFlyoutContext.
 */
import { type FC } from 'react';

import { useTodoFlyoutContext } from '../hooks/use_todo_flyout';

import { TodoFlyout } from './todo_flyout';

/**
 * Renders a TodoFlyout for the currently selected todo from context.
 * Use this for opening todos from places where the todo isn't rendered in a list
 * (e.g., audit sidebar, search results, notifications).
 */
export const GlobalTodoFlyout: FC = () => {
  const { currentTodo, openTodoId, closeFlyout } = useTodoFlyoutContext();

  if (!currentTodo || !openTodoId) {
    return null;
  }

  return <TodoFlyout onClose={closeFlyout} show={true} todo={currentTodo} />;
};
