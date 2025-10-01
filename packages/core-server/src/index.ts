// Re-export everything from core-shared
export {
  // Types
  type NewTodo,
  type Todo,
  type Activity,
  DatabaseErrorType,
  type DatabaseError,
  DatabaseOperationError,
  type DatabaseHealthMetrics,
  type DatabaseHealthCheck,
  type DatabaseHealthIssue,
  type DatabaseHealthConfig,
  DEFAULT_HEALTH_CONFIG,
  type NewUserRegistryEntry,
  type UserRegistryEntry,
  type CreateUserRegistryEntry,
  type UpdateUserRegistryEntry,
  type UserStatus,
  type UserPermissions,
  type UserRegistryOperations,
  type UserContext,
  type CreateUserRequest,
  type LoginRequest,
  type LoginResponse,
  type LinkTelegramRequest,
  type LinkTelegramResponse,
  // API versions
  type TodoAlpha1,
  isTodoAlpha1,
  type TodoAlpha2,
  isTodoAlpha2,
  migrateToAlpha2,
  type TodoAlpha3,
  isTodoAlpha3,
  migrateToAlpha3,
  isLatestVersion,
  migrateTodo,
  type UserPermission,
  type UserRegistryEntryAlpha1,
  isUserRegistryEntryAlpha1,
  type UserPreferences,
  type UserRegistryEntryAlpha2,
  isUserRegistryEntryAlpha2,
  createDefaultUserPreferences,
  isLatestUserRegistryVersion,
  migrateUserRegistryEntry,
  // Database monitoring
  DatabaseHealthMonitor,
  // Utils
  generateStableKey,
  getActiveDuration,
  getActiveRecordForActivities,
  getActiveRecordForTodos,
  getFormattedDuration,
  getFormattedDurationForTodos,
  getFormattedDurationForActivities,
  getRepeatTodo,
  shuffle,
  decodeJwtPayload,
  isTokenExpired,
  getTokenExpiration,
  getTokenTimeRemaining,
} from '@eddo/core-shared';

// Server-specific configuration
export {
  envSchema,
  type Env,
  validateEnv,
  getEffectiveDbName,
  getCouchDbUrl,
  getCouchDbConfig,
  getTestCouchDbConfig,
  getTestUserRegistryConfig,
  getAvailableDatabases,
  env,
  createEnv,
} from './config';

// Server-specific API
export {
  type DatabaseConfig,
  type DatabaseFactory,
  createDatabase,
} from './api/database-factory';
export {
  createUserRegistry,
  createTestUserRegistry,
  UserRegistry,
} from './api/user-registry';

// Server-specific utilities
export {
  getDatabasePrefix,
  getUserRegistryDatabaseName,
  getUserDatabaseName,
  extractUsernameFromDatabaseName,
  isUserDatabase,
  isUserRegistryDatabase,
  sanitizeUsername,
  generateLinkingCode,
  getAllUserDatabaseNames,
  getUserRegistryDatabaseConfig,
  getUserDatabaseConfig,
} from './utils/database-names';
export {
  type TestCleanupOptions,
  type CleanupResult,
  type DatabaseInfo,
  TestDatabaseCleanup,
  createTestCleanup,
  quickCleanup,
  cleanupUserDatabases,
  cleanupDatabasesByPattern,
  getDatabaseReport,
  cleanupCIEnvironment,
} from './utils/test-cleanup';
