// Types
export { type Activity } from './types/activity';
export {
  DatabaseErrorType,
  DatabaseOperationError,
  type DatabaseError,
} from './types/database-errors';
export {
  DEFAULT_HEALTH_CONFIG,
  type DatabaseHealthCheck,
  type DatabaseHealthConfig,
  type DatabaseHealthIssue,
  type DatabaseHealthMetrics,
} from './types/database-health';
export { type NewTodo, type Todo } from './types/todo';
export {
  type CreateUserRegistryEntry,
  type CreateUserRequest,
  type LinkTelegramRequest,
  type LinkTelegramResponse,
  type LoginRequest,
  type LoginResponse,
  type NewUserRegistryEntry,
  type UpdateUserRegistryEntry,
  type UserContext,
  type UserPermissions,
  type UserRegistryEntry,
  type UserRegistryOperations,
  type UserStatus,
} from './types/user-registry';

// API versions
export { isLatestVersion, migrateTodo } from './versions/migrate';
export {
  isLatestUserRegistryVersion,
  migrateUserRegistryEntry,
} from './versions/migrate_user_registry';
export { isTodoAlpha1, type TodoAlpha1 } from './versions/todo_alpha1';
export { isTodoAlpha2, migrateToAlpha2, type TodoAlpha2 } from './versions/todo_alpha2';
export { isTodoAlpha3, migrateToAlpha3, type TodoAlpha3 } from './versions/todo_alpha3';
export {
  isUserRegistryEntryAlpha1,
  type UserPermission,
  type UserPermissions as UserPermissionsAlpha1,
  type UserRegistryEntryAlpha1,
  type UserStatus as UserStatusAlpha1,
} from './versions/user_registry_alpha1';
export {
  createDefaultUserPreferences,
  isUserRegistryEntryAlpha2,
  type RssFeedConfig,
  type ThemePreference,
  type UserPreferences,
  type UserRegistryEntryAlpha2,
} from './versions/user_registry_alpha2';

// Database monitoring
export { DatabaseHealthMonitor } from './api/database-health-monitor';

// Database structures
export {
  DESIGN_DOCS,
  REQUIRED_INDEXES,
  type DesignDocument,
  type IndexDefinition,
} from './api/database-structures';

// Utils
export { areTodosEqual } from './utils/are_todos_equal';
export { generateStableKey } from './utils/generate_stable_key';
export { getActiveDuration } from './utils/get_active_duration';
export { getActiveRecordForActivities } from './utils/get_active_record_for_activities';
export { getActiveRecordForTodos } from './utils/get_active_record_for_todos';
export {
  getFormattedDuration,
  getFormattedDurationForActivities,
  getFormattedDurationForTodos,
} from './utils/get_formatted_duration';
export { getRepeatTodo } from './utils/get_repeat_todo';
export { getRandomHex, getRandomInt } from './utils/random';
export { shuffle } from './utils/shuffle';
export {
  decodeJwtPayload,
  getTokenExpiration,
  getTokenTimeRemaining,
  isTokenExpired,
} from './utils/token-utils';
