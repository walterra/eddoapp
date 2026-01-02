import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from './use_auth';
import {
  changePasswordApi,
  createAuthHeaders,
  fetchProfileApi,
  githubResyncApi,
  linkTelegramApi,
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

/**
 * Hook for managing user profile data and mutations.
 * Uses TanStack Query for data fetching and mutations.
 */
export const useProfile = () => {
  const { authToken } = useAuth();
  const queryClient = useQueryClient();

  const getAuthHeaders = (): HeadersInit => {
    if (!authToken?.token) {
      throw new Error('No authentication token available');
    }
    return createAuthHeaders(authToken.token);
  };

  const profileQuery = useQuery({
    queryKey: ['profile'],
    queryFn: () => fetchProfileApi(getAuthHeaders()),
    enabled: !!authToken?.token,
    retry: 1,
  });

  const updateProfileMutation = useMutation({
    mutationFn: (data: UpdateProfileData) => updateProfileApi(getAuthHeaders(), data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile'] }),
  });

  const changePasswordMutation = useMutation({
    mutationFn: (data: ChangePasswordData) => changePasswordApi(getAuthHeaders(), data),
  });

  const linkTelegramMutation = useMutation({
    mutationFn: (telegramId: number) => linkTelegramApi(getAuthHeaders(), telegramId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile'] }),
  });

  const unlinkTelegramMutation = useMutation({
    mutationFn: () => unlinkTelegramApi(getAuthHeaders()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile'] }),
  });

  const preferencesMutation = useMutation({
    mutationFn: (data: UpdatePreferencesData) => updatePreferencesApi(getAuthHeaders(), data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile'] }),
  });

  const githubResyncMutation = useMutation<GithubResyncResponse, Error>({
    mutationFn: () => githubResyncApi(getAuthHeaders()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile'] }),
  });

  // Wrapper functions for backward compatibility
  const wrapMutation = async <T>(
    mutation: { mutateAsync: (arg: T) => Promise<unknown> },
    arg: T,
  ): Promise<ProfileResult> => {
    if (!authToken?.token) return { success: false, error: 'No authentication token' };
    try {
      await mutation.mutateAsync(arg);
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  };

  const wrapMutationNoArg = async (mutation: {
    mutateAsync: () => Promise<unknown>;
  }): Promise<ProfileResult> => {
    if (!authToken?.token) return { success: false, error: 'No authentication token' };
    try {
      await mutation.mutateAsync();
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  };

  const isLoading =
    profileQuery.isLoading ||
    updateProfileMutation.isPending ||
    changePasswordMutation.isPending ||
    linkTelegramMutation.isPending ||
    unlinkTelegramMutation.isPending ||
    preferencesMutation.isPending ||
    githubResyncMutation.isPending;

  const clearError = () => {
    queryClient.resetQueries({ queryKey: ['profile'] });
    updateProfileMutation.reset();
    changePasswordMutation.reset();
    linkTelegramMutation.reset();
    unlinkTelegramMutation.reset();
    preferencesMutation.reset();
    githubResyncMutation.reset();
  };

  return {
    profile: (profileQuery.data as UserProfile | null) ?? null,
    isLoading,
    error: profileQuery.error ? (profileQuery.error as Error).message : null,
    fetchProfile: async () => {
      try {
        await profileQuery.refetch();
        return { success: true };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
    updateProfile: (data: UpdateProfileData) => wrapMutation(updateProfileMutation, data),
    changePassword: (data: ChangePasswordData) => wrapMutation(changePasswordMutation, data),
    linkTelegram: (id: number) => wrapMutation(linkTelegramMutation, id),
    unlinkTelegram: () => wrapMutationNoArg(unlinkTelegramMutation),
    updatePreferences: (data: UpdatePreferencesData) => wrapMutation(preferencesMutation, data),
    clearError,
    mutations: {
      updateProfile: updateProfileMutation,
      changePassword: changePasswordMutation,
      linkTelegram: linkTelegramMutation,
      unlinkTelegram: unlinkTelegramMutation,
      preferences: preferencesMutation,
      githubResync: githubResyncMutation,
    },
  };
};
