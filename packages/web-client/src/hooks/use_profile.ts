import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from './use_auth';

interface UserPreferences {
  dailyBriefing: boolean;
  briefingTime?: string;
  printBriefing?: boolean;
  dailyRecap: boolean;
  recapTime?: string;
  printRecap?: boolean;
  timezone?: string;
  viewMode?: 'kanban' | 'table';
  tableColumns?: string[];
  selectedTags?: string[];
  selectedContexts?: string[];
  selectedStatus?: 'all' | 'completed' | 'incomplete';
  selectedTimeRange?: {
    type: 'current-day' | 'current-week' | 'current-month' | 'current-year' | 'all-time' | 'custom';
    startDate?: string;
    endDate?: string;
  };
  currentDate?: string;
  githubSync?: boolean;
  githubToken?: string | null;
  githubSyncInterval?: number;
  githubSyncTags?: string[];
  githubLastSync?: string;
  githubSyncStartedAt?: string;
}

interface UserProfile {
  userId: string;
  username: string;
  email: string;
  telegramId?: number;
  createdAt: string;
  updatedAt: string;
  permissions: string[];
  status: string;
  preferences: UserPreferences;
}

interface UpdateProfileData {
  email?: string;
  currentPassword?: string;
  newPassword?: string;
}

interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
}

interface UpdatePreferencesData {
  dailyBriefing?: boolean;
  briefingTime?: string;
  printBriefing?: boolean;
  dailyRecap?: boolean;
  recapTime?: string;
  printRecap?: boolean;
  timezone?: string;
  viewMode?: 'kanban' | 'table';
  tableColumns?: string[];
  selectedTags?: string[];
  selectedContexts?: string[];
  selectedStatus?: 'all' | 'completed' | 'incomplete';
  selectedTimeRange?: {
    type: 'current-day' | 'current-week' | 'current-month' | 'current-year' | 'all-time' | 'custom';
    startDate?: string;
    endDate?: string;
  };
  currentDate?: string;
  githubSync?: boolean;
  githubToken?: string | null;
  githubSyncInterval?: number;
  githubSyncTags?: string[];
}

interface GithubResyncResponse {
  message: string;
  synced: number;
  created: number;
  updated: number;
}

interface GithubResyncError {
  error: string;
  rateLimitError?: boolean;
  resetTime?: string;
}

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
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken.token}`,
    };
  };

  // Fetch profile using React Query
  const {
    data: profile,
    isLoading: isLoadingProfile,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: ['profile'],
    queryFn: async (): Promise<UserProfile> => {
      const response = await fetch('/api/users/profile', {
        method: 'GET',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch profile');
      }

      return response.json();
    },
    enabled: !!authToken?.token,
    retry: 1,
  });

  const error = queryError ? (queryError as Error).message : null;

  // Legacy fetchProfile for backward compatibility
  const fetchProfile = async (): Promise<{
    success: boolean;
    error?: string;
  }> => {
    try {
      await refetch();
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  };

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (updateData: UpdateProfileData) => {
      const response = await fetch('/api/users/profile', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update profile');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });

  const updateProfile = async (
    updateData: UpdateProfileData,
  ): Promise<{ success: boolean; error?: string }> => {
    if (!authToken?.token) {
      return { success: false, error: 'No authentication token' };
    }

    try {
      await updateProfileMutation.mutateAsync(updateData);
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  };

  // Change password mutation
  const changePasswordMutation = useMutation({
    mutationFn: async (passwordData: ChangePasswordData) => {
      const response = await fetch('/api/users/change-password', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(passwordData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to change password');
      }

      return response.json();
    },
  });

  const changePassword = async (
    passwordData: ChangePasswordData,
  ): Promise<{ success: boolean; error?: string }> => {
    if (!authToken?.token) {
      return { success: false, error: 'No authentication token' };
    }

    try {
      await changePasswordMutation.mutateAsync(passwordData);
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  };

  // Link Telegram mutation
  const linkTelegramMutation = useMutation({
    mutationFn: async (telegramId: number) => {
      const response = await fetch('/api/users/telegram-link', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ telegramId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to link Telegram');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });

  const linkTelegram = async (
    telegramId: number,
  ): Promise<{
    success: boolean;
    error?: string;
  }> => {
    if (!authToken?.token) {
      return { success: false, error: 'No authentication token' };
    }

    try {
      await linkTelegramMutation.mutateAsync(telegramId);
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  };

  // Unlink Telegram mutation
  const unlinkTelegramMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/users/telegram-link', {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to unlink Telegram');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });

  const unlinkTelegram = async (): Promise<{
    success: boolean;
    error?: string;
  }> => {
    if (!authToken?.token) {
      return { success: false, error: 'No authentication token' };
    }

    try {
      await unlinkTelegramMutation.mutateAsync();
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  };

  // Update preferences mutation
  const preferencesMutation = useMutation({
    mutationFn: async (preferencesData: UpdatePreferencesData) => {
      const response = await fetch('/api/users/preferences', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(preferencesData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update preferences');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });

  const updatePreferences = async (
    preferencesData: UpdatePreferencesData,
  ): Promise<{ success: boolean; error?: string }> => {
    if (!authToken) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      await preferencesMutation.mutateAsync(preferencesData);
      return { success: true };
    } catch (err) {
      const errorMessage = (err as Error).message || 'Failed to update preferences';
      return { success: false, error: errorMessage };
    }
  };

  // GitHub resync mutation
  const githubResyncMutation = useMutation<GithubResyncResponse, Error>({
    mutationFn: async () => {
      const response = await fetch('/api/users/github-resync', {
        method: 'POST',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData: GithubResyncError = await response.json();

        // Handle rate limit errors with reset time
        if (errorData.rateLimitError && errorData.resetTime) {
          throw new Error(`${errorData.error}\n\nYou can try again ${errorData.resetTime}.`);
        }

        throw new Error(errorData.error || 'Failed to resync GitHub issues');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });

  // Compute aggregate loading state
  const isLoading =
    isLoadingProfile ||
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
    profile: profile || null,
    isLoading,
    error,
    fetchProfile,
    updateProfile,
    changePassword,
    linkTelegram,
    unlinkTelegram,
    updatePreferences,
    clearError,
    // Expose mutations for direct access to isPending, isError, etc.
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
