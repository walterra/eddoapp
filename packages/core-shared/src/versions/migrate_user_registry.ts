import isNil from 'lodash-es/isNil';

import {
  type UserPermissions,
  type UserRegistryEntryAlpha1,
  type UserStatus,
  isUserRegistryEntryAlpha1,
} from './user_registry_alpha1';
import {
  type UserRegistryEntryAlpha2,
  createDefaultUserPreferences,
  isUserRegistryEntryAlpha2,
} from './user_registry_alpha2';

type UnknownObject = Record<string, unknown> | { [key: string]: unknown };

export function isLatestUserRegistryVersion(entry: unknown): entry is UserRegistryEntryAlpha2 {
  return isUserRegistryEntryAlpha2(entry);
}

export function migrateUserRegistryEntry(entry: unknown): UserRegistryEntryAlpha2 {
  if (isUserRegistryEntryAlpha2(entry)) {
    return entry;
  }

  if (isUserRegistryEntryAlpha1(entry)) {
    return migrateAlpha1ToAlpha2(entry);
  }

  // Handle legacy entries without version field
  if (isLegacyUserRegistryEntry(entry)) {
    return migrateAlpha1ToAlpha2(migrateLegacyToAlpha1(entry as UnknownObject));
  }

  throw new Error('invalid user registry entry');
}

function isLegacyUserRegistryEntry(arg: unknown): boolean {
  return (
    typeof arg === 'object' &&
    !isNil(arg) &&
    'username' in arg &&
    typeof (arg as UnknownObject).username === 'string' &&
    !('version' in arg)
  );
}

function migrateAlpha1ToAlpha2(entry: UserRegistryEntryAlpha1): UserRegistryEntryAlpha2 {
  const now = new Date().toISOString();

  return {
    ...entry,
    preferences: createDefaultUserPreferences(),
    updated_at: now,
    version: 'alpha2',
  };
}

function migrateLegacyToAlpha1(entry: UnknownObject): UserRegistryEntryAlpha1 {
  const now = new Date().toISOString();

  return {
    _id: (entry._id as string) || `user_${entry.username}`,
    _rev: entry._rev as string | undefined,
    telegram_id: entry.telegram_id as number | undefined,
    username: entry.username as string,
    email: (entry.email as string) || '',
    password_hash: (entry.password_hash as string) || '',
    database_name: (entry.database_name as string) || `eddo_user_${entry.username}`,
    created_at: (entry.created_at as string) || now,
    updated_at: (entry.updated_at as string) || now,
    permissions: (entry.permissions as UserPermissions) || ['read', 'write'],
    status: (entry.status as UserStatus) || 'active',
    version: 'alpha1',
  };
}
