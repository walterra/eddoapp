/**
 * User profile settings page component
 */
import { type FC, useState } from 'react';

import { useProfile } from '../hooks/use_profile';
import { useEmailFieldHandlers } from './user_profile_email_hooks';
import { useProfileFormStates } from './user_profile_form_state';
import {
  useFormFieldHandlers,
  useGithubFieldHandlers,
  usePreferencesFieldHandlers,
  useProfileActionHandlers,
  useRssFieldHandlers,
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
  EmailFormState,
  GithubFormState,
  PreferencesFormState,
  UserProfile as ProfileData,
  ProfileFormState,
  RssFormState,
} from './user_profile_types';

interface UserProfileProps {
  onClose?: () => void;
}

type TabType = 'profile' | 'security' | 'integrations' | 'preferences';

interface TabContentProps {
  activeTab: TabType;
  profile: ProfileData;
  isLoading: boolean;
  editMode: boolean;
  formState: ProfileFormState;
  preferencesState: PreferencesFormState;
  githubState: GithubFormState;
  rssState: RssFormState;
  emailState: EmailFormState;
  isResyncing: boolean;
  isRssResyncing: boolean;
  isEmailResyncing: boolean;
  actions: ReturnType<typeof useProfileActionHandlers>;
  formFieldHandlers: ReturnType<typeof useFormFieldHandlers>;
  preferencesFieldHandlers: ReturnType<typeof usePreferencesFieldHandlers>;
  githubFieldHandlers: ReturnType<typeof useGithubFieldHandlers>;
  rssFieldHandlers: ReturnType<typeof useRssFieldHandlers>;
  emailFieldHandlers: ReturnType<typeof useEmailFieldHandlers>;
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
    | 'rssState'
    | 'emailState'
    | 'isResyncing'
    | 'isRssResyncing'
    | 'isEmailResyncing'
    | 'actions'
    | 'formFieldHandlers'
    | 'githubFieldHandlers'
    | 'rssFieldHandlers'
    | 'emailFieldHandlers'
  >
> = (p) => (
  <IntegrationsTab
    emailState={p.emailState}
    githubState={p.githubState}
    isEmailResyncing={p.isEmailResyncing}
    isLoading={p.isLoading}
    isResyncing={p.isResyncing}
    isRssResyncing={p.isRssResyncing}
    onAddRssFeed={p.actions.handleAddRssFeed}
    onConnectGmail={p.actions.handleConnectGmail}
    onDisconnectEmail={p.actions.handleDisconnectEmail}
    onForceEmailResync={p.actions.handleForceEmailResync}
    onForceResync={p.actions.handleForceResync}
    onForceRssResync={p.actions.handleForceRssResync}
    onLinkTelegram={p.actions.handleLinkTelegram}
    onRemoveRssFeed={p.actions.handleRemoveRssFeed}
    onSaveAiKeys={p.actions.handleSaveAiKeys}
    onSaveEmail={p.actions.handleUpdateEmailPreferences}
    onSaveGithub={p.actions.handleUpdateGithubPreferences}
    onSaveRss={p.actions.handleUpdateRssPreferences}
    onTelegramIdChange={p.formFieldHandlers.onTelegramIdChange}
    onUnlinkTelegram={p.actions.handleUnlinkTelegram}
    profile={p.profile}
    rssState={p.rssState}
    telegramId={p.formState.telegramId}
    {...p.githubFieldHandlers}
    {...p.rssFieldHandlers}
    {...p.emailFieldHandlers}
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
  rssState: p.forms.rssState,
  emailState: p.forms.emailState,
  profile: p.profile,
  authToken: p.profileHook.authToken,
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
    rssResyncMutate: p.profileHook.mutations.rssResync.mutateAsync,
    emailResyncMutate: p.profileHook.mutations.emailResync?.mutateAsync || (async () => {}),
  },
});

interface TabPropsParams {
  profile: ProfileData;
  isLoading: boolean;
  mutations: ReturnType<typeof useProfile>['mutations'];
  forms: ReturnType<typeof useProfileFormStates>;
  actions: ReturnType<typeof useProfileActionHandlers>;
  activeTab: TabType;
  editMode: boolean;
}

/** Build tab content props from profile state */
function buildTabProps(p: TabPropsParams): TabContentProps {
  return {
    activeTab: p.activeTab,
    profile: p.profile,
    isLoading: p.isLoading,
    editMode: p.editMode,
    formState: p.forms.formState,
    preferencesState: p.forms.preferencesState,
    githubState: p.forms.githubState,
    rssState: p.forms.rssState,
    emailState: p.forms.emailState,
    isResyncing: p.mutations.githubResync.isPending,
    isRssResyncing: p.mutations.rssResync.isPending,
    isEmailResyncing: p.mutations.emailResync?.isPending || false,
    actions: p.actions,
    formFieldHandlers: p.forms.handlers.form,
    preferencesFieldHandlers: p.forms.handlers.prefs,
    githubFieldHandlers: p.forms.handlers.github,
    rssFieldHandlers: p.forms.handlers.rss,
    emailFieldHandlers: p.forms.handlers.email,
  };
}

export const UserProfile: FC<UserProfileProps> = ({ onClose }) => {
  const profileHook = useProfile();
  const { profile, isLoading, error, mutations } = profileHook;
  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const [editMode, setEditMode] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [formError, setFormError] = useState('');
  const forms = useProfileFormStates(profile);
  const actionsConfig = buildActionsConfig({
    profileHook,
    forms,
    profile,
    editMode,
    setEditMode,
    setFormError,
    setSuccess,
  });
  const actions = useProfileActionHandlers(actionsConfig);

  if (isLoading && !profile) return <LoadingState />;
  if (!profile) return <NotFoundState onClose={onClose} />;

  const tabProps = buildTabProps({
    profile,
    isLoading,
    mutations,
    forms,
    actions,
    activeTab,
    editMode,
  });

  return (
    <div className="min-h-screen bg-neutral-50 p-4 dark:bg-neutral-900">
      <div className="mx-auto max-w-4xl">
        <PageHeader onClose={onClose} />
        <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
        <MessageDisplay error={error || formError} success={success} />
        <TabContent {...tabProps} />
      </div>
    </div>
  );
};
