/**
 * User profile settings page component
 */
import { type FC, useState } from 'react';

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
import type {
  GithubFormState,
  PreferencesFormState,
  UserProfile as ProfileData,
  ProfileFormState,
} from './user_profile_types';

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

interface TabContentProps {
  activeTab: TabType;
  profile: ProfileData;
  isLoading: boolean;
  editMode: boolean;
  formState: ProfileFormState;
  preferencesState: PreferencesFormState;
  githubState: GithubFormState;
  isResyncing: boolean;
  actions: ReturnType<typeof useProfileActionHandlers>;
  formFieldHandlers: ReturnType<typeof useFormFieldHandlers>;
  preferencesFieldHandlers: ReturnType<typeof usePreferencesFieldHandlers>;
  githubFieldHandlers: ReturnType<typeof useGithubFieldHandlers>;
}

const ProfileTabContent: FC<
  Omit<
    TabContentProps,
    | 'activeTab'
    | 'preferencesState'
    | 'githubState'
    | 'isResyncing'
    | 'preferencesFieldHandlers'
    | 'githubFieldHandlers'
  >
> = (p) => (
  <ProfileTab
    editMode={p.editMode}
    formState={p.formState}
    isLoading={p.isLoading}
    onEditToggle={p.actions.handleEditToggle}
    onSave={p.actions.handleSaveProfile}
    profile={p.profile}
    {...p.formFieldHandlers}
  />
);

const SecurityTabContent: FC<
  Pick<TabContentProps, 'formState' | 'isLoading' | 'actions' | 'formFieldHandlers'>
> = (p) => (
  <SecurityTab
    formState={p.formState}
    isLoading={p.isLoading}
    onChangePassword={p.actions.handleChangePassword}
    {...p.formFieldHandlers}
  />
);

const IntegrationsTabContent: FC<
  Pick<
    TabContentProps,
    | 'profile'
    | 'isLoading'
    | 'formState'
    | 'githubState'
    | 'isResyncing'
    | 'actions'
    | 'formFieldHandlers'
    | 'githubFieldHandlers'
  >
> = (p) => (
  <IntegrationsTab
    githubState={p.githubState}
    isLoading={p.isLoading}
    isResyncing={p.isResyncing}
    onForceResync={p.actions.handleForceResync}
    onLinkTelegram={p.actions.handleLinkTelegram}
    onSaveGithub={p.actions.handleUpdateGithubPreferences}
    onTelegramIdChange={p.formFieldHandlers.onTelegramIdChange}
    onUnlinkTelegram={p.actions.handleUnlinkTelegram}
    profile={p.profile}
    telegramId={p.formState.telegramId}
    {...p.githubFieldHandlers}
  />
);

const TabContent: FC<TabContentProps> = (props) => {
  const { activeTab } = props;
  if (activeTab === 'profile') return <ProfileTabContent {...props} />;
  if (activeTab === 'security') return <SecurityTabContent {...props} />;
  if (activeTab === 'integrations') return <IntegrationsTabContent {...props} />;
  return (
    <PreferencesTab
      isLoading={props.isLoading}
      onSave={props.actions.handleUpdatePreferences}
      preferencesState={props.preferencesState}
      {...props.preferencesFieldHandlers}
    />
  );
};

/** Hook to manage all form states */
const useProfileFormStates = (profile: ProfileData | null) => {
  const [formState, setFormState] = useState<ProfileFormState>(INITIAL_FORM_STATE);
  const [preferencesState, setPreferencesState] =
    useState<PreferencesFormState>(INITIAL_PREFERENCES_STATE);
  const [githubState, setGithubState] = useState<GithubFormState>(INITIAL_GITHUB_STATE);
  useFormInitialization(profile, setFormState, setPreferencesState, setGithubState);
  return {
    formState,
    setFormState,
    preferencesState,
    setPreferencesState,
    githubState,
    setGithubState,
    handlers: {
      form: useFormFieldHandlers(setFormState),
      prefs: usePreferencesFieldHandlers(setPreferencesState),
      github: useGithubFieldHandlers(setGithubState),
    },
  };
};

interface ActionsConfigParams {
  profileHook: ReturnType<typeof useProfile>;
  forms: ReturnType<typeof useProfileFormStates>;
  profile: ProfileData | null;
  editMode: boolean;
  setEditMode: (v: boolean) => void;
  setFormError: (v: string) => void;
  setSuccess: (v: string | null) => void;
}

/** Build actions config from hooks */
const buildActionsConfig = (p: ActionsConfigParams) => ({
  formState: p.forms.formState,
  setFormState: p.forms.setFormState,
  preferencesState: p.forms.preferencesState,
  githubState: p.forms.githubState,
  profile: p.profile,
  editMode: p.editMode,
  setEditMode: p.setEditMode,
  setFormError: p.setFormError,
  setSuccess: p.setSuccess,
  clearError: p.profileHook.clearError,
  actions: {
    updateProfile: p.profileHook.updateProfile,
    changePassword: p.profileHook.changePassword,
    linkTelegram: p.profileHook.linkTelegram,
    unlinkTelegram: p.profileHook.unlinkTelegram,
    updatePreferences: p.profileHook.updatePreferences,
    githubResyncMutate: p.profileHook.mutations.githubResync.mutateAsync,
  },
});

export const UserProfile: FC<UserProfileProps> = ({ onClose }) => {
  const profileHook = useProfile();
  const { profile, isLoading, error, mutations } = profileHook;
  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const [editMode, setEditMode] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [formError, setFormError] = useState('');
  const forms = useProfileFormStates(profile);
  const actions = useProfileActionHandlers(
    buildActionsConfig({
      profileHook,
      forms,
      profile,
      editMode,
      setEditMode,
      setFormError,
      setSuccess,
    }),
  );

  if (isLoading && !profile) return <LoadingState />;
  if (!profile) return <NotFoundState onClose={onClose} />;

  return (
    <div className="min-h-screen bg-neutral-50 p-4 dark:bg-neutral-900">
      <div className="mx-auto max-w-4xl">
        <PageHeader onClose={onClose} />
        <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
        <MessageDisplay error={error || formError} success={success} />
        <TabContent
          actions={actions}
          activeTab={activeTab}
          editMode={editMode}
          formFieldHandlers={forms.handlers.form}
          formState={forms.formState}
          githubFieldHandlers={forms.handlers.github}
          githubState={forms.githubState}
          isLoading={isLoading}
          isResyncing={mutations.githubResync.isPending}
          preferencesFieldHandlers={forms.handlers.prefs}
          preferencesState={forms.preferencesState}
          profile={profile}
        />
      </div>
    </div>
  );
};
