/**
 * GitHub and preferences action handlers for UserProfile
 */
import { useCallback } from 'react';

import type { ProfileResult } from '../hooks/use_profile';
import { buildGithubUpdateData, validateGithubToken } from './user_profile_handlers';
import type { GithubFormState, PreferencesFormState } from './user_profile_types';

interface GithubActionHandlersConfig {
  preferencesState: PreferencesFormState;
  githubState: GithubFormState;
  setFormError: (error: string) => void;
  setSuccess: (success: string | null) => void;
  updatePreferences: (data: Record<string, unknown>) => Promise<ProfileResult>;
  githubResyncMutate: () => Promise<unknown>;
  rssResyncMutate: () => Promise<unknown>;
}

/** Create RSS resync handler */
function useRssResyncHandler(config: GithubActionHandlersConfig) {
  const { setFormError, setSuccess, rssResyncMutate } = config;
  return useCallback(async () => {
    if (!confirm('Force resync will re-fetch all RSS feeds. Continue?')) return;
    setFormError('');
    setSuccess(null);
    try {
      await rssResyncMutate();
      setSuccess('RSS resync completed successfully! Refresh the page to see updates.');
    } catch (err) {
      setFormError((err as Error).message || 'Failed to resync RSS feeds');
    }
  }, [setFormError, setSuccess, rssResyncMutate]);
}

/** Create preferences and github handlers */
export function usePreferencesActionHandlers(config: GithubActionHandlersConfig) {
  const {
    preferencesState,
    githubState,
    setFormError,
    setSuccess,
    updatePreferences,
    githubResyncMutate,
  } = config;

  const handleUpdatePreferences = useCallback(async () => {
    setFormError('');
    setSuccess(null);
    const result = await updatePreferences({ ...preferencesState });
    if (result.success) setSuccess('Preferences updated successfully');
    else setFormError(result.error || 'Failed to update preferences');
  }, [preferencesState, setFormError, setSuccess, updatePreferences]);

  const handleUpdateGithubPreferences = useCallback(async () => {
    setFormError('');
    setSuccess(null);
    const err = validateGithubToken(githubState.githubToken);
    if (err) {
      setFormError(err);
      return;
    }
    const result = await updatePreferences(buildGithubUpdateData(githubState));
    if (result.success) setSuccess('GitHub sync settings updated successfully');
    else setFormError(result.error || 'Failed to update GitHub sync settings');
  }, [githubState, setFormError, setSuccess, updatePreferences]);

  const handleForceResync = useCallback(async () => {
    if (!confirm('Force resync will re-fetch all GitHub issues. This may take a while. Continue?'))
      return;
    setFormError('');
    setSuccess(null);
    try {
      await githubResyncMutate();
      setSuccess('GitHub resync completed successfully! Refresh the page to see updates.');
    } catch (err) {
      setFormError((err as Error).message || 'Failed to resync GitHub issues');
    }
  }, [setFormError, setSuccess, githubResyncMutate]);

  const handleForceRssResync = useRssResyncHandler(config);

  return {
    handleUpdatePreferences,
    handleUpdateGithubPreferences,
    handleForceResync,
    handleForceRssResync,
  };
}
