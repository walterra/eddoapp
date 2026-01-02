/**
 * User profile settings page component
 */
import { useEffect, useState } from 'react';

import { useProfile } from '../hooks/use_profile';
import {
  buildGithubUpdateData,
  buildProfileUpdateData,
  initializeGithubState,
  initializePreferencesState,
  validateGithubToken,
  validatePasswordChange,
  validateProfileForm,
  validateTelegramId,
} from './user_profile_handlers';
import {
  LoadingState,
  MessageDisplay,
  NotFoundState,
  PageHeader,
  TabNavigation,
} from './user_profile_layout';
import { IntegrationsTab } from './user_profile_tab_integrations';
import { PreferencesTab } from './user_profile_tab_preferences';
import { ProfileTab } from './user_profile_tab_profile';
import { SecurityTab } from './user_profile_tab_security';
import type { GithubFormState, PreferencesFormState, ProfileFormState } from './user_profile_types';

interface UserProfileProps {
  onClose?: () => void;
}

type TabType = 'profile' | 'security' | 'integrations' | 'preferences';

export function UserProfile({ onClose }: UserProfileProps) {
  const {
    profile,
    isLoading,
    error,
    updateProfile,
    changePassword,
    linkTelegram,
    unlinkTelegram,
    updatePreferences,
    clearError,
    mutations,
  } = useProfile();

  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const [editMode, setEditMode] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [formError, setFormError] = useState('');

  // Form states
  const [formState, setFormState] = useState<ProfileFormState>({
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    telegramId: '',
  });

  // Preferences states
  const [preferencesState, setPreferencesState] = useState<PreferencesFormState>({
    dailyBriefing: false,
    briefingTime: '07:00',
    printBriefing: false,
    dailyRecap: false,
    recapTime: '18:00',
    printRecap: false,
  });

  // GitHub integration states
  const [githubState, setGithubState] = useState<GithubFormState>({
    githubSync: false,
    githubToken: '',
    githubSyncInterval: 60,
    githubSyncTags: 'github, gtd:next',
  });

  // Initialize form when profile loads
  useEffect(() => {
    if (profile) {
      setFormState((prev) => ({ ...prev, email: profile.email }));
      setPreferencesState(initializePreferencesState(profile.preferences));
      setGithubState(initializeGithubState(profile.preferences));
    }
  }, [profile]);

  const handleEditToggle = () => {
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
  };

  const handleSaveProfile = async () => {
    setFormError('');
    setSuccess(null);

    const validationError = validateProfileForm(formState, profile?.email);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    const updateData = buildProfileUpdateData(formState, profile?.email);
    if (Object.keys(updateData).length === 0) {
      setEditMode(false);
      return;
    }

    const result = await updateProfile(updateData);
    if (result.success) {
      setSuccess('Profile updated successfully');
      setEditMode(false);
      resetPasswordFields();
    } else {
      setFormError(result.error || 'Failed to update profile');
    }
  };

  const handleChangePassword = async () => {
    setFormError('');
    setSuccess(null);

    const validationError = validatePasswordChange(formState);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    const result = await changePassword({
      currentPassword: formState.currentPassword,
      newPassword: formState.newPassword,
    });

    if (result.success) {
      setSuccess('Password changed successfully');
      resetPasswordFields();
    } else {
      setFormError(result.error || 'Failed to change password');
    }
  };

  const resetPasswordFields = () => {
    setFormState((prev) => ({
      ...prev,
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    }));
  };

  const handleLinkTelegram = async () => {
    setFormError('');
    setSuccess(null);

    const validationError = validateTelegramId(formState.telegramId);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    const result = await linkTelegram(parseInt(formState.telegramId, 10));
    if (result.success) {
      setSuccess('Telegram account linked successfully');
      setFormState((prev) => ({ ...prev, telegramId: '' }));
    } else {
      setFormError(result.error || 'Failed to link Telegram');
    }
  };

  const handleUnlinkTelegram = async () => {
    if (!confirm('Are you sure you want to unlink your Telegram account?')) return;

    const result = await unlinkTelegram();
    if (result.success) {
      setSuccess('Telegram account unlinked successfully');
    } else {
      setFormError(result.error || 'Failed to unlink Telegram');
    }
  };

  const handleUpdatePreferences = async () => {
    setFormError('');
    setSuccess(null);

    const result = await updatePreferences(preferencesState);
    if (result.success) {
      setSuccess('Preferences updated successfully');
    } else {
      setFormError(result.error || 'Failed to update preferences');
    }
  };

  const handleUpdateGithubPreferences = async () => {
    setFormError('');
    setSuccess(null);

    const tokenError = validateGithubToken(githubState.githubToken);
    if (tokenError) {
      setFormError(tokenError);
      return;
    }

    const result = await updatePreferences(buildGithubUpdateData(githubState));

    if (result.success) {
      setSuccess('GitHub sync settings updated successfully');
    } else {
      setFormError(result.error || 'Failed to update GitHub sync settings');
    }
  };

  const handleForceResync = async () => {
    const msg = 'Force resync will re-fetch all GitHub issues. This may take a while. Continue?';
    if (!confirm(msg)) return;

    setFormError('');
    setSuccess(null);

    try {
      await mutations.githubResync.mutateAsync();
      setSuccess('GitHub resync completed successfully! Refresh the page to see updates.');
    } catch (err) {
      setFormError((err as Error).message || 'Failed to resync GitHub issues');
    }
  };

  if (isLoading && !profile) {
    return <LoadingState />;
  }

  if (!profile) {
    return <NotFoundState onClose={onClose} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="mx-auto max-w-4xl">
        <PageHeader onClose={onClose} />
        <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
        <MessageDisplay error={error || formError} success={success} />

        {activeTab === 'profile' && (
          <ProfileTab
            editMode={editMode}
            formState={formState}
            isLoading={isLoading}
            onConfirmPasswordChange={(v) => setFormState((p) => ({ ...p, confirmPassword: v }))}
            onCurrentPasswordChange={(v) => setFormState((p) => ({ ...p, currentPassword: v }))}
            onEditToggle={handleEditToggle}
            onEmailChange={(v) => setFormState((p) => ({ ...p, email: v }))}
            onNewPasswordChange={(v) => setFormState((p) => ({ ...p, newPassword: v }))}
            onSave={handleSaveProfile}
            profile={profile}
          />
        )}

        {activeTab === 'security' && (
          <SecurityTab
            formState={formState}
            isLoading={isLoading}
            onChangePassword={handleChangePassword}
            onConfirmPasswordChange={(v) => setFormState((p) => ({ ...p, confirmPassword: v }))}
            onCurrentPasswordChange={(v) => setFormState((p) => ({ ...p, currentPassword: v }))}
            onNewPasswordChange={(v) => setFormState((p) => ({ ...p, newPassword: v }))}
          />
        )}

        {activeTab === 'integrations' && (
          <IntegrationsTab
            githubState={githubState}
            isLoading={isLoading}
            isResyncing={mutations.githubResync.isPending}
            onForceResync={handleForceResync}
            onGithubIntervalChange={(v) => setGithubState((p) => ({ ...p, githubSyncInterval: v }))}
            onGithubSyncChange={(v) => setGithubState((p) => ({ ...p, githubSync: v }))}
            onGithubTagsChange={(v) => setGithubState((p) => ({ ...p, githubSyncTags: v }))}
            onGithubTokenChange={(v) => setGithubState((p) => ({ ...p, githubToken: v }))}
            onLinkTelegram={handleLinkTelegram}
            onSaveGithub={handleUpdateGithubPreferences}
            onTelegramIdChange={(v) => setFormState((p) => ({ ...p, telegramId: v }))}
            onUnlinkTelegram={handleUnlinkTelegram}
            profile={profile}
            telegramId={formState.telegramId}
          />
        )}

        {activeTab === 'preferences' && (
          <PreferencesTab
            isLoading={isLoading}
            onBriefingTimeChange={(v) => setPreferencesState((p) => ({ ...p, briefingTime: v }))}
            onDailyBriefingChange={(v) => setPreferencesState((p) => ({ ...p, dailyBriefing: v }))}
            onDailyRecapChange={(v) => setPreferencesState((p) => ({ ...p, dailyRecap: v }))}
            onPrintBriefingChange={(v) => setPreferencesState((p) => ({ ...p, printBriefing: v }))}
            onPrintRecapChange={(v) => setPreferencesState((p) => ({ ...p, printRecap: v }))}
            onRecapTimeChange={(v) => setPreferencesState((p) => ({ ...p, recapTime: v }))}
            onSave={handleUpdatePreferences}
            preferencesState={preferencesState}
          />
        )}
      </div>
    </div>
  );
}
