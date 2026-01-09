/**
 * Custom node component for metadata grouping in the graph view.
 * Displays a metadata key-value pair that links to related todos.
 */
import { Handle, Position } from '@xyflow/react';
import { type FC } from 'react';
import { HiOutlineTag } from 'react-icons/hi';

export interface MetadataNodeData {
  metadataKey: string;
  metadataValue: string;
  todoCount: number;
}

/** Get display label for metadata key */
const getKeyLabel = (key: string): string => {
  const labels: Record<string, string> = {
    'agent:session': 'Session',
    'agent:model': 'Model',
    'agent:cwd': 'Directory',
    'agent:branch': 'Branch',
    'agent:name': 'Agent',
  };
  return labels[key] || key.replace('agent:', '').replace(':', ' ');
};

/** Truncate long values for display */
const truncateValue = (value: string, maxLength: number = 20): string => {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}...`;
};

interface MetadataNodeProps {
  data: MetadataNodeData;
}

/** Metadata node component for React Flow */
export const MetadataNode: FC<MetadataNodeProps> = ({ data }) => {
  const { metadataKey, metadataValue, todoCount } = data;
  const label = getKeyLabel(metadataKey);
  const displayValue = truncateValue(metadataValue);

  return (
    <div className="max-w-[200px] min-w-[160px] rounded-lg border-2 border-purple-300 bg-purple-50 px-3 py-2 shadow-md dark:border-purple-700 dark:bg-purple-900/30">
      {/* Source handle for outgoing edges (to todos) */}
      <Handle
        className="!bg-purple-400 dark:!bg-purple-500"
        position={Position.Bottom}
        type="source"
      />

      {/* Icon and label */}
      <div className="flex items-center gap-2">
        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-purple-200 text-purple-700 dark:bg-purple-800 dark:text-purple-300">
          <HiOutlineTag className="h-3 w-3" />
        </div>
        <span className="text-xs font-semibold text-purple-700 uppercase dark:text-purple-300">
          {label}
        </span>
      </div>

      {/* Value */}
      <div
        className="mt-1 truncate text-sm font-medium text-purple-900 dark:text-purple-100"
        title={metadataValue}
      >
        {displayValue}
      </div>

      {/* Todo count */}
      <div className="mt-1 text-xs text-purple-600 dark:text-purple-400">
        {todoCount} {todoCount === 1 ? 'todo' : 'todos'}
      </div>
    </div>
  );
};
