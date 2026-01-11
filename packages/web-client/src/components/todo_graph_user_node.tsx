/**
 * User node component for the graph view.
 * Shows the current user with a person icon and optional speech bubble.
 */
import { Handle, Position } from '@xyflow/react';
import { type FC } from 'react';
import { HiUser } from 'react-icons/hi';

export interface UserNodeData {
  /** Display label (e.g., "You") */
  label: string;
  /** Number of todos modified by user */
  todoCount: number;
  /** Optional last message from user actions */
  lastMessage?: string;
}

/** Speech bubble shown on hover */
const SpeechBubble: FC<{ message: string }> = ({ message }) => (
  <div
    className="absolute bottom-full left-1/2 z-[9999] mb-2 opacity-0 transition-opacity group-hover:opacity-100"
    style={{ transform: 'translateX(-50%)' }}
  >
    <div
      className="rounded-lg bg-sky-900 px-4 py-2 text-xs leading-relaxed text-sky-100 shadow-xl"
      style={{ minWidth: '200px', maxWidth: '350px' }}
    >
      {message}
    </div>
    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-sky-900" />
  </div>
);

/** Simple label shown on hover */
const HoverLabel: FC<{ label: string }> = ({ label }) => (
  <div
    className="absolute bottom-full left-1/2 z-10 mb-1 opacity-0 transition-opacity group-hover:opacity-100"
    style={{ transform: 'translateX(-50%)' }}
  >
    <div className="rounded bg-sky-900 px-1.5 py-0.5 text-[10px] whitespace-nowrap text-sky-100 shadow">
      {label}
    </div>
  </div>
);

interface UserNodeProps {
  data: UserNodeData;
}

/** User node for React Flow */
export const UserNode: FC<UserNodeProps> = ({ data }) => {
  const { label, todoCount, lastMessage } = data;
  const tooltip = `${label}\n${todoCount} todo${todoCount !== 1 ? 's' : ''} modified`;

  return (
    <div className="group relative">
      {lastMessage ? <SpeechBubble message={lastMessage} /> : <HoverLabel label={label} />}
      <div
        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-2 border-sky-400 bg-sky-500 shadow-md transition-transform hover:scale-105"
        title={tooltip}
      >
        <HiUser className="h-5 w-5 text-white" />
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
