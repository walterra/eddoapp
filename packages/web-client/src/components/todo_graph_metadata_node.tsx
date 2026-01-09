/**
 * Icon-based metadata node component for the graph view.
 * Different icons for different metadata types.
 */
import { Handle, Position } from '@xyflow/react';
import { type FC } from 'react';
import { BiGitBranch } from 'react-icons/bi';
import { HiDesktopComputer } from 'react-icons/hi';
import { RiRobot2Fill } from 'react-icons/ri';

export interface MetadataNodeData {
  metadataKey: string;
  metadataValue: string;
  todoCount: number;
}

/** Get icon and color for metadata type */
const getMetadataStyle = (
  key: string,
): { Icon: typeof RiRobot2Fill; bgColor: string; borderColor: string } => {
  switch (key) {
    case 'agent:session':
      return {
        Icon: RiRobot2Fill,
        bgColor: 'bg-violet-600',
        borderColor: 'border-violet-500',
      };
    case 'agent:branch':
      return {
        Icon: BiGitBranch,
        bgColor: 'bg-amber-600',
        borderColor: 'border-amber-500',
      };
    case 'agent:name':
      return {
        Icon: RiRobot2Fill,
        bgColor: 'bg-violet-600',
        borderColor: 'border-violet-500',
      };
    case 'agent:cwd':
      return {
        Icon: HiDesktopComputer,
        bgColor: 'bg-sky-600',
        borderColor: 'border-sky-500',
      };
    default:
      return {
        Icon: RiRobot2Fill,
        bgColor: 'bg-violet-600',
        borderColor: 'border-violet-500',
      };
  }
};

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

/** Icon-based metadata node for React Flow */
export const MetadataNode: FC<MetadataNodeProps> = ({ data }) => {
  const { metadataKey, metadataValue, todoCount } = data;
  const label = getKeyLabel(metadataKey);
  const tooltip = `${label}: ${metadataValue}\n${todoCount} todos`;
  const { Icon, bgColor, borderColor } = getMetadataStyle(metadataKey);

  return (
    <div
      className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-sm border-2 shadow-md transition-transform hover:scale-125 ${bgColor} ${borderColor}`}
      title={tooltip}
    >
      <Icon className="h-5 w-5 text-white" />
      {/* Centered handles */}
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
