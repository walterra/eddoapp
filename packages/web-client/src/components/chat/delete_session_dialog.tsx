/**
 * Confirmation dialog for deleting a chat session.
 */

import type { ChatSession } from '@eddo/core-shared';
import { type FC } from 'react';
import { createPortal } from 'react-dom';
import { HiExclamation, HiOutlineX } from 'react-icons/hi';

import { useDeleteSession } from '../../hooks/use_chat_api';
import { BTN_GHOST, TRANSITION } from '../../styles/interactive';

/** Props for DeleteSessionDialog */
export interface DeleteSessionDialogProps {
  session: ChatSession | null;
  onClose: () => void;
  onDeleted: () => void;
}

/** Dialog backdrop */
const Backdrop: FC<{ onClick: () => void }> = ({ onClick }) => (
  <div aria-hidden="true" className="fixed inset-0 z-40 bg-neutral-900/50" onClick={onClick} />
);

/** Warning icon */
const WarningIcon: FC = () => (
  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
    <HiExclamation className="h-6 w-6 text-red-600 dark:text-red-400" />
  </div>
);

/** Close button */
const CloseButton: FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    aria-label="Close dialog"
    className={`absolute top-4 right-4 rounded-lg p-1 ${TRANSITION} text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-700 dark:hover:text-neutral-200`}
    onClick={onClick}
    type="button"
  >
    <HiOutlineX className="h-5 w-5" />
  </button>
);

/** Running session warning */
const RunningWarning: FC = () => (
  <div className="rounded-lg bg-yellow-50 p-3 text-sm text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300">
    <strong>Warning:</strong> This session is currently running. Deleting it will stop the container
    and discard any unsaved work.
  </div>
);

/** Session info display */
const SessionInfo: FC<{ session: ChatSession }> = ({ session }) => {
  const sessionName = session.name || `Session ${session._id.slice(0, 8)}`;
  return (
    <div className="rounded-lg bg-neutral-100 p-3 text-sm dark:bg-neutral-700">
      <div className="font-medium text-neutral-900 dark:text-white">{sessionName}</div>
      {session.repository?.slug && (
        <div className="mt-1 text-neutral-500 dark:text-neutral-400">{session.repository.slug}</div>
      )}
      <div className="mt-1 text-neutral-500 dark:text-neutral-400">
        {session.stats.messageCount} messages · Created{' '}
        {new Date(session.createdAt).toLocaleDateString()}
      </div>
    </div>
  );
};

/** Dialog header with title and description */
const DialogTitle: FC<{ sessionName: string }> = ({ sessionName }) => (
  <div className="text-center">
    <h2
      className="text-lg font-semibold text-neutral-900 dark:text-white"
      id="delete-session-title"
    >
      Delete Session?
    </h2>
    <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
      Are you sure you want to delete &ldquo;{sessionName}&rdquo;? This action cannot be undone.
    </p>
  </div>
);

/** Dialog action buttons */
const DialogActions: FC<{
  onCancel: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
}> = ({ onCancel, onConfirm, isDeleting }) => (
  <div className="flex justify-end gap-3">
    <button className={BTN_GHOST} disabled={isDeleting} onClick={onCancel} type="button">
      Cancel
    </button>
    <button
      className={`rounded-lg px-4 py-2 text-sm font-medium ${TRANSITION} bg-red-600 text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50`}
      disabled={isDeleting}
      onClick={onConfirm}
      type="button"
    >
      {isDeleting ? 'Deleting...' : 'Delete Session'}
    </button>
  </div>
);

/** Delete session dialog component */
export const DeleteSessionDialog: FC<DeleteSessionDialogProps> = ({
  session,
  onClose,
  onDeleted,
}) => {
  const deleteSession = useDeleteSession();

  const handleDelete = async () => {
    if (!session) return;
    try {
      await deleteSession.mutateAsync(session._id);
      onDeleted();
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  };

  if (!session) return null;

  const isRunning = session.containerState === 'running';
  const sessionName = session.name || `Session ${session._id.slice(0, 8)}`;

  return createPortal(
    <div
      aria-labelledby="delete-session-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center"
      onKeyDown={handleKeyDown}
      role="dialog"
    >
      <Backdrop onClick={onClose} />
      <div className="relative z-50 w-full max-w-md rounded-lg border border-neutral-200 bg-white p-6 shadow-xl dark:border-neutral-700 dark:bg-neutral-800">
        <CloseButton onClick={onClose} />
        <div className="space-y-4">
          <WarningIcon />
          <DialogTitle sessionName={sessionName} />
          {isRunning && <RunningWarning />}
          <SessionInfo session={session} />
          <DialogActions
            isDeleting={deleteSession.isPending}
            onCancel={onClose}
            onConfirm={handleDelete}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
};
