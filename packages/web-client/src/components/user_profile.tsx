/**
 * User profile settings page component
 */
import { Button, Card } from 'flowbite-react';
import { useEffect, useState } from 'react';

import { useProfile } from '../hooks/use_profile';
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
      if (profile.preferences) {
        setPreferencesState({
          dailyBriefing: profile.preferences.dailyBriefing,
          briefingTime: profile.preferences.briefingTime || '07:00',
          printBriefing: profile.preferences.printBriefing || false,
          dailyRecap: profile.preferences.dailyRecap || false,
          recapTime: profile.preferences.recapTime || '18:00',
          printRecap: profile.preferences.printRecap || false,
        });
        setGithubState({
          githubSync: profile.preferences.githubSync || false,
          githubToken: profile.preferences.githubToken || '',
          githubSyncInterval: profile.preferences.githubSyncInterval || 60,
          githubSyncTags: profile.preferences.githubSyncTags?.join(', ') || 'github, gtd:next',
        });
      }
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

    const telegramIdNumber = parseInt(formState.telegramId, 10);
    if (!formState.telegramId || isNaN(telegramIdNumber) || telegramIdNumber <= 0) {
      setFormError('Please enter a valid Telegram ID (positive number)');
      return;
    }

    const result = await linkTelegram(telegramIdNumber);
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

    if (githubState.githubToken && !githubState.githubToken.match(/^(ghp_|github_pat_)/)) {
      setFormError('Invalid GitHub token format. Token should start with ghp_ or github_pat_');
      return;
    }

    const result = await updatePreferences({
      githubSync: githubState.githubSync,
      githubToken: githubState.githubToken || null,
      githubSyncInterval: githubState.githubSyncInterval,
      githubSyncTags: githubState.githubSyncTags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    });

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

// Helper components

function LoadingState() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="text-lg">Loading profile...</div>
      </div>
    </div>
  );
}

function NotFoundState({ onClose }: { onClose?: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-md">
        <div className="text-center">
          <h3 className="text-xl font-medium text-gray-900">Profile not found</h3>
          <p className="mt-2 text-sm text-gray-600">Unable to load your profile information.</p>
          {onClose && (
            <Button className="mt-4" onClick={onClose}>
              Go Back
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}

function PageHeader({ onClose }: { onClose?: () => void }) {
  return (
    <div className="mb-6 flex items-center justify-between">
      <h1 className="text-3xl font-bold text-gray-900">Profile Settings</h1>
      {onClose && (
        <Button color="gray" onClick={onClose}>
          Back to App
        </Button>
      )}
    </div>
  );
}

function TabNavigation({
  activeTab,
  onTabChange,
}: {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}) {
  const tabs: TabType[] = ['profile', 'security', 'integrations', 'preferences'];

  return (
    <div className="mb-6 border-b border-gray-200">
      <nav className="-mb-px flex space-x-8">
        {tabs.map((tab) => (
          <button
            className={`border-b-2 px-1 py-2 text-sm font-medium ${
              activeTab === tab
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
            key={tab}
            onClick={() => onTabChange(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </nav>
    </div>
  );
}

function MessageDisplay({ success, error }: { success: string | null; error: string | null }) {
  if (!success && !error) return null;

  return (
    <div className="mb-6">
      {success && (
        <div className="rounded-lg bg-green-100 p-4 text-sm text-green-700">{success}</div>
      )}
      {error && <div className="rounded-lg bg-red-100 p-4 text-sm text-red-700">{error}</div>}
    </div>
  );
}

// Validation helpers

function validateProfileForm(formState: ProfileFormState, _currentEmail?: string): string | null {
  if (!formState.email) {
    return 'Email is required';
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formState.email)) {
    return 'Please enter a valid email address';
  }

  if (formState.newPassword) {
    if (!formState.currentPassword) {
      return 'Current password is required to change password';
    }
    if (formState.newPassword.length < 8) {
      return 'New password must be at least 8 characters long';
    }
    if (formState.newPassword !== formState.confirmPassword) {
      return 'New passwords do not match';
    }
  }

  return null;
}

function validatePasswordChange(formState: ProfileFormState): string | null {
  if (!formState.currentPassword || !formState.newPassword) {
    return 'Both current and new passwords are required';
  }

  if (formState.newPassword.length < 8) {
    return 'New password must be at least 8 characters long';
  }

  if (formState.newPassword !== formState.confirmPassword) {
    return 'New passwords do not match';
  }

  return null;
}

function buildProfileUpdateData(
  formState: ProfileFormState,
  currentEmail?: string,
): Record<string, unknown> {
  const updateData: Record<string, unknown> = {};

  if (formState.email !== currentEmail) {
    updateData.email = formState.email;
  }

  if (formState.newPassword) {
    updateData.currentPassword = formState.currentPassword;
    updateData.newPassword = formState.newPassword;
  }

  return updateData;
}
