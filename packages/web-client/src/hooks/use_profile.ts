import { useEffect, useState } from 'react';

import { useAuth } from './use_auth';

interface UserPreferences {
  dailyBriefing: boolean;
  briefingTime?: string;
  timezone?: string;
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
  timezone?: string;
}

export const useProfile = () => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { authToken } = useAuth();

  const getAuthHeaders = () => {
    if (!authToken?.token) {
      throw new Error('No authentication token available');
    }
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken.token}`,
    };
  };

  const fetchProfile = async (): Promise<{
    success: boolean;
    error?: string;
  }> => {
    if (!authToken?.token) {
      return { success: false, error: 'No authentication token' };
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/users/profile', {
        method: 'GET',
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const profileData = await response.json();
        setProfile(profileData);
        return { success: true };
      } else {
        const errorData = await response.json();
        const errorMessage = errorData.error || 'Failed to fetch profile';
        setError(errorMessage);
        return { success: false, error: errorMessage };
      }
    } catch (_error) {
      const errorMessage = 'Network error occurred';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = async (
    updateData: UpdateProfileData,
  ): Promise<{ success: boolean; error?: string }> => {
    if (!authToken?.token) {
      return { success: false, error: 'No authentication token' };
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/users/profile', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updateData),
      });

      if (response.ok) {
        // Refetch profile to get updated data
        await fetchProfile();
        return { success: true };
      } else {
        const errorData = await response.json();
        const errorMessage = errorData.error || 'Failed to update profile';
        setError(errorMessage);
        return { success: false, error: errorMessage };
      }
    } catch (_error) {
      const errorMessage = 'Network error occurred';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  const changePassword = async (
    passwordData: ChangePasswordData,
  ): Promise<{ success: boolean; error?: string }> => {
    if (!authToken?.token) {
      return { success: false, error: 'No authentication token' };
    }

    setIsLoading(true);
    setError(null);

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
        setError(errorMessage);
        return { success: false, error: errorMessage };
      }
    } catch (_error) {
      const errorMessage = 'Network error occurred';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
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

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/users/telegram-link', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ telegramId }),
      });

      if (response.ok) {
        // Refetch profile to get updated data
        await fetchProfile();
        return { success: true };
      } else {
        const errorData = await response.json();
        const errorMessage = errorData.error || 'Failed to link Telegram';
        setError(errorMessage);
        return { success: false, error: errorMessage };
      }
    } catch (_error) {
      const errorMessage = 'Network error occurred';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  const unlinkTelegram = async (): Promise<{
    success: boolean;
    error?: string;
  }> => {
    if (!authToken?.token) {
      return { success: false, error: 'No authentication token' };
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/users/telegram-link', {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        // Refetch profile to get updated data
        await fetchProfile();
        return { success: true };
      } else {
        const errorData = await response.json();
        const errorMessage = errorData.error || 'Failed to unlink Telegram';
        setError(errorMessage);
        return { success: false, error: errorMessage };
      }
    } catch (_error) {
      const errorMessage = 'Network error occurred';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  const updatePreferences = async (
    preferencesData: UpdatePreferencesData,
  ): Promise<{ success: boolean; error?: string }> => {
    if (!authToken) {
      return { success: false, error: 'Not authenticated' };
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/users/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken.token}`,
        },
        body: JSON.stringify(preferencesData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.error || 'Failed to update preferences';
        setError(errorMessage);
        return { success: false, error: errorMessage };
      }

      // Refresh profile to get updated data
      await fetchProfile();
      return { success: true };
    } catch (error) {
      console.error('Preferences update error:', error);
      const errorMessage = 'Network error occurred';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch profile when auth token changes
  useEffect(() => {
    if (authToken?.token) {
      fetchProfile();
    } else {
      setProfile(null);
      setError(null);
    }
  }, [authToken?.token]);

  return {
    profile,
    isLoading,
    error,
    fetchProfile,
    updateProfile,
    changePassword,
    linkTelegram,
    unlinkTelegram,
    updatePreferences,
    clearError: () => setError(null),
  };
};
