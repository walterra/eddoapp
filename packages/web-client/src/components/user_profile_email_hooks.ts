/**
 * Custom hooks for email sync form state management
 */
import { useCallback, useMemo } from 'react';

import type { ProfileResult } from '../hooks/use_profile';
import type { EmailFormState, UserProfile } from './user_profile_types';

type EmailFieldSetter = (fn: (prev: EmailFormState) => EmailFormState) => void;

/** Create email field handlers */
export function useEmailFieldHandlers(setEmailState: EmailFieldSetter) {
  return useMemo(
    () => ({
      onEmailSyncChange: (v: boolean) => setEmailState((p) => ({ ...p, emailSync: v })),
      onEmailFolderChange: (v: string) => setEmailState((p) => ({ ...p, emailFolder: v })),
      onEmailIntervalChange: (v: number) => setEmailState((p) => ({ ...p, emailSyncInterval: v })),
      onEmailTagsChange: (v: string) => setEmailState((p) => ({ ...p, emailSyncTags: v })),
    }),
    [setEmailState],
  );
}

/** Initialize email state from profile preferences */
export function initializeEmailState(
  preferences: UserProfile['preferences'] | undefined,
): EmailFormState {
  return {
    emailSync: preferences?.emailSync || false,
    emailFolder: preferences?.emailFolder || 'eddo',
    emailSyncInterval: preferences?.emailSyncInterval || 15,
    emailSyncTags: (preferences?.emailSyncTags || ['source:email', 'gtd:next']).join(', '),
  };
}

/** Build email preferences update data */
export function buildEmailUpdateData(
  emailState: EmailFormState,
): Record<string, boolean | number | string | string[]> {
  return {
    emailSync: emailState.emailSync,
    emailFolder: emailState.emailFolder,
    emailSyncInterval: emailState.emailSyncInterval,
    emailSyncTags: emailState.emailSyncTags.split(',').map((t) => t.trim()),
  };
}

interface EmailActionHandlersConfig {
  emailState: EmailFormState;
  profile: UserProfile | null;
  setFormError: (error: string) => void;
  setSuccess: (success: string | null) => void;
  updatePreferences: (data: Record<string, unknown>) => Promise<ProfileResult>;
  emailResyncMutate: () => Promise<unknown>;
}

/** Create email action handlers */
export function useEmailActionHandlers(config: EmailActionHandlersConfig) {
  const { emailState, setFormError, setSuccess, updatePreferences, emailResyncMutate } = config;

  const handleUpdateEmailPreferences = useCallback(async () => {
    setFormError('');
    setSuccess(null);
    const result = await updatePreferences(buildEmailUpdateData(emailState));
    if (result.success) setSuccess('Email sync settings updated successfully');
    else setFormError(result.error || 'Failed to update email sync settings');
  }, [emailState, setFormError, setSuccess, updatePreferences]);

  const handleForceEmailResync = useCallback(async () => {
    if (!confirm('Force resync will re-fetch all emails from your folder. Continue?')) return;
    setFormError('');
    setSuccess(null);
    try {
      await emailResyncMutate();
      setSuccess('Email resync completed successfully! Refresh the page to see updates.');
    } catch (err) {
      setFormError((err as Error).message || 'Failed to resync emails');
    }
  }, [setFormError, setSuccess, emailResyncMutate]);

  const handleConnectGmail = useCallback(async () => {
    // For now, show a message that this needs to be done via Telegram
    // In the future, this could redirect to the OAuth flow
    setFormError('');
    setSuccess(null);
    alert(
      'Gmail connection is currently available via the Telegram bot.\n\n' +
        'Use the /email auth command in Telegram to connect your Gmail account.',
    );
  }, [setFormError, setSuccess]);

  const handleDisconnectEmail = useCallback(async () => {
    if (!confirm('Are you sure you want to disconnect your email account?')) return;
    setFormError('');
    setSuccess(null);
    const result = await updatePreferences({
      emailSync: false,
      emailConfig: null,
    });
    if (result.success) setSuccess('Email account disconnected successfully');
    else setFormError(result.error || 'Failed to disconnect email account');
  }, [setFormError, setSuccess, updatePreferences]);

  return {
    handleUpdateEmailPreferences,
    handleForceEmailResync,
    handleConnectGmail,
    handleDisconnectEmail,
  };
}
