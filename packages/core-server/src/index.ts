// Re-export everything from core-shared
export {
  DEFAULT_HEALTH_CONFIG,
  DatabaseErrorType,
  // Database monitoring
  DatabaseHealthMonitor,
  DatabaseOperationError,
  createDefaultUserPreferences,
  decodeJwtPayload,
  // Utils
  generateStableKey,
  getActiveDuration,
  getActiveRecordForActivities,
  getActiveRecordForTodos,
  getFormattedDuration,
  getFormattedDurationForActivities,
  getFormattedDurationForTodos,
  getRepeatTodo,
  getTokenExpiration,
  getTokenTimeRemaining,
  isLatestUserRegistryVersion,
  isLatestVersion,
  isTodoAlpha1,
  isTodoAlpha2,
  isTodoAlpha3,
  isTokenExpired,
  isUserRegistryEntryAlpha1,
  isUserRegistryEntryAlpha2,
  migrateToAlpha2,
  migrateToAlpha3,
  migrateTodo,
  migrateUserRegistryEntry,
  shuffle,
  type Activity,
  type CreateUserRegistryEntry,
  type CreateUserRequest,
  type DatabaseError,
  type DatabaseHealthCheck,
  type DatabaseHealthConfig,
  type DatabaseHealthIssue,
  type DatabaseHealthMetrics,
  type LinkTelegramRequest,
  type LinkTelegramResponse,
  type LoginRequest,
  type LoginResponse,
  // Types
  type NewTodo,
  type NewUserRegistryEntry,
  type Todo,
  // API versions
  type TodoAlpha1,
  type TodoAlpha2,
  type TodoAlpha3,
  type UpdateUserRegistryEntry,
  type UserContext,
  type UserPermission,
  type UserPermissions,
  type UserPreferences,
  type UserRegistryEntry,
  type UserRegistryEntryAlpha1,
  type UserRegistryEntryAlpha2,
  type UserRegistryOperations,
  type UserStatus,
} from '@eddo/core-shared';

// Server-specific configuration
export {
  createEnv,
  env,
  envSchema,
  getAvailableDatabases,
  getCouchDbConfig,
  getCouchDbUrl,
  getEffectiveDbName,
  getTestUserRegistryConfig,
  validateEnv,
  type Env,
} from './config';

// Server-specific API
export { createDatabase, type DatabaseConfig, type DatabaseFactory } from './api/database-factory';
export { UserRegistry, createTestUserRegistry, createUserRegistry } from './api/user-registry';

// Server-specific utilities
export {
  extractUsernameFromDatabaseName,
  generateLinkingCode,
  getAllUserDatabaseNames,
  getDatabasePrefix,
  getUserDatabaseConfig,
  getUserDatabaseName,
  getUserRegistryDatabaseConfig,
  getUserRegistryDatabaseName,
  isUserDatabase,
  isUserRegistryDatabase,
  sanitizeUsername,
} from './utils/database-names';
export {
  TestDatabaseCleanup,
  cleanupCIEnvironment,
  cleanupDatabasesByPattern,
  cleanupUserDatabases,
  createTestCleanup,
  getDatabaseReport,
  quickCleanup,
  type CleanupResult,
  type DatabaseInfo,
  type TestCleanupOptions,
} from './utils/test-cleanup';
