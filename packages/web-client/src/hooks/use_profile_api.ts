/**
 * API functions for user profile operations
 */
import type {
  ChangePasswordData,
  GithubResyncError,
  GithubResyncResponse,
  UpdatePreferencesData,
  UpdateProfileData,
  UserProfile,
} from './use_profile_types';

/** Create authorization headers */
export function createAuthHeaders(token: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

/** Fetch user profile */
export async function fetchProfileApi(headers: HeadersInit): Promise<UserProfile> {
  const response = await fetch('/api/users/profile', {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to fetch profile');
  }

  return response.json();
}

/** Update user profile */
export async function updateProfileApi(
  headers: HeadersInit,
  data: UpdateProfileData,
): Promise<UserProfile> {
  const response = await fetch('/api/users/profile', {
    method: 'PUT',
    headers,
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to update profile');
  }

  return response.json();
}

/** Change user password */
export async function changePasswordApi(
  headers: HeadersInit,
  data: ChangePasswordData,
): Promise<void> {
  const response = await fetch('/api/users/change-password', {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to change password');
  }

  return response.json();
}

/** Link Telegram account */
export async function linkTelegramApi(headers: HeadersInit, telegramId: number): Promise<void> {
  const response = await fetch('/api/users/telegram-link', {
    method: 'POST',
    headers,
    body: JSON.stringify({ telegramId }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to link Telegram');
  }

  return response.json();
}

/** Unlink Telegram account */
export async function unlinkTelegramApi(headers: HeadersInit): Promise<void> {
  const response = await fetch('/api/users/telegram-link', {
    method: 'DELETE',
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to unlink Telegram');
  }

  return response.json();
}

/** Update user preferences */
export async function updatePreferencesApi(
  headers: HeadersInit,
  data: UpdatePreferencesData,
): Promise<void> {
  const response = await fetch('/api/users/preferences', {
    method: 'PUT',
    headers,
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to update preferences');
  }

  return response.json();
}

/** Resync GitHub issues */
export async function githubResyncApi(headers: HeadersInit): Promise<GithubResyncResponse> {
  const response = await fetch('/api/users/github-resync', {
    method: 'POST',
    headers,
  });

  if (!response.ok) {
    const errorData: GithubResyncError = await response.json();

    if (errorData.rateLimitError && errorData.resetTime) {
      throw new Error(`${errorData.error}\n\nYou can try again ${errorData.resetTime}.`);
    }

    throw new Error(errorData.error || 'Failed to resync GitHub issues');
  }

  return response.json();
}

export interface RssResyncResponse {
  success: boolean;
  message: string;
}

/** Resync RSS feeds */
export async function rssResyncApi(headers: HeadersInit): Promise<RssResyncResponse> {
  const response = await fetch('/api/users/rss-resync', {
    method: 'POST',
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to resync RSS feeds');
  }

  return response.json();
}

export interface EmailResyncResponse {
  success: boolean;
  message: string;
}

/** Resync emails */
export async function emailResyncApi(headers: HeadersInit): Promise<EmailResyncResponse> {
  const response = await fetch('/api/users/email-resync', {
    method: 'POST',
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to resync emails');
  }

  return response.json();
}
