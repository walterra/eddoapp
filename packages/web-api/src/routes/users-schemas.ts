/**
 * Zod validation schemas for user routes
 */
import { z } from 'zod';

export const updateProfileSchema = z.object({
  email: z.string().email().optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8).optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export const linkTelegramSchema = z.object({
  telegramId: z.number().int().positive(),
});

export const updatePreferencesSchema = z.object({
  dailyBriefing: z.boolean().optional(),
  briefingTime: z
    .string()
    .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .optional(),
  printBriefing: z.boolean().optional(),
  dailyRecap: z.boolean().optional(),
  recapTime: z
    .string()
    .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .optional(),
  printRecap: z.boolean().optional(),
  timezone: z.string().optional(),
  theme: z.enum(['system', 'light', 'dark']).optional(),
  viewMode: z.enum(['kanban', 'table', 'graph']).optional(),
  tableColumns: z.array(z.string()).optional(),
  activitySidebarOpen: z.boolean().optional(),
  selectedTags: z.array(z.string()).optional(),
  selectedContexts: z.array(z.string()).optional(),
  selectedStatus: z.enum(['all', 'completed', 'incomplete']).optional(),
  selectedTimeRange: z
    .object({
      type: z.enum([
        'current-day',
        'current-week',
        'current-month',
        'current-year',
        'all-time',
        'custom',
      ]),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    })
    .optional(),
  currentDate: z.string().optional(),
  githubSync: z.boolean().optional(),
  githubToken: z.string().nullable().optional(),
  githubSyncInterval: z.number().int().positive().optional(),
  githubSyncTags: z.array(z.string()).optional(),
  rssSync: z.boolean().optional(),
  rssFeeds: z
    .array(
      z.object({
        url: z.string(),
        feedUrl: z.string(),
        title: z.string().optional(),
        enabled: z.boolean(),
        addedAt: z.string(),
      }),
    )
    .optional(),
  rssSyncInterval: z.number().int().positive().optional(),
  rssSyncTags: z.array(z.string()).optional(),
  filterPresets: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        selectedTags: z.array(z.string()),
        selectedContexts: z.array(z.string()),
        selectedStatus: z.enum(['all', 'completed', 'incomplete']),
        selectedTimeRange: z.object({
          type: z.enum([
            'current-day',
            'current-week',
            'current-month',
            'current-year',
            'all-time',
            'custom',
          ]),
          startDate: z.string().optional(),
          endDate: z.string().optional(),
        }),
        dateMode: z.enum(['relative', 'fixed']),
        savedDate: z.string().optional(),
        createdAt: z.string(),
      }),
    )
    .optional(),
  aiProviderKeys: z
    .object({
      anthropicApiKey: z.string().optional(),
      openaiApiKey: z.string().optional(),
      geminiApiKey: z.string().optional(),
    })
    .optional(),
  mcpApiKey: z.string().nullable().optional(),
  mcpApiKeySetAt: z.string().optional(),
});
