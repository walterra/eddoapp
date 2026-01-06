/**
 * Form state management for UserProfile component
 */
import { useState } from 'react';

import { initializeEmailState, useEmailFieldHandlers } from './user_profile_email_hooks';
import {
  useFormFieldHandlers,
  useFormInitialization,
  useGithubFieldHandlers,
  usePreferencesFieldHandlers,
  useRssFieldHandlers,
} from './user_profile_hooks';
import type {
  EmailFormState,
  GithubFormState,
  PreferencesFormState,
  UserProfile as ProfileData,
  ProfileFormState,
  RssFormState,
} from './user_profile_types';

export const INITIAL_FORM_STATE: ProfileFormState = {
  email: '',
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
  telegramId: '',
};

export const INITIAL_PREFERENCES_STATE: PreferencesFormState = {
  dailyBriefing: false,
  briefingTime: '07:00',
  printBriefing: false,
  dailyRecap: false,
  recapTime: '18:00',
  printRecap: false,
};

export const INITIAL_GITHUB_STATE: GithubFormState = {
  githubSync: false,
  githubToken: '',
  githubSyncInterval: 60,
  githubSyncTags: 'github, gtd:next',
};

export const INITIAL_RSS_STATE: RssFormState = {
  rssSync: false,
  rssSyncInterval: 60,
  rssSyncTags: 'gtd:someday, source:rss',
};

export const INITIAL_EMAIL_STATE: EmailFormState = {
  emailSync: false,
  emailFolder: 'eddo',
  emailSyncInterval: 15,
  emailSyncTags: 'source:email, gtd:next',
};

/** Hook to manage all form states */
export function useProfileFormStates(profile: ProfileData | null) {
  const [formState, setFormState] = useState<ProfileFormState>(INITIAL_FORM_STATE);
  const [preferencesState, setPreferencesState] =
    useState<PreferencesFormState>(INITIAL_PREFERENCES_STATE);
  const [githubState, setGithubState] = useState<GithubFormState>(INITIAL_GITHUB_STATE);
  const [rssState, setRssState] = useState<RssFormState>(INITIAL_RSS_STATE);
  const [emailState, setEmailState] = useState<EmailFormState>(INITIAL_EMAIL_STATE);

  useFormInitialization(profile, {
    setFormState,
    setPreferencesState,
    setGithubState,
    setRssState,
  });

  // Initialize email state separately since it's not in the main hook
  useState(() => {
    if (profile?.preferences) {
      setEmailState(initializeEmailState(profile.preferences));
    }
  });

  return {
    formState,
    setFormState,
    preferencesState,
    setPreferencesState,
    githubState,
    setGithubState,
    rssState,
    setRssState,
    emailState,
    setEmailState,
    handlers: {
      form: useFormFieldHandlers(setFormState),
      prefs: usePreferencesFieldHandlers(setPreferencesState),
      github: useGithubFieldHandlers(setGithubState),
      rss: useRssFieldHandlers(setRssState),
      email: useEmailFieldHandlers(setEmailState),
    },
  };
}
