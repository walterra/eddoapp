# User Registry for Multi-Tenant CouchDB Architecture

## Overview

This document outlines the implementation plan for a user registry system that enables per-user data isolation in the eddo Telegram bot using CouchDB best practices. The goal is to map Telegram user IDs to human-readable eddo usernames and provide complete data isolation between users.

## Current State Analysis

### What Exists

- **Infrastructure**: UserContextManager and per-user database support already implemented
- **Authentication**: Telegram user ID allowlist-based authentication
- **Database Pattern**: Support for `${baseName}_user_${userId}` naming
- **MCP Server**: Handles per-request authentication with API keys

### What's Missing

- **No User Mapping**: Telegram IDs aren't mapped to eddo usernames
- **Shared Database**: All authenticated users share the same database
- **No Per-User API Keys**: Single MCP API key for all users
- **No User Registry**: No central place to manage user mappings

## Proposed Architecture

### Database Structure

```
┌─────────────────────┐
│   user_registry     │  ← Admin-only database
├─────────────────────┤
│ Maps Telegram IDs   │
│ to eddo usernames   │
└─────────────────────┘
           │
           ▼
┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
│ eddo_user_walterra  │  │  eddo_user_john     │  │ eddo_user_jane      │
├─────────────────────┤  ├─────────────────────┤  ├─────────────────────┤
│ User's todos        │  │ User's todos        │  │ User's todos        │
│ Complete isolation  │  │ Complete isolation  │  │ Complete isolation  │
└─────────────────────┘  └─────────────────────┘  └─────────────────────┘
```

### User Registry Schema

The user registry follows the same versioning pattern as the todo schema, with incremental alpha versions and migration functions.

#### Current Schema (Alpha1)

```typescript
interface UserRegistryEntryAlpha1 {
  _id: string;                    // "telegram_${telegram_id}"
  _rev?: string;                  // CouchDB revision
  telegram_id: number;            // Telegram user ID
  eddo_username: string;          // Human-readable username
  database_name: string;          // "eddo_user_${eddo_username}"
  api_key: string;                // "telegram_user_${eddo_username}"
  created_at: string;             // ISO timestamp
  updated_at: string;             // ISO timestamp
  permissions: string[];          // ["read", "write"]
  status: 'active' | 'suspended'; // User status
  version: 'alpha1';              // Version identifier
}
```

#### Version Structure

Following the established pattern from todo schema:

```
packages/core-shared/src/versions/
├── user_registry_alpha1.ts    # Base version with core fields
├── user_registry_alpha2.ts    # Future version with migration
├── migrate_user_registry.ts   # Central migration orchestrator
└── migrate_user_registry.test.ts # Migration tests
```

#### Migration System

```typescript
// user_registry_alpha1.ts
export interface UserRegistryEntryAlpha1 {
  _id: string;
  _rev?: string;
  telegram_id: number;
  eddo_username: string;
  database_name: string;
  api_key: string;
  created_at: string;
  updated_at: string;
  permissions: string[];
  status: 'active' | 'suspended';
  version: 'alpha1';
}

export function isUserRegistryEntryAlpha1(arg: unknown): arg is UserRegistryEntryAlpha1 {
  return (
    typeof arg === 'object' &&
    !isNil(arg) &&
    'version' in arg &&
    (arg as UnknownObject).version === 'alpha1'
  );
}

// migrate_user_registry.ts
export function isLatestUserRegistryVersion(entry: unknown): entry is UserRegistryEntryAlpha1 {
  return isUserRegistryEntryAlpha1(entry);
}

export function migrateUserRegistryEntry(entry: unknown): UserRegistryEntryAlpha1 {
  if (isUserRegistryEntryAlpha1(entry)) {
    return entry;
  }

  // Handle legacy entries without version field
  if (isLegacyUserRegistryEntry(entry)) {
    return migrateLegacyToAlpha1(entry);
  }

  throw new Error('invalid user registry entry');
}

function isLegacyUserRegistryEntry(arg: unknown): boolean {
  return (
    typeof arg === 'object' &&
    !isNil(arg) &&
    'telegram_id' in arg &&
    !('version' in arg)
  );
}

function migrateLegacyToAlpha1(entry: any): UserRegistryEntryAlpha1 {
  return {
    ...entry,
    version: 'alpha1',
  };
}
```

#### Type Definitions

```typescript
// types/user-registry.ts
import { type UserRegistryEntryAlpha1 } from '../api/versions/user_registry_alpha1';

export type NewUserRegistryEntry = Omit<UserRegistryEntryAlpha1, '_rev'>;
export type UserRegistryEntry = UserRegistryEntryAlpha1;
```

### Authentication Flow

```
Telegram User (ID: 12345)
    │
    ▼
Bot Auth Middleware
    │
    ├─── Lookup in user_registry database
    │    └─── Find mapping: 12345 → walterra
    │
    ├─── Generate API key: telegram_user_walterra
    │
    ▼
MCP Connection Manager
    │
    ├─── Create/reuse MCP client with user API key
    │
    ▼
MCP Server
    │
    ├─── Extract API key from X-API-Key header
    │
    ├─── Determine database: eddo_user_walterra
    │
    ▼
User-specific CouchDB Database
```

## Implementation Plan

### Phase 1: User Registry Database

1. **Create Versioned Registry Types** (`packages/core-shared/src/versions/user_registry_alpha1.ts`)

```typescript
import { isNil } from 'lodash-es';
import { type UnknownObject } from '../../types/unknown-object';

export interface UserRegistryEntryAlpha1 {
  _id: string;
  _rev?: string;
  telegram_id: number;
  eddo_username: string;
  database_name: string;
  api_key: string;
  created_at: string;
  updated_at: string;
  permissions: string[];
  status: 'active' | 'suspended';
  version: 'alpha1';
}

export function isUserRegistryEntryAlpha1(arg: unknown): arg is UserRegistryEntryAlpha1 {
  return (
    typeof arg === 'object' &&
    !isNil(arg) &&
    'version' in arg &&
    (arg as UnknownObject).version === 'alpha1'
  );
}
```

2. **Create Migration System** (`packages/core-shared/src/versions/migrate_user_registry.ts`)

```typescript
import { isNil } from 'lodash-es';
import { type UnknownObject } from '../../types/unknown-object';
import { type UserRegistryEntryAlpha1, isUserRegistryEntryAlpha1 } from './user_registry_alpha1';

export function isLatestUserRegistryVersion(entry: unknown): entry is UserRegistryEntryAlpha1 {
  return isUserRegistryEntryAlpha1(entry);
}

export function migrateUserRegistryEntry(entry: unknown): UserRegistryEntryAlpha1 {
  if (isUserRegistryEntryAlpha1(entry)) {
    return entry;
  }

  // Handle legacy entries without version field
  if (isLegacyUserRegistryEntry(entry)) {
    return migrateLegacyToAlpha1(entry);
  }

  throw new Error('invalid user registry entry');
}

function isLegacyUserRegistryEntry(arg: unknown): boolean {
  return (
    typeof arg === 'object' &&
    !isNil(arg) &&
    'telegram_id' in arg &&
    typeof (arg as UnknownObject).telegram_id === 'number' &&
    !('version' in arg)
  );
}

function migrateLegacyToAlpha1(entry: any): UserRegistryEntryAlpha1 {
  return {
    ...entry,
    version: 'alpha1',
  };
}
```

3. **Create Type Definitions** (`packages/core-shared/src/types/user-registry.ts`)

```typescript
import { type UserRegistryEntryAlpha1 } from '../api/versions/user_registry_alpha1';

export type NewUserRegistryEntry = Omit<UserRegistryEntryAlpha1, '_rev'>;
export type UserRegistryEntry = UserRegistryEntryAlpha1;

export interface UserRegistryOperations {
  findByTelegramId(telegramId: number): Promise<UserRegistryEntry | null>;
  findByUsername(username: string): Promise<UserRegistryEntry | null>;
  create(entry: Omit<UserRegistryEntry, '_id' | '_rev'>): Promise<UserRegistryEntry>;
  update(id: string, updates: Partial<UserRegistryEntry>): Promise<UserRegistryEntry>;
  list(): Promise<UserRegistryEntry[]>;
}
```

4. **Implement Registry Operations** (`packages/mcp_server/src/db/user-registry.ts`)

```typescript
import nano from 'nano';
import { UserRegistryEntry, UserRegistryOperations } from '@eddo/core';
import { migrateUserRegistryEntry, isLatestUserRegistryVersion } from '@eddo/core';

export class UserRegistry implements UserRegistryOperations {
  private db: nano.DocumentScope<UserRegistryEntry>;

  constructor(couchUrl: string, dbName: string = 'user_registry') {
    const couch = nano(couchUrl);
    this.db = couch.use<UserRegistryEntry>(dbName);
  }

  async findByTelegramId(telegramId: number): Promise<UserRegistryEntry | null> {
    const id = `telegram_${telegramId}`;
    try {
      const doc = await this.db.get(id);
      // Always migrate to latest version when reading
      if (!isLatestUserRegistryVersion(doc)) {
        const migrated = migrateUserRegistryEntry(doc);
        // Save migrated version back to database
        await this.db.insert(migrated);
        return migrated;
      }
      return doc;
    } catch (error) {
      if (error.statusCode === 404) return null;
      throw error;
    }
  }

  async create(entry: Omit<UserRegistryEntry, '_id' | '_rev'>): Promise<UserRegistryEntry> {
    const newEntry: UserRegistryEntry = {
      ...entry,
      _id: `telegram_${entry.telegram_id}`,
      version: 'alpha1', // Always create with latest version
    };

    const result = await this.db.insert(newEntry);
    return { ...newEntry, _rev: result.rev };
  }

  // Additional methods...
}
```

### Phase 2: Environment Configuration

1. **Update Environment Variables** (`packages/core-server/src/config/env.ts`)

```typescript
export interface EnvConfig {
  // Existing config...
  TELEGRAM_USER_MAPPING?: string; // "telegram_id:username,telegram_id:username"
  ENABLE_USER_REGISTRY?: boolean;  // Feature flag
}
```

2. **Parse User Mappings** (`packages/telegram_bot/src/utils/config.ts`)

```typescript
function parseUserMappings(mapping: string): Map<number, string> {
  const mappings = new Map<number, string>();

  mapping.split(',').forEach(pair => {
    const [telegramId, username] = pair.trim().split(':');
    if (telegramId && username) {
      mappings.set(parseInt(telegramId), username);
    }
  });

  return mappings;
}
```

### Phase 3: Enhanced Authentication

1. **Update Auth Middleware** (`packages/telegram_bot/src/bot/middleware/auth.ts`)

```typescript
export async function resolveUserContext(
  telegramId: number,
  registry: UserRegistry
): Promise<UserContext> {
  // Check registry first
  const registryEntry = await registry.findByTelegramId(telegramId);

  if (registryEntry) {
    return {
      telegramId,
      eddoUsername: registryEntry.eddo_username,
      apiKey: registryEntry.api_key,
      databaseName: registryEntry.database_name,
    };
  }

  // Fallback to environment mapping
  const envMapping = parseUserMappings(config.TELEGRAM_USER_MAPPING || '');
  const username = envMapping.get(telegramId);

  if (username) {
    // Create registry entry from environment mapping
    return await createUserFromMapping(telegramId, username, registry);
  }

  // Final fallback: use telegram ID
  return {
    telegramId,
    eddoUsername: `tg_${telegramId}`,
    apiKey: `telegram_user_tg_${telegramId}`,
    databaseName: `eddo_user_tg_${telegramId}`,
  };
}
```

### Phase 4: Per-User MCP Clients

1. **Update Connection Manager** (`packages/telegram_bot/src/mcp/connection-manager.ts`)

```typescript
export class MCPConnectionManager {
  private userClients: Map<string, Client> = new Map();

  async getClientForUser(userContext: UserContext): Promise<Client> {
    const key = userContext.apiKey;

    if (this.userClients.has(key)) {
      return this.userClients.get(key)!;
    }

    const client = await this.createClient(userContext.apiKey);
    this.userClients.set(key, client);

    return client;
  }

  private async createClient(apiKey: string): Promise<Client> {
    const transport = new StreamableHTTPClientTransport(
      new URL(this.serverUrl),
      {
        headers: {
          'X-API-Key': apiKey,
        },
      }
    );

    // Create and connect client...
  }
}
```

### Phase 5: Database Management

1. **Bootstrap Registry Database**

```bash
# Script to create and initialize user registry
node packages/mcp_server/scripts/setup-user-registry.js
```

2. **Design Documents for Registry**

```javascript
{
  "_id": "_design/queries",
  "views": {
    "by_username": {
      "map": "function(doc) { if (doc.eddo_username) emit(doc.eddo_username, null); }"
    },
    "by_status": {
      "map": "function(doc) { if (doc.status) emit(doc.status, null); }"
    },
    "active_users": {
      "map": "function(doc) { if (doc.status === 'active') emit(doc.created_at, null); }"
    }
  }
}
```

## CouchDB Best Practices Applied

### 1. Database-per-User Pattern

- **Recommendation**: "In the very common situation where you want user data to be private, the current best practice is to give every user a database"
- **Implementation**: Each user gets `eddo_user_{username}` database
- **Benefits**: Complete isolation, easy backup/restore, simple security model

### 2. Design Document Synchronization

- **Challenge**: Keep design docs in sync across user databases
- **Solution**: Use existing `DatabaseSetup` class to push updates
- **Automation**: Deploy script updates all user databases

### 3. Security Considerations

- **Registry Access**: Admin-only, not exposed to users
- **Database Names**: Human-readable but not enumerable
- **API Keys**: Generated per-user, not shared

### 4. Scalability

- **CouchDB Capacity**: Handles 10k+ databases easily
- **File System**: Modern filesystems (ext4) handle many subdirectories
- **Connection Pooling**: Reuse MCP clients per user

## Migration Strategy

### Step 1: Enable Feature Flag

```bash
ENABLE_USER_REGISTRY=true
TELEGRAM_USER_MAPPING="12345:walterra,67890:john"
```

### Step 2: Create Registry Entries

- Parse environment mappings
- Create registry entries for existing users
- New users get entries on first login

### Step 3: Gradual Migration

- Existing users continue with shared database
- New logins create per-user databases
- Background job migrates data on-demand

### Step 4: Full Cutover

- All users have registry entries
- Remove shared database access
- Disable fallback mechanisms

## Security Enhancements

### Data Isolation

- Each user can only access their own database
- No cross-user queries possible
- Complete privacy between users

### Access Control

- Registry database requires admin credentials
- User databases accessed via unique API keys
- No direct database access from Telegram bot

### Audit Trail

- Registry tracks user creation/updates
- Each database operation logged with user context
- Failed access attempts recorded

## Testing Plan

### Unit Tests

- [ ] User registry CRUD operations
- [ ] User context resolution
- [ ] API key generation
- [ ] Database name formatting
- [ ] **Version-specific tests**:
  - [ ] `isUserRegistryEntryAlpha1()` type guard function
  - [ ] `migrateLegacyToAlpha1()` migration function
  - [ ] `isLatestUserRegistryVersion()` version detection
  - [ ] `migrateUserRegistryEntry()` central migration orchestrator

### Integration Tests

- [ ] End-to-end authentication flow
- [ ] Per-user database creation
- [ ] MCP client isolation
- [ ] Registry synchronization
- [ ] **Migration integration tests**:
  - [ ] Database reads automatically migrate old entries
  - [ ] New entries are created with latest version
  - [ ] Bulk migration operations
  - [ ] Migration error handling

### Security Tests

- [ ] Verify user isolation
- [ ] Test unauthorized access attempts
- [ ] Validate API key uniqueness
- [ ] Check registry access control

### Migration Test Patterns

Following the todo schema testing approach:

```typescript
// migrate_user_registry.test.ts
import { describe, it, expect } from 'vitest';
import {
  migrateUserRegistryEntry,
  isLatestUserRegistryVersion
} from './migrate_user_registry';

describe('User Registry Migration', () => {
  it('should migrate legacy entry to alpha1', () => {
    const legacyEntry = {
      _id: 'telegram_12345',
      telegram_id: 12345,
      eddo_username: 'walterra',
      database_name: 'eddo_user_walterra',
      api_key: 'telegram_user_walterra',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      permissions: ['read', 'write'],
      status: 'active',
      // Missing version field
    };

    const migrated = migrateUserRegistryEntry(legacyEntry);

    expect(migrated.version).toBe('alpha1');
    expect(migrated.telegram_id).toBe(12345);
    expect(migrated.eddo_username).toBe('walterra');
  });

  it('should handle invalid entries', () => {
    expect(() => migrateUserRegistryEntry({})).toThrow('invalid user registry entry');
    expect(() => migrateUserRegistryEntry(null)).toThrow('invalid user registry entry');
  });

  it('should detect latest version correctly', () => {
    const alpha1Entry = {
      _id: 'telegram_12345',
      telegram_id: 12345,
      eddo_username: 'walterra',
      version: 'alpha1',
      // ... other fields
    };

    expect(isLatestUserRegistryVersion(alpha1Entry)).toBe(true);
  });
});
```

### Factory Functions for Testing

```typescript
// test-utils/user-registry-factory.ts
import { type UserRegistryEntryAlpha1 } from '../api/versions/user_registry_alpha1';

export function createUserRegistryEntryAlpha1(
  overrides: Partial<UserRegistryEntryAlpha1> = {}
): UserRegistryEntryAlpha1 {
  return {
    _id: `telegram_${overrides.telegram_id || 12345}`,
    telegram_id: 12345,
    eddo_username: 'testuser',
    database_name: 'eddo_user_testuser',
    api_key: 'telegram_user_testuser',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    permissions: ['read', 'write'],
    status: 'active',
    version: 'alpha1',
    ...overrides,
  };
}

export function createLegacyUserRegistryEntry(
  overrides: Partial<Omit<UserRegistryEntryAlpha1, 'version'>> = {}
): Omit<UserRegistryEntryAlpha1, 'version'> {
  const alpha1Entry = createUserRegistryEntryAlpha1(overrides);
  const { version, ...legacyEntry } = alpha1Entry;
  return legacyEntry;
}
```

## Rollback Plan

1. **Feature Flag**: Disable `ENABLE_USER_REGISTRY`
2. **Revert to Shared**: All users access shared database
3. **Preserve Data**: User databases remain for future migration
4. **Monitor**: Track any issues during rollback

## Future Enhancements

### Admin Interface

- Web UI for user management
- Bulk user operations
- Usage statistics per user

### Self-Service Registration

- Users can claim usernames
- Email verification flow
- Profile management

### Advanced Permissions

- Role-based access control
- Shared databases for teams
- Read-only access modes

## Conclusion

This user registry implementation follows CouchDB best practices while maintaining backwards compatibility and providing a clear migration path. The database-per-user pattern ensures complete data isolation and aligns with the offline-first architecture of the eddo application.
