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

export const useProfile = () => {
  const { authToken } = useAuth();
  const queryClient = useQueryClient();

  const getAuthHeaders = () => {
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
    isLoading,
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

  const updateProfile = async (
    updateData: UpdateProfileData,
  ): Promise<{ success: boolean; error?: string }> => {
    if (!authToken?.token) {
      return { success: false, error: 'No authentication token' };
    }

    try {
      const response = await fetch('/api/users/profile', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updateData),
      });

      if (response.ok) {
        // Invalidate and refetch profile
        await queryClient.invalidateQueries({ queryKey: ['profile'] });
        return { success: true };
      } else {
        const errorData = await response.json();
        const errorMessage = errorData.error || 'Failed to update profile';
        return { success: false, error: errorMessage };
      }
    } catch (_error) {
      const errorMessage = 'Network error occurred';
      return { success: false, error: errorMessage };
    }
  };

  const changePassword = async (
    passwordData: ChangePasswordData,
  ): Promise<{ success: boolean; error?: string }> => {
    if (!authToken?.token) {
      return { success: false, error: 'No authentication token' };
    }

    try {
      const response = await fetch('/api/users/change-password', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(passwordData),
      });

      if (response.ok) {
        return { success: true };
      } else {
        const errorData = await response.json();
        const errorMessage = errorData.error || 'Failed to change password';
        return { success: false, error: errorMessage };
      }
    } catch (_error) {
      const errorMessage = 'Network error occurred';
      return { success: false, error: errorMessage };
    }
  };

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
      const response = await fetch('/api/users/telegram-link', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ telegramId }),
      });

      if (response.ok) {
        // Invalidate and refetch profile
        await queryClient.invalidateQueries({ queryKey: ['profile'] });
        return { success: true };
      } else {
        const errorData = await response.json();
        const errorMessage = errorData.error || 'Failed to link Telegram';
        return { success: false, error: errorMessage };
      }
    } catch (_error) {
      const errorMessage = 'Network error occurred';
      return { success: false, error: errorMessage };
    }
  };

  const unlinkTelegram = async (): Promise<{
    success: boolean;
    error?: string;
  }> => {
    if (!authToken?.token) {
      return { success: false, error: 'No authentication token' };
    }

    try {
      const response = await fetch('/api/users/telegram-link', {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        // Invalidate and refetch profile
        await queryClient.invalidateQueries({ queryKey: ['profile'] });
        return { success: true };
      } else {
        const errorData = await response.json();
        const errorMessage = errorData.error || 'Failed to unlink Telegram';
        return { success: false, error: errorMessage };
      }
    } catch (_error) {
      const errorMessage = 'Network error occurred';
      return { success: false, error: errorMessage };
    }
  };

  // Update preferences using React Query mutation
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
      // Invalidate profile query to trigger refetch
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
    clearError: () => queryClient.resetQueries({ queryKey: ['profile'] }),
  };
};
