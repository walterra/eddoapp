// Types
export { type NewTodo, type Todo } from './types/todo';
export { type Activity } from './types/activity';
export {
  DatabaseErrorType,
  type DatabaseError,
  DatabaseOperationError,
} from './types/database-errors';
export {
  type DatabaseHealthMetrics,
  type DatabaseHealthCheck,
  type DatabaseHealthIssue,
  type DatabaseHealthConfig,
  DEFAULT_HEALTH_CONFIG,
} from './types/database-health';
export {
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
} from './types/user-registry';

// API versions
export { type TodoAlpha1, isTodoAlpha1 } from './versions/todo_alpha1';
export {
  type TodoAlpha2,
  isTodoAlpha2,
  migrateToAlpha2,
} from './versions/todo_alpha2';
export {
  type TodoAlpha3,
  isTodoAlpha3,
  migrateToAlpha3,
} from './versions/todo_alpha3';
export { isLatestVersion, migrateTodo } from './versions/migrate';
export {
  type UserStatus as UserStatusAlpha1,
  type UserPermission,
  type UserPermissions as UserPermissionsAlpha1,
  type UserRegistryEntryAlpha1,
  isUserRegistryEntryAlpha1,
} from './versions/user_registry_alpha1';
export {
  type UserPreferences,
  type UserRegistryEntryAlpha2,
  isUserRegistryEntryAlpha2,
  createDefaultUserPreferences,
} from './versions/user_registry_alpha2';
export {
  isLatestUserRegistryVersion,
  migrateUserRegistryEntry,
} from './versions/migrate_user_registry';

// Database monitoring
export { DatabaseHealthMonitor } from './api/database-health-monitor';

// Utils
export { generateStableKey } from './utils/generate_stable_key';
export { getActiveDuration } from './utils/get_active_duration';
export { getActiveRecordForActivities } from './utils/get_active_record_for_activities';
export { getActiveRecordForTodos } from './utils/get_active_record_for_todos';
export {
  getFormattedDuration,
  getFormattedDurationForTodos,
  getFormattedDurationForActivities,
} from './utils/get_formatted_duration';
export { getRepeatTodo } from './utils/get_repeat_todo';
export { shuffle } from './utils/shuffle';
export {
  decodeJwtPayload,
  isTokenExpired,
  getTokenExpiration,
  getTokenTimeRemaining,
} from './utils/token-utils';
