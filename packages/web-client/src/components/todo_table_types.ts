/**
 * Shared types for todo table components.
 */
import { type Todo } from '@eddo/core-client';

import { type SubtaskCount } from '../hooks/use_parent_child';

/** Row data passed to table - todo plus computed values */
export interface TodoRowData {
  todo: Todo;
  duration: number;
  subtaskCount?: SubtaskCount;
}
