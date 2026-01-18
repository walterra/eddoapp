/**
 * Dialog for creating a new chat session.
 */

import type { CreateChatSessionRequest } from '@eddo/core-shared';
import { type FC, useState } from 'react';
import { createPortal } from 'react-dom';
import { HiOutlineChat, HiOutlineX } from 'react-icons/hi';

import { useCreateSession } from '../../hooks/use_chat_api';
import { BTN_GHOST, BTN_PRIMARY, INPUT_BASE, TRANSITION } from '../../styles/interactive';

/** Props for NewSessionDialog */
export interface NewSessionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (sessionId: string) => void;
}

/** Dialog backdrop */
const Backdrop: FC<{ onClick: () => void }> = ({ onClick }) => (
  <div aria-hidden="true" className="fixed inset-0 z-40 bg-neutral-900/50" onClick={onClick} />
);

/** Dialog header */
const DialogHeader: FC<{ onClose: () => void }> = ({ onClose }) => (
  <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4 dark:border-neutral-700">
    <div className="flex items-center gap-2">
      <HiOutlineChat className="text-primary-600 dark:text-primary-400 h-5 w-5" />
      <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">New Chat Session</h2>
    </div>
    <button
      aria-label="Close dialog"
      className={`rounded-lg p-1 ${TRANSITION} text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-700 dark:hover:text-neutral-200`}
      onClick={onClose}
      type="button"
    >
      <HiOutlineX className="h-5 w-5" />
    </button>
  </div>
);

/** Form field wrapper */
const FormField: FC<{
  label: string;
  htmlFor: string;
  optional?: boolean;
  children: React.ReactNode;
}> = ({ label, htmlFor, optional, children }) => (
  <div>
    <label
      className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300"
      htmlFor={htmlFor}
    >
      {label}
      {optional && <span className="ml-1 text-neutral-400 dark:text-neutral-500">(optional)</span>}
    </label>
    {children}
  </div>
);

/** Dialog footer with actions */
const DialogFooter: FC<{
  onCancel: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}> = ({ onCancel, onSubmit, isSubmitting }) => (
  <div className="flex justify-end gap-3 border-t border-neutral-200 px-6 py-4 dark:border-neutral-700">
    <button className={BTN_GHOST} disabled={isSubmitting} onClick={onCancel} type="button">
      Cancel
    </button>
    <button className={BTN_PRIMARY} disabled={isSubmitting} onClick={onSubmit} type="button">
      {isSubmitting ? 'Creating...' : 'Create Session'}
    </button>
  </div>
);

/** Error message display */
const ErrorMessage: FC<{ message: string }> = ({ message }) => (
  <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
    {message}
  </div>
);

/** Session name input field */
const SessionNameField: FC<{
  value: string;
  onChange: (value: string) => void;
}> = ({ value, onChange }) => (
  <FormField htmlFor="session-name" label="Session Name" optional>
    <input
      autoFocus
      className={`${INPUT_BASE} w-full`}
      id="session-name"
      onChange={(e) => onChange(e.target.value)}
      placeholder="My coding session"
      type="text"
      value={value}
    />
  </FormField>
);

/** Repository configuration fields */
const RepositoryFields: FC<{
  repoSlug: string;
  gitUrl: string;
  branch: string;
  onRepoSlugChange: (value: string) => void;
  onGitUrlChange: (value: string) => void;
  onBranchChange: (value: string) => void;
}> = ({ repoSlug, gitUrl, branch, onRepoSlugChange, onGitUrlChange, onBranchChange }) => (
  <div className="border-t border-neutral-200 pt-4 dark:border-neutral-700">
    <h3 className="mb-3 text-sm font-medium text-neutral-700 dark:text-neutral-300">
      Repository (optional)
    </h3>
    <div className="space-y-3">
      <FormField htmlFor="repo-slug" label="Repository Slug" optional>
        <input
          className={`${INPUT_BASE} w-full`}
          id="repo-slug"
          onChange={(e) => onRepoSlugChange(e.target.value)}
          placeholder="owner/repo"
          type="text"
          value={repoSlug}
        />
      </FormField>
      <FormField htmlFor="git-url" label="Git URL" optional>
        <input
          className={`${INPUT_BASE} w-full`}
          id="git-url"
          onChange={(e) => onGitUrlChange(e.target.value)}
          placeholder="https://github.com/owner/repo.git"
          type="url"
          value={gitUrl}
        />
      </FormField>
      <FormField htmlFor="branch" label="Branch" optional>
        <input
          className={`${INPUT_BASE} w-full`}
          id="branch"
          onChange={(e) => onBranchChange(e.target.value)}
          placeholder="main"
          type="text"
          value={branch}
        />
      </FormField>
    </div>
  </div>
);

/** Form state for new session */
interface FormState {
  name: string;
  repoSlug: string;
  gitUrl: string;
  branch: string;
  error: string | null;
}

/** Initial form state */
const initialFormState: FormState = {
  name: '',
  repoSlug: '',
  gitUrl: '',
  branch: 'main',
  error: null,
};

/** Build request from form state */
function buildCreateRequest(state: FormState): CreateChatSessionRequest {
  const request: CreateChatSessionRequest = {
    name: state.name.trim() || undefined,
  };

  if (state.repoSlug.trim() && state.gitUrl.trim()) {
    request.repository = {
      slug: state.repoSlug.trim(),
      gitUrl: state.gitUrl.trim(),
      defaultBranch: state.branch.trim() || 'main',
    };
  }

  return request;
}

/** Dialog form content */
const DialogFormContent: FC<{
  formState: FormState;
  setFormState: React.Dispatch<React.SetStateAction<FormState>>;
}> = ({ formState, setFormState }) => (
  <div className="space-y-4 px-6 py-4">
    {formState.error && <ErrorMessage message={formState.error} />}
    <SessionNameField
      onChange={(v) => setFormState((s) => ({ ...s, name: v }))}
      value={formState.name}
    />
    <RepositoryFields
      branch={formState.branch}
      gitUrl={formState.gitUrl}
      onBranchChange={(v) => setFormState((s) => ({ ...s, branch: v }))}
      onGitUrlChange={(v) => setFormState((s) => ({ ...s, gitUrl: v }))}
      onRepoSlugChange={(v) => setFormState((s) => ({ ...s, repoSlug: v }))}
      repoSlug={formState.repoSlug}
    />
  </div>
);

/** Dialog panel wrapper */
const DialogPanel: FC<{
  onClose: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  formState: FormState;
  setFormState: React.Dispatch<React.SetStateAction<FormState>>;
}> = ({ onClose, onSubmit, isSubmitting, formState, setFormState }) => (
  <div className="relative z-50 w-full max-w-md rounded-lg border border-neutral-200 bg-white shadow-xl dark:border-neutral-700 dark:bg-neutral-800">
    <DialogHeader onClose={onClose} />
    <DialogFormContent formState={formState} setFormState={setFormState} />
    <DialogFooter isSubmitting={isSubmitting} onCancel={onClose} onSubmit={onSubmit} />
  </div>
);

/** New session dialog component */
export const NewSessionDialog: FC<NewSessionDialogProps> = ({ isOpen, onClose, onCreated }) => {
  const [formState, setFormState] = useState<FormState>(initialFormState);
  const createSession = useCreateSession();
  const resetForm = () => setFormState(initialFormState);

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    setFormState((s) => ({ ...s, error: null }));
    try {
      const session = await createSession.mutateAsync(buildCreateRequest(formState));
      resetForm();
      onCreated(session._id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create session';
      setFormState((s) => ({ ...s, error: msg }));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') handleClose();
    else if (e.key === 'Enter' && !createSession.isPending) handleSubmit();
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      aria-labelledby="new-session-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center"
      onKeyDown={handleKeyDown}
      role="dialog"
    >
      <Backdrop onClick={handleClose} />
      <DialogPanel
        formState={formState}
        isSubmitting={createSession.isPending}
        onClose={handleClose}
        onSubmit={handleSubmit}
        setFormState={setFormState}
      />
    </div>,
    document.body,
  );
};
