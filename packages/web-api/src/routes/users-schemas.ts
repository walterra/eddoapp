/** Validates user route payloads and projects supported preference fields. */
import { isValidTimeZone } from '@eddo/core-shared';
import { emailSchema, validateMinimumTextLength } from '@eddo/core-shared/validation/compatibility';
import { createProjectedParser } from '@eddo/core-shared/validation/projected_parser';
import {
  arr,
  bool,
  int,
  nullable,
  obj,
  oneOf,
  opt,
  str,
} from '@eddo/core-shared/validation/schema_parser';

export const updateProfileSchema = createProjectedParser(
  obj({ email: opt(emailSchema()), currentPassword: opt(str()), newPassword: opt(str()) }),
  {
    validate: (value) =>
      value.newPassword === undefined
        ? []
        : validateMinimumTextLength(value.newPassword, 8, '/newPassword'),
  },
);
export const changePasswordSchema = createProjectedParser(
  obj({ currentPassword: str({ minLength: 1 }), newPassword: str() }),
  { validate: (value) => validateMinimumTextLength(value.newPassword, 8, '/newPassword') },
);
export const linkTelegramSchema = createProjectedParser(obj({ telegramId: int({ minimum: 1 }) }));
const timeRange = obj({
  type: oneOf([
    'current-day',
    'current-week',
    'current-month',
    'current-year',
    'all-time',
    'custom',
  ]),
  startDate: opt(str()),
  endDate: opt(str()),
});
const status = oneOf(['all', 'completed', 'incomplete']);
const tracking = oneOf(['all', 'tracking', 'not-tracking']);
const scheduledTime = str({ pattern: '^([01]?[0-9]|2[0-3]):[0-5][0-9]$' });
const filterPreset = obj({
  id: str(),
  name: str(),
  selectedTags: arr(str()),
  selectedContexts: arr(str()),
  selectedStatus: status,
  selectedTimeTracking: opt(tracking),
  selectedTimeRange: timeRange,
  dateMode: oneOf(['relative', 'fixed']),
  savedDate: opt(str()),
  createdAt: str(),
});

export const updatePreferencesSchema = createProjectedParser(
  obj({
    dailyBriefing: opt(bool()),
    briefingTime: opt(scheduledTime),
    printBriefing: opt(bool()),
    dailyRecap: opt(bool()),
    recapTime: opt(scheduledTime),
    printRecap: opt(bool()),
    timezone: opt(str()),
    theme: opt(oneOf(['system', 'light', 'dark'])),
    viewMode: opt(oneOf(['kanban', 'table', 'graph'])),
    tableColumns: opt(arr(str())),
    activitySidebarOpen: opt(bool()),
    selectedTags: opt(arr(str())),
    selectedContexts: opt(arr(str())),
    selectedStatus: opt(status),
    selectedTimeTracking: opt(tracking),
    selectedTimeRange: opt(timeRange),
    currentDate: opt(str()),
    githubSync: opt(bool()),
    githubToken: opt(nullable(str())),
    githubSyncInterval: opt(int({ minimum: 1 })),
    githubSyncTags: opt(arr(str())),
    rssSync: opt(bool()),
    rssFeeds: opt(
      arr(
        obj({
          url: str(),
          feedUrl: str(),
          title: opt(str()),
          enabled: bool(),
          addedAt: str(),
        }),
      ),
    ),
    rssSyncInterval: opt(int({ minimum: 1 })),
    rssSyncTags: opt(arr(str())),
    filterPresets: opt(arr(filterPreset)),
    aiProviderKeys: opt(
      obj({ anthropicApiKey: opt(str()), openaiApiKey: opt(str()), geminiApiKey: opt(str()) }),
    ),
    mcpApiKey: opt(nullable(str())),
    mcpApiKeySetAt: opt(str()),
  }),
  {
    validate: (value) =>
      value.timezone === undefined || isValidTimeZone(value.timezone)
        ? []
        : [{ path: '/timezone', code: 'custom', message: 'Invalid IANA timezone' }],
  },
);
