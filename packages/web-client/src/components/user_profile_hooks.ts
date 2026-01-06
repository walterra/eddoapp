/**
 * Custom hooks for UserProfile form state management
 */
import { useCallback, useEffect, useMemo } from 'react';

import type { ProfileResult } from '../hooks/use_profile';
import { useEmailActionHandlers } from './user_profile_email_hooks';
import { usePreferencesActionHandlers } from './user_profile_github_hooks';
import {
  buildProfileUpdateData,
  initializeGithubState,
  initializePreferencesState,
  initializeRssState,
  validatePasswordChange,
  validateProfileForm,
  validateTelegramId,
} from './user_profile_handlers';
import { useRssActionHandlers } from './user_profile_rss_hooks';
import type {
  EmailFormState,
  GithubFormState,
  PreferencesFormState,
  ProfileFormState,
  RssFormState,
  UserProfile,
} from './user_profile_types';

interface FormStateSetters {
  setFormState: (fn: (prev: ProfileFormState) => ProfileFormState) => void;
  setPreferencesState: (state: PreferencesFormState) => void;
  setGithubState: (state: GithubFormState) => void;
  setRssState: (state: RssFormState) => void;
}

/** Initialize form state from profile */
export function useFormInitialization(profile: UserProfile | null, setters: FormStateSetters) {
  const { setFormState, setPreferencesState, setGithubState, setRssState } = setters;
  useEffect(() => {
    if (profile) {
      setFormState((prev) => ({ ...prev, email: profile.email }));
      setPreferencesState(initializePreferencesState(profile.preferences));
      setGithubState(initializeGithubState(profile.preferences));
      setRssState(initializeRssState(profile.preferences));
    }
  }, [profile, setFormState, setPreferencesState, setGithubState, setRssState]);
}

/** Partial update data for preferences - can include general, github, or rss prefs */
interface PreferencesUpdateData extends Partial<PreferencesFormState> {
  githubSync?: boolean;
  githubToken?: string | null;
  githubSyncInterval?: number;
  githubSyncTags?: string[];
  rssSync?: boolean;
  rssSyncInterval?: number;
  rssSyncTags?: string[];
}

interface FormActions {
  updateProfile: (data: { email?: string }) => Promise<ProfileResult>;
  changePassword: (data: {
    currentPassword: string;
    newPassword: string;
  }) => Promise<ProfileResult>;
  linkTelegram: (id: number) => Promise<ProfileResult>;
  unlinkTelegram: () => Promise<ProfileResult>;
  updatePreferences: (data: PreferencesUpdateData) => Promise<ProfileResult>;
  githubResyncMutate: () => Promise<unknown>;
  rssResyncMutate: () => Promise<unknown>;
  emailResyncMutate: () => Promise<unknown>;
}

interface FormHandlersConfig {
  formState: ProfileFormState;
  setFormState: (fn: (prev: ProfileFormState) => ProfileFormState) => void;
  preferencesState: PreferencesFormState;
  githubState: GithubFormState;
  rssState: RssFormState;
  emailState: EmailFormState;
  profile: UserProfile | null;
  authToken: string | null;
  editMode: boolean;
  setEditMode: (mode: boolean) => void;
  setFormError: (error: string) => void;
  setSuccess: (success: string | null) => void;
  clearError: () => void;
  actions: FormActions;
}

type FormFieldSetter = (fn: (prev: ProfileFormState) => ProfileFormState) => void;

/** Create form field handlers */
export function useFormFieldHandlers(setFormState: FormFieldSetter) {
  return useMemo(
    () => ({
      onEmailChange: (v: string) => setFormState((p) => ({ ...p, email: v })),
      onCurrentPasswordChange: (v: string) => setFormState((p) => ({ ...p, currentPassword: v })),
      onNewPasswordChange: (v: string) => setFormState((p) => ({ ...p, newPassword: v })),
      onConfirmPasswordChange: (v: string) => setFormState((p) => ({ ...p, confirmPassword: v })),
      onTelegramIdChange: (v: string) => setFormState((p) => ({ ...p, telegramId: v })),
    }),
    [setFormState],
  );
}

type PreferencesFieldSetter = (fn: (prev: PreferencesFormState) => PreferencesFormState) => void;

/** Create preference field handlers */
export function usePreferencesFieldHandlers(setPreferencesState: PreferencesFieldSetter) {
  return useMemo(
    () => ({
      onDailyBriefingChange: (v: boolean) =>
        setPreferencesState((p) => ({ ...p, dailyBriefing: v })),
      onBriefingTimeChange: (v: string) => setPreferencesState((p) => ({ ...p, briefingTime: v })),
      onPrintBriefingChange: (v: boolean) =>
        setPreferencesState((p) => ({ ...p, printBriefing: v })),
      onDailyRecapChange: (v: boolean) => setPreferencesState((p) => ({ ...p, dailyRecap: v })),
      onRecapTimeChange: (v: string) => setPreferencesState((p) => ({ ...p, recapTime: v })),
      onPrintRecapChange: (v: boolean) => setPreferencesState((p) => ({ ...p, printRecap: v })),
    }),
    [setPreferencesState],
  );
}

type GithubFieldSetter = (fn: (prev: GithubFormState) => GithubFormState) => void;

/** Create GitHub field handlers */
export function useGithubFieldHandlers(setGithubState: GithubFieldSetter) {
  return useMemo(
    () => ({
      onGithubSyncChange: (v: boolean) => setGithubState((p) => ({ ...p, githubSync: v })),
      onGithubTokenChange: (v: string) => setGithubState((p) => ({ ...p, githubToken: v })),
      onGithubIntervalChange: (v: number) =>
        setGithubState((p) => ({ ...p, githubSyncInterval: v })),
      onGithubTagsChange: (v: string) => setGithubState((p) => ({ ...p, githubSyncTags: v })),
    }),
    [setGithubState],
  );
}

type RssFieldSetter = (fn: (prev: RssFormState) => RssFormState) => void;

/** Create RSS field handlers */
export function useRssFieldHandlers(setRssState: RssFieldSetter) {
  return useMemo(
    () => ({
      onRssSyncChange: (v: boolean) => setRssState((p) => ({ ...p, rssSync: v })),
      onRssIntervalChange: (v: number) => setRssState((p) => ({ ...p, rssSyncInterval: v })),
      onRssTagsChange: (v: string) => setRssState((p) => ({ ...p, rssSyncTags: v })),
    }),
    [setRssState],
  );
}

/** Reset password fields */
function resetPasswordFields(setFormState: FormFieldSetter) {
  setFormState((p) => ({ ...p, currentPassword: '', newPassword: '', confirmPassword: '' }));
}

/** Create edit toggle handler */
function useEditToggleHandler(config: FormHandlersConfig) {
  const { editMode, profile, setFormState, setFormError, setEditMode, setSuccess, clearError } =
    config;
  return useCallback(() => {
    if (editMode) {
      setFormState((prev) => ({
        ...prev,
        email: profile?.email || '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      }));
      setFormError('');
    }
    setEditMode(!editMode);
    setSuccess(null);
    clearError();
  }, [editMode, profile?.email, setFormState, setFormError, setEditMode, setSuccess, clearError]);
}

/** Create save profile handler */
function useSaveProfileHandler(config: FormHandlersConfig) {
  const { formState, profile, setFormState, setFormError, setSuccess, setEditMode, actions } =
    config;
  return useCallback(async () => {
    setFormError('');
    setSuccess(null);
    const err = validateProfileForm(formState, profile?.email);
    if (err) {
      setFormError(err);
      return;
    }
    const updateData = buildProfileUpdateData(formState, profile?.email);
    if (Object.keys(updateData).length === 0) {
      setEditMode(false);
      return;
    }
    const result = await actions.updateProfile(updateData);
    if (result.success) {
      setSuccess('Profile updated successfully');
      setEditMode(false);
      resetPasswordFields(setFormState);
    } else setFormError(result.error || 'Failed to update profile');
  }, [formState, profile?.email, setFormError, setSuccess, setEditMode, actions, setFormState]);
}

/** Create password change handler */
function useChangePasswordHandler(config: FormHandlersConfig) {
  const { formState, setFormState, setFormError, setSuccess, actions } = config;
  return useCallback(async () => {
    setFormError('');
    setSuccess(null);
    const err = validatePasswordChange(formState);
    if (err) {
      setFormError(err);
      return;
    }
    const result = await actions.changePassword({
      currentPassword: formState.currentPassword,
      newPassword: formState.newPassword,
    });
    if (result.success) {
      setSuccess('Password changed successfully');
      resetPasswordFields(setFormState);
    } else setFormError(result.error || 'Failed to change password');
  }, [formState, setFormError, setSuccess, actions, setFormState]);
}

/** Create telegram handlers */
function useTelegramHandlers(config: FormHandlersConfig) {
  const { formState, setFormState, setFormError, setSuccess, actions } = config;
  const handleLinkTelegram = useCallback(async () => {
    setFormError('');
    setSuccess(null);
    const err = validateTelegramId(formState.telegramId);
    if (err) {
      setFormError(err);
      return;
    }
    const result = await actions.linkTelegram(parseInt(formState.telegramId, 10));
    if (result.success) {
      setSuccess('Telegram account linked successfully');
      setFormState((p) => ({ ...p, telegramId: '' }));
    } else setFormError(result.error || 'Failed to link Telegram');
  }, [formState.telegramId, setFormError, setSuccess, actions, setFormState]);

  const handleUnlinkTelegram = useCallback(async () => {
    if (!confirm('Are you sure you want to unlink your Telegram account?')) return;
    const result = await actions.unlinkTelegram();
    if (result.success) setSuccess('Telegram account unlinked successfully');
    else setFormError(result.error || 'Failed to unlink Telegram');
  }, [actions, setFormError, setSuccess]);

  return { handleLinkTelegram, handleUnlinkTelegram };
}

/** Create profile action handlers */
export function useProfileActionHandlers(config: FormHandlersConfig) {
  const handleEditToggle = useEditToggleHandler(config);
  const handleSaveProfile = useSaveProfileHandler(config);
  const handleChangePassword = useChangePasswordHandler(config);
  const telegramHandlers = useTelegramHandlers(config);
  const preferencesHandlers = usePreferencesActionHandlers({
    preferencesState: config.preferencesState,
    githubState: config.githubState,
    setFormError: config.setFormError,
    setSuccess: config.setSuccess,
    updatePreferences: config.actions.updatePreferences,
    githubResyncMutate: config.actions.githubResyncMutate,
    rssResyncMutate: config.actions.rssResyncMutate,
  });
  const rssHandlers = useRssActionHandlers({
    rssState: config.rssState,
    profile: config.profile,
    authToken: config.authToken,
    setFormError: config.setFormError,
    setSuccess: config.setSuccess,
    updatePreferences: config.actions.updatePreferences,
  });
  const emailHandlers = useEmailActionHandlers({
    emailState: config.emailState,
    profile: config.profile,
    setFormError: config.setFormError,
    setSuccess: config.setSuccess,
    updatePreferences: config.actions.updatePreferences,
    emailResyncMutate: config.actions.emailResyncMutate,
  });

  return {
    handleEditToggle,
    handleSaveProfile,
    handleChangePassword,
    ...telegramHandlers,
    ...preferencesHandlers,
    ...rssHandlers,
    ...emailHandlers,
  };
}
