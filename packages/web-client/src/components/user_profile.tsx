/**
 * User profile settings page component
 */
import { useState } from 'react';

import { useProfile } from '../hooks/use_profile';
import {
  useFormFieldHandlers,
  useFormInitialization,
  useGithubFieldHandlers,
  usePreferencesFieldHandlers,
  useProfileActionHandlers,
} from './user_profile_hooks';
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

const INITIAL_FORM_STATE: ProfileFormState = {
  email: '',
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
  telegramId: '',
};

const INITIAL_PREFERENCES_STATE: PreferencesFormState = {
  dailyBriefing: false,
  briefingTime: '07:00',
  printBriefing: false,
  dailyRecap: false,
  recapTime: '18:00',
  printRecap: false,
};

const INITIAL_GITHUB_STATE: GithubFormState = {
  githubSync: false,
  githubToken: '',
  githubSyncInterval: 60,
  githubSyncTags: 'github, gtd:next',
};

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
  const [formState, setFormState] = useState<ProfileFormState>(INITIAL_FORM_STATE);
  const [preferencesState, setPreferencesState] =
    useState<PreferencesFormState>(INITIAL_PREFERENCES_STATE);
  const [githubState, setGithubState] = useState<GithubFormState>(INITIAL_GITHUB_STATE);

  useFormInitialization(profile, setFormState, setPreferencesState, setGithubState);

  const formFieldHandlers = useFormFieldHandlers(setFormState);
  const preferencesFieldHandlers = usePreferencesFieldHandlers(setPreferencesState);
  const githubFieldHandlers = useGithubFieldHandlers(setGithubState);

  const actions = useProfileActionHandlers({
    formState,
    setFormState,
    preferencesState,
    githubState,
    profile,
    editMode,
    setEditMode,
    setFormError,
    setSuccess,
    clearError,
    actions: {
      updateProfile,
      changePassword,
      linkTelegram,
      unlinkTelegram,
      updatePreferences,
      githubResyncMutate: mutations.githubResync.mutateAsync,
    },
  });

  if (isLoading && !profile) return <LoadingState />;
  if (!profile) return <NotFoundState onClose={onClose} />;

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
            onEditToggle={actions.handleEditToggle}
            onSave={actions.handleSaveProfile}
            profile={profile}
            {...formFieldHandlers}
          />
        )}

        {activeTab === 'security' && (
          <SecurityTab
            formState={formState}
            isLoading={isLoading}
            onChangePassword={actions.handleChangePassword}
            {...formFieldHandlers}
          />
        )}

        {activeTab === 'integrations' && (
          <IntegrationsTab
            githubState={githubState}
            isLoading={isLoading}
            isResyncing={mutations.githubResync.isPending}
            onForceResync={actions.handleForceResync}
            onLinkTelegram={actions.handleLinkTelegram}
            onSaveGithub={actions.handleUpdateGithubPreferences}
            onTelegramIdChange={formFieldHandlers.onTelegramIdChange}
            onUnlinkTelegram={actions.handleUnlinkTelegram}
            profile={profile}
            telegramId={formState.telegramId}
            {...githubFieldHandlers}
          />
        )}

        {activeTab === 'preferences' && (
          <PreferencesTab
            isLoading={isLoading}
            onSave={actions.handleUpdatePreferences}
            preferencesState={preferencesState}
            {...preferencesFieldHandlers}
          />
        )}
      </div>
    </div>
  );
}
