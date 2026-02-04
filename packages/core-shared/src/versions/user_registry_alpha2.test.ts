import { describe, expect, it } from 'vitest';

import {
  createDefaultUserPreferences,
  isUserRegistryEntryAlpha2,
  type UserPreferences,
  type UserRegistryEntryAlpha2,
} from './user_registry_alpha2';

describe('UserRegistryAlpha2', () => {
  describe('UserPreferences', () => {
    it('should include GitHub sync fields', () => {
      const preferences: UserPreferences = createDefaultUserPreferences();

      expect(preferences).toHaveProperty('githubSync');
      expect(preferences).toHaveProperty('githubToken');
      expect(preferences).toHaveProperty('githubSyncInterval');
      expect(preferences).toHaveProperty('githubSyncTags');
      expect(preferences).toHaveProperty('githubLastSync');
      expect(preferences).toHaveProperty('githubSyncStartedAt');
      expect(preferences).toHaveProperty('mcpApiKey');
    });

    it('should have correct default values for GitHub sync', () => {
      const preferences: UserPreferences = createDefaultUserPreferences();

      expect(preferences.githubSync).toBe(false);
      expect(preferences.githubToken).toBe(null);
      expect(preferences.githubSyncInterval).toBe(60);
      expect(preferences.githubSyncTags).toEqual(['github', 'gtd:next']);
      expect(preferences.githubLastSync).toBeUndefined();
      expect(preferences.githubSyncStartedAt).toBeUndefined();
      expect(preferences.mcpApiKey).toBeNull();
    });

    it('should allow GitHub sync configuration', () => {
      const preferences: UserPreferences = {
        ...createDefaultUserPreferences(),
        githubSync: true,
        githubToken: 'ghp_test_token_12345',
        githubSyncInterval: 30,
        githubSyncTags: ['github', 'external'],
        githubLastSync: '2025-12-21T09:00:00.000Z',
      };

      expect(preferences.githubSync).toBe(true);
      expect(preferences.githubToken).toBe('ghp_test_token_12345');
      expect(preferences.githubSyncInterval).toBe(30);
      expect(preferences.githubSyncTags).toEqual(['github', 'external']);
      expect(preferences.githubLastSync).toBe('2025-12-21T09:00:00.000Z');
    });
  });

  describe('isUserRegistryEntryAlpha2', () => {
    it('should return true for valid alpha2 entry', () => {
      const entry: UserRegistryEntryAlpha2 = {
        _id: 'user:test',
        _rev: '1-abc',
        username: 'test',
        email: 'test@example.com',
        password_hash: 'hash',
        database_name: 'eddo_user_test',
        status: 'active',
        permissions: ['read', 'write'],
        created_at: '2025-12-21T09:00:00.000Z',
        updated_at: '2025-12-21T09:00:00.000Z',
        preferences: createDefaultUserPreferences(),
        version: 'alpha2',
      };

      expect(isUserRegistryEntryAlpha2(entry)).toBe(true);
    });

    it('should return false for non-alpha2 entry', () => {
      const entry = {
        _id: 'user:test',
        version: 'alpha1',
      };

      expect(isUserRegistryEntryAlpha2(entry)).toBe(false);
    });

    it('should return false for null', () => {
      expect(isUserRegistryEntryAlpha2(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isUserRegistryEntryAlpha2(undefined)).toBe(false);
    });
  });
});
