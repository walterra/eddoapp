/**
 * RSS-specific hooks for UserProfile
 */
import { useCallback } from 'react';

import type { ProfileResult } from '../hooks/use_profile_types';
import { buildRssUpdateData } from './user_profile_handlers';
import type { RssFeedConfigUI, RssFormState, UserProfile } from './user_profile_types';

interface RssActionsConfig {
  rssState: RssFormState;
  profile: UserProfile | null;
  authToken: string | null;
  setFormError: (error: string) => void;
  setSuccess: (success: string | null) => void;
  updatePreferences: (data: Record<string, unknown>) => Promise<ProfileResult>;
}

interface DiscoveredFeed {
  url: string;
  title?: string;
  type: string;
}

interface DiscoverResult {
  success: boolean;
  feeds?: DiscoveredFeed[];
  error?: string;
}

/**
 * Discovers RSS feed from URL via API
 */
async function discoverFeedFromUrl(url: string, authToken: string): Promise<DiscoverResult> {
  const response = await fetch('/api/rss/discover', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    return { success: false, error: `Request failed: ${response.status}` };
  }

  return response.json();
}

/**
 * Creates handler for updating RSS preferences
 */
function useUpdateRssPreferencesHandler(config: RssActionsConfig) {
  const { rssState, setFormError, setSuccess, updatePreferences } = config;

  return useCallback(async () => {
    setFormError('');
    setSuccess(null);
    const result = await updatePreferences(buildRssUpdateData(rssState));
    if (result.success) setSuccess('RSS sync settings updated successfully');
    else setFormError(result.error || 'Failed to update RSS sync settings');
  }, [rssState, setFormError, setSuccess, updatePreferences]);
}

/**
 * Creates new feed object from discovered feed
 */
function createFeedConfig(url: string, discoveredFeed: DiscoveredFeed): RssFeedConfigUI {
  return {
    url,
    feedUrl: discoveredFeed.url,
    title: discoveredFeed.title,
    enabled: true,
    addedAt: new Date().toISOString(),
  };
}

/**
 * Validates and processes discovered feed
 */
function validateDiscoveredFeed(
  result: DiscoverResult,
  existingFeeds: RssFeedConfigUI[],
): { feed?: DiscoveredFeed; error?: string } {
  if (!result.success || !result.feeds?.length) {
    return { error: result.error || 'No RSS feed found at this URL' };
  }
  const feed = result.feeds[0];
  if (existingFeeds.some((f) => f.feedUrl === feed.url)) {
    return { error: 'This feed is already subscribed' };
  }
  return { feed };
}

/**
 * Handles the actual feed addition process
 */
async function processAddFeed(
  url: string,
  existingFeeds: RssFeedConfigUI[],
  authToken: string,
  updatePreferences: (data: Record<string, unknown>) => Promise<ProfileResult>,
): Promise<{ success: boolean; title?: string; error?: string }> {
  const result = await discoverFeedFromUrl(url, authToken);
  const { feed, error } = validateDiscoveredFeed(result, existingFeeds);

  if (error || !feed) {
    return { success: false, error: error || 'Failed to discover feed' };
  }

  const newFeed = createFeedConfig(url, feed);
  const updateResult = await updatePreferences({ rssFeeds: [...existingFeeds, newFeed] });

  if (updateResult.success) {
    return { success: true, title: feed.title };
  }
  return { success: false, error: updateResult.error || 'Failed to add feed' };
}

/**
 * Creates handler for adding RSS feed
 */
function useAddRssFeedHandler(config: RssActionsConfig) {
  const { profile, authToken, setFormError, setSuccess, updatePreferences } = config;

  return useCallback(
    async (url: string) => {
      setFormError('');
      setSuccess(null);
      if (!authToken) {
        setFormError('Not authenticated');
        return;
      }
      try {
        const existingFeeds: RssFeedConfigUI[] = profile?.preferences?.rssFeeds || [];
        const result = await processAddFeed(url, existingFeeds, authToken, updatePreferences);

        if (result.success) {
          setSuccess(`Feed "${result.title || 'Untitled'}" added successfully`);
        } else {
          setFormError(result.error || 'Failed to add feed');
        }
      } catch (err) {
        setFormError((err as Error).message || 'Failed to discover feed');
      }
    },
    [profile?.preferences?.rssFeeds, authToken, setFormError, setSuccess, updatePreferences],
  );
}

/**
 * Creates handler for removing RSS feed
 */
function useRemoveRssFeedHandler(config: RssActionsConfig) {
  const { profile, setFormError, setSuccess, updatePreferences } = config;

  return useCallback(
    async (index: number) => {
      setFormError('');
      setSuccess(null);
      const existingFeeds: RssFeedConfigUI[] = profile?.preferences?.rssFeeds || [];
      const removedFeed = existingFeeds[index];
      const updatedFeeds = existingFeeds.filter((_, i) => i !== index);

      const result = await updatePreferences({ rssFeeds: updatedFeeds });

      if (result.success) {
        setSuccess(`Feed "${removedFeed?.title || 'Untitled'}" removed`);
      } else {
        setFormError(result.error || 'Failed to remove feed');
      }
    },
    [profile?.preferences?.rssFeeds, setFormError, setSuccess, updatePreferences],
  );
}

/**
 * Creates all RSS action handlers
 */
export function useRssActionHandlers(config: RssActionsConfig) {
  const handleUpdateRssPreferences = useUpdateRssPreferencesHandler(config);
  const handleAddRssFeed = useAddRssFeedHandler(config);
  const handleRemoveRssFeed = useRemoveRssFeedHandler(config);

  return { handleUpdateRssPreferences, handleAddRssFeed, handleRemoveRssFeed };
}
