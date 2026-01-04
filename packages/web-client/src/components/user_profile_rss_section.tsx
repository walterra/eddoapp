/**
 * RSS feed sync section for UserProfile
 */
import { type RssFeedConfig } from '@eddo/core-shared';
import { Button, Label, TextInput } from 'flowbite-react';
import { type FC, useState } from 'react';

import { ToggleSwitch } from './toggle_switch';
import { formatDate, type RssFormState, SYNC_INTERVAL_OPTIONS } from './user_profile_types';

interface RssIntervalSelectProps {
  disabled: boolean;
  value: number;
  onChange: (interval: number) => void;
}

const RssIntervalSelect: FC<RssIntervalSelectProps> = ({ disabled, value, onChange }) => (
  <div>
    <Label htmlFor="rssSyncInterval">Sync Interval</Label>
    <select
      className="focus:border-primary-500 focus:ring-primary-500 block w-full rounded-lg border border-neutral-300 bg-neutral-50 p-2.5 text-sm text-neutral-900 dark:border-neutral-600 dark:bg-neutral-800 dark:text-white"
      disabled={disabled}
      id="rssSyncInterval"
      onChange={(e) => onChange(Number(e.target.value))}
      value={value}
    >
      {SYNC_INTERVAL_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
    <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
      How often to check for new feed items.
    </p>
  </div>
);

interface RssTagsInputProps {
  disabled: boolean;
  value: string;
  onChange: (tags: string) => void;
}

const RssTagsInput: FC<RssTagsInputProps> = ({ disabled, value, onChange }) => (
  <div>
    <Label htmlFor="rssSyncTags">Tags</Label>
    <TextInput
      disabled={disabled}
      id="rssSyncTags"
      onChange={(e) => onChange(e.target.value)}
      placeholder="gtd:someday, source:rss"
      type="text"
      value={value}
    />
    <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
      Comma-separated tags to add to synced todos
    </p>
  </div>
);

export interface RssSectionProps {
  isLoading: boolean;
  isResyncing: boolean;
  lastSync?: string;
  rssState: RssFormState;
  feeds: RssFeedConfig[];
  onRssSyncChange: (enabled: boolean) => void;
  onRssIntervalChange: (interval: number) => void;
  onRssTagsChange: (tags: string) => void;
  onAddFeed: (url: string) => Promise<void>;
  onRemoveFeed: (index: number) => Promise<void>;
  onForceResync: () => Promise<void>;
  onSaveRss: () => Promise<void>;
}

const RssHeader: FC = () => (
  <div>
    <h3 className="font-medium text-neutral-900 dark:text-white">RSS Feed Sync</h3>
    <p className="text-sm text-neutral-600">
      Automatically sync RSS/Atom feed items as todos. Items are added to the &quot;read-later&quot;
      context.
    </p>
  </div>
);

interface RssSyncToggleProps {
  checked: boolean;
  disabled: boolean;
  onChange: (enabled: boolean) => void;
}

const RssSyncToggle: FC<RssSyncToggleProps> = ({ checked, disabled, onChange }) => (
  <div className="flex items-center justify-between">
    <div>
      <Label>Enable RSS Sync</Label>
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        Sync feed items to todos automatically
      </p>
    </div>
    <ToggleSwitch checked={checked} disabled={disabled} onChange={onChange} />
  </div>
);

interface AddFeedFormProps {
  disabled: boolean;
  onAddFeed: (url: string) => Promise<void>;
}

const AddFeedForm: FC<AddFeedFormProps> = ({ disabled, onAddFeed }) => {
  const [url, setUrl] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = async () => {
    if (!url.trim()) return;
    setIsAdding(true);
    try {
      await onAddFeed(url.trim());
      setUrl('');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div>
      <Label htmlFor="newFeedUrl">Add Feed</Label>
      <div className="flex gap-2">
        <TextInput
          className="flex-1"
          disabled={disabled || isAdding}
          id="newFeedUrl"
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="https://example.com or feed URL"
          type="url"
          value={url}
        />
        <Button color="blue" disabled={disabled || isAdding || !url.trim()} onClick={handleAdd}>
          {isAdding ? 'Adding...' : 'Add'}
        </Button>
      </div>
      <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
        Enter any website URL - we auto-detect the RSS feed
      </p>
    </div>
  );
};

interface FeedListProps {
  feeds: RssFeedConfig[];
  disabled: boolean;
  onRemove: (index: number) => Promise<void>;
}

const FeedList: FC<FeedListProps> = ({ feeds, disabled, onRemove }) => {
  const [removingIndex, setRemovingIndex] = useState<number | null>(null);

  const handleRemove = async (index: number) => {
    setRemovingIndex(index);
    try {
      await onRemove(index);
    } finally {
      setRemovingIndex(null);
    }
  };

  if (feeds.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-neutral-300 p-4 text-center text-sm text-neutral-500 dark:border-neutral-600">
        No feeds added yet. Add a feed URL above to get started.
      </div>
    );
  }

  return (
    <div>
      <Label>Subscribed Feeds ({feeds.length})</Label>
      <div className="mt-2 space-y-2">
        {feeds.map((feed, index) => (
          <div
            className="flex items-center justify-between rounded-lg border bg-neutral-50 p-3 dark:border-neutral-600 dark:bg-neutral-800"
            key={feed.feedUrl}
          >
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium text-neutral-900 dark:text-white">
                {feed.title || 'Untitled Feed'}
              </div>
              <div className="truncate text-xs text-neutral-500">{feed.url}</div>
            </div>
            <Button
              color="gray"
              disabled={disabled || removingIndex === index}
              onClick={() => handleRemove(index)}
              size="xs"
            >
              {removingIndex === index ? '...' : 'Remove'}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};

interface RssActionsProps {
  isLoading: boolean;
  isResyncing: boolean;
  syncEnabled: boolean;
  onForceResync: () => Promise<void>;
  onSaveRss: () => Promise<void>;
}

const RssActions: FC<RssActionsProps> = ({
  isLoading,
  isResyncing,
  syncEnabled,
  onForceResync,
  onSaveRss,
}) => (
  <div className="flex justify-between gap-4 border-t pt-4">
    <Button color="gray" disabled={isResyncing || !syncEnabled} onClick={onForceResync}>
      {isResyncing ? 'Resyncing...' : 'Force Resync'}
    </Button>
    <Button color="blue" disabled={isLoading} onClick={onSaveRss}>
      {isLoading ? 'Saving...' : 'Save RSS Settings'}
    </Button>
  </div>
);

export const RssSection: FC<RssSectionProps> = ({
  isLoading,
  isResyncing,
  lastSync,
  rssState,
  feeds,
  onRssSyncChange,
  onRssIntervalChange,
  onRssTagsChange,
  onAddFeed,
  onRemoveFeed,
  onForceResync,
  onSaveRss,
}) => (
  <div className="rounded-lg border p-4">
    <div className="space-y-4">
      <RssHeader />
      <RssSyncToggle checked={rssState.rssSync} disabled={isLoading} onChange={onRssSyncChange} />
      <AddFeedForm disabled={isLoading} onAddFeed={onAddFeed} />
      <FeedList disabled={isLoading} feeds={feeds} onRemove={onRemoveFeed} />
      <RssIntervalSelect
        disabled={!rssState.rssSync || isLoading}
        onChange={onRssIntervalChange}
        value={rssState.rssSyncInterval}
      />
      <RssTagsInput
        disabled={!rssState.rssSync || isLoading}
        onChange={onRssTagsChange}
        value={rssState.rssSyncTags}
      />
      {lastSync && (
        <div className="text-sm text-neutral-600">
          <strong>Last sync:</strong> {formatDate(lastSync)}
        </div>
      )}
      <RssActions
        isLoading={isLoading}
        isResyncing={isResyncing}
        onForceResync={onForceResync}
        onSaveRss={onSaveRss}
        syncEnabled={rssState.rssSync}
      />
    </div>
  </div>
);
