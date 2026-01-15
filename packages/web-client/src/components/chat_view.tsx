/**
 * Fullscreen chat view component.
 */
import type { FC } from 'react';
import { HiOutlineLogout, HiOutlineUser, HiOutlineViewBoards } from 'react-icons/hi';

import { ChatPage } from './chat';

/** Icon button for header */
const IconButton: FC<{
  onClick: () => void;
  label: string;
  title: string;
  children: React.ReactNode;
}> = ({ onClick, label, title, children }) => (
  <button
    aria-label={label}
    className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-700"
    onClick={onClick}
    title={title}
    type="button"
  >
    {children}
  </button>
);

/** Chat view header with navigation */
const ChatViewHeader: FC<{
  onBack: () => void;
  onDock: () => void;
  onProfile: () => void;
  onLogout: () => void;
}> = ({ onBack, onDock, onProfile, onLogout }) => (
  <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-2 dark:border-neutral-700">
    <button
      className="flex items-center gap-2 text-sm text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
      onClick={onBack}
      type="button"
    >
      ← Back to Todos
    </button>
    <div className="flex items-center space-x-1">
      <IconButton label="Dock to sidebar" onClick={onDock} title="Dock to sidebar">
        <HiOutlineViewBoards className="h-5 w-5" />
      </IconButton>
      <IconButton label="Profile" onClick={onProfile} title="Profile">
        <HiOutlineUser className="h-5 w-5" />
      </IconButton>
      <IconButton label="Logout" onClick={onLogout} title="Logout">
        <HiOutlineLogout className="h-5 w-5" />
      </IconButton>
    </div>
  </div>
);

/** Props for ChatView */
export interface ChatViewProps {
  onBack: () => void;
  onDock: () => void;
  onProfile: () => void;
  onLogout: () => void;
}

/** Fullscreen chat view wrapper */
export const ChatView: FC<ChatViewProps> = ({ onBack, onDock, onProfile, onLogout }) => (
  <div className="flex h-screen w-full flex-col overflow-hidden bg-neutral-50 dark:bg-neutral-900">
    <ChatViewHeader onBack={onBack} onDock={onDock} onLogout={onLogout} onProfile={onProfile} />
    <div className="min-h-0 flex-1">
      <ChatPage />
    </div>
  </div>
);
