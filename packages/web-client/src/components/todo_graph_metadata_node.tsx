/**
 * Minimal metadata node component for the graph view.
 * Shows as a colored dot with details on hover.
 * Edges connect to center of node.
 */
import { Handle, Position } from '@xyflow/react';
import { type FC } from 'react';

export interface MetadataNodeData {
  metadataKey: string;
  metadataValue: string;
  todoCount: number;
}

/** Get short label for tooltip */
const getKeyLabel = (key: string): string => {
  const labels: Record<string, string> = {
    'agent:session': 'Session',
    'agent:model': 'Model',
    'agent:cwd': 'Directory',
    'agent:branch': 'Branch',
    'agent:name': 'Agent',
  };
  return labels[key] || key;
};

interface MetadataNodeProps {
  data: MetadataNodeData;
}

/** Minimal dot node for metadata - hover for details */
export const MetadataNode: FC<MetadataNodeProps> = ({ data }) => {
  const { metadataKey, metadataValue, todoCount } = data;
  const label = getKeyLabel(metadataKey);
  const tooltip = `${label}: ${metadataValue}\n${todoCount} todos`;

  return (
    <div
      className="h-6 w-6 cursor-pointer rounded-full border-2 border-purple-400 bg-purple-500 shadow-sm transition-transform hover:scale-150"
      title={tooltip}
    >
      {/* Single centered handle for all connections */}
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
    </div>
  );
};
