import { type UserPermissions, type UserStatus } from '../versions/user_registry_alpha1';
import { type UserRegistryEntryAlpha2 } from '../versions/user_registry_alpha2';

export type NewUserRegistryEntry = Omit<UserRegistryEntryAlpha2, '_rev'>;
export type UserRegistryEntry = UserRegistryEntryAlpha2;

export type CreateUserRegistryEntry = Omit<UserRegistryEntry, '_id' | '_rev'>;
export type UpdateUserRegistryEntry = Partial<UserRegistryEntry>;

export { type UserPermissions, type UserStatus };

export interface UserRegistryOperations {
  findByUsername(username: string): Promise<UserRegistryEntry | null>;
  findByTelegramId(telegramId: number): Promise<UserRegistryEntry | null>;
  findByEmail(email: string): Promise<UserRegistryEntry | null>;
  findByMcpApiKey(apiKey: string): Promise<UserRegistryEntry | null>;
  create(entry: CreateUserRegistryEntry): Promise<UserRegistryEntry>;
  update(id: string, updates: UpdateUserRegistryEntry): Promise<UserRegistryEntry>;
  list(): Promise<UserRegistryEntry[]>;
  delete(id: string): Promise<void>;
  setupDatabase?: () => Promise<void>;
  ensureUserDatabase?: (username: string) => Promise<void>;
  getUserDatabase?: (username: string) => unknown;
}

export interface UserContext {
  userId: string;
  username: string;
  telegramId?: number;
  databaseName: string;
  permissions: UserPermissions;
  status: UserStatus;
}

export interface CreateUserRequest {
  username: string;
  email: string;
  password: string;
  telegramId?: number;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  username: string;
  userId: string;
  expiresIn: string;
}

export interface LinkTelegramRequest {
  linkCode: string;
  telegramId: number;
}

export interface LinkTelegramResponse {
  success: boolean;
  username: string;
}
