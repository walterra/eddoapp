import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from './use_auth';
import {
  changePasswordApi,
  createAuthHeaders,
  emailResyncApi,
  fetchProfileApi,
  githubResyncApi,
  linkTelegramApi,
  rssResyncApi,
  unlinkTelegramApi,
  updatePreferencesApi,
  updateProfileApi,
} from './use_profile_api';
import type {
  ChangePasswordData,
  GithubResyncResponse,
  ProfileResult,
  UpdatePreferencesData,
  UpdateProfileData,
  UserProfile,
} from './use_profile_types';

export type {
  ProfileResult,
  UpdatePreferencesData,
  UserPreferences,
  UserProfile,
} from './use_profile_types';

/** Wrap async mutation with auth check and error handling */
async function wrapMutation<T>(
  authToken: string | undefined,
  mutation: { mutateAsync: (arg: T) => Promise<unknown> },
  arg: T,
): Promise<ProfileResult> {
  if (!authToken) return { success: false, error: 'No authentication token' };
  try {
    await mutation.mutateAsync(arg);
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/** Wrap no-arg mutation with auth check and error handling */
async function wrapMutationNoArg(
  authToken: string | undefined,
  mutation: { mutateAsync: () => Promise<unknown> },
): Promise<ProfileResult> {
  if (!authToken) return { success: false, error: 'No authentication token' };
  try {
    await mutation.mutateAsync();
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/** Create profile mutations */
function useProfileMutations(getAuthHeaders: () => HeadersInit, queryClient: QueryClient) {
  const invalidateProfile = () => queryClient.invalidateQueries({ queryKey: ['profile'] });
  return {
    updateProfile: useMutation({
      mutationFn: (data: UpdateProfileData) => updateProfileApi(getAuthHeaders(), data),
      onSuccess: invalidateProfile,
    }),
    changePassword: useMutation({
      mutationFn: (data: ChangePasswordData) => changePasswordApi(getAuthHeaders(), data),
    }),
    linkTelegram: useMutation({
      mutationFn: (telegramId: number) => linkTelegramApi(getAuthHeaders(), telegramId),
      onSuccess: invalidateProfile,
    }),
    unlinkTelegram: useMutation({
      mutationFn: () => unlinkTelegramApi(getAuthHeaders()),
      onSuccess: invalidateProfile,
    }),
    preferences: useMutation({
      mutationFn: (data: UpdatePreferencesData) => updatePreferencesApi(getAuthHeaders(), data),
      onSuccess: invalidateProfile,
    }),
    githubResync: useMutation<GithubResyncResponse, Error>({
      mutationFn: () => githubResyncApi(getAuthHeaders()),
      onSuccess: invalidateProfile,
    }),
    rssResync: useMutation({
      mutationFn: () => rssResyncApi(getAuthHeaders()),
      onSuccess: invalidateProfile,
    }),
    emailResync: useMutation({
      mutationFn: () => emailResyncApi(getAuthHeaders()),
      onSuccess: invalidateProfile,
    }),
  };
}

/** Hook for managing user profile data and mutations */
export const useProfile = () => {
  const { authToken } = useAuth();
  const queryClient = useQueryClient();
  const token = authToken?.token;

  const getAuthHeaders = (): HeadersInit => {
    if (!token) throw new Error('No authentication token available');
    return createAuthHeaders(token);
  };

  const profileQuery = useQuery({
    queryKey: ['profile'],
    queryFn: () => fetchProfileApi(getAuthHeaders()),
    enabled: !!token,
    retry: 1,
  });

  const mutations = useProfileMutations(getAuthHeaders, queryClient);
  const isLoading = profileQuery.isLoading || Object.values(mutations).some((m) => m.isPending);

  const clearError = () => {
    queryClient.resetQueries({ queryKey: ['profile'] });
    Object.values(mutations).forEach((m) => m.reset());
  };

  const fetchProfile = async () => {
    try {
      await profileQuery.refetch();
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  };

  return {
    profile: (profileQuery.data as UserProfile | null) ?? null,
    isLoading,
    error: profileQuery.error ? (profileQuery.error as Error).message : null,
    authToken: token ?? null,
    fetchProfile,
    updateProfile: (data: UpdateProfileData) => wrapMutation(token, mutations.updateProfile, data),
    changePassword: (data: ChangePasswordData) =>
      wrapMutation(token, mutations.changePassword, data),
    linkTelegram: (id: number) => wrapMutation(token, mutations.linkTelegram, id),
    unlinkTelegram: () => wrapMutationNoArg(token, mutations.unlinkTelegram),
    updatePreferences: (data: UpdatePreferencesData) =>
      wrapMutation(token, mutations.preferences, data),
    clearError,
    mutations,
  };
};
