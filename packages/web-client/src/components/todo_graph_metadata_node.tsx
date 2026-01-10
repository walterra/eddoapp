/**
 * Icon-based metadata node component for the graph view.
 * Different icons for different metadata types.
 * Supports optional speech bubble for displaying messages.
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
  /** Optional message to display in speech bubble */
  lastMessage?: string;
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

/** Truncate message for display */
const truncateMessage = (message: string, maxLen: number = 60): string => {
  if (message.length <= maxLen) return message;
  return message.slice(0, maxLen - 3) + '...';
};

interface MetadataNodeProps {
  data: MetadataNodeData;
}

/** Icon-based metadata node for React Flow */
export const MetadataNode: FC<MetadataNodeProps> = ({ data }) => {
  const { metadataKey, metadataValue, todoCount, lastMessage } = data;
  const label = getKeyLabel(metadataKey);
  const tooltip = `${label}: ${metadataValue}\n${todoCount} todos`;
  const { Icon, bgColor, borderColor } = getMetadataStyle(metadataKey);

  return (
    <div className="relative">
      {/* Speech bubble for last message */}
      {lastMessage && (
        <div className="absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap">
          <div className="rounded-lg bg-violet-900 px-3 py-1.5 text-xs text-violet-100 shadow-lg">
            {truncateMessage(lastMessage)}
          </div>
          {/* Speech bubble tail */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-violet-900" />
        </div>
      )}

      {/* Node icon */}
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
    </div>
  );
};
