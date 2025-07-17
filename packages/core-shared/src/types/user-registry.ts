import {
  type UserPermissions,
  type UserRegistryEntryAlpha1,
  type UserStatus,
} from '../versions/user_registry_alpha1';

export type NewUserRegistryEntry = Omit<UserRegistryEntryAlpha1, '_rev'>;
export type UserRegistryEntry = UserRegistryEntryAlpha1;

export type CreateUserRegistryEntry = Omit<UserRegistryEntry, '_id' | '_rev'>;
export type UpdateUserRegistryEntry = Partial<UserRegistryEntry>;

export { type UserStatus, type UserPermissions };

export interface UserRegistryOperations {
  findByUsername(username: string): Promise<UserRegistryEntry | null>;
  findByTelegramId(telegramId: number): Promise<UserRegistryEntry | null>;
  findByEmail(email: string): Promise<UserRegistryEntry | null>;
  create(entry: CreateUserRegistryEntry): Promise<UserRegistryEntry>;
  update(
    id: string,
    updates: UpdateUserRegistryEntry,
  ): Promise<UserRegistryEntry>;
  list(): Promise<UserRegistryEntry[]>;
  delete(id: string): Promise<void>;
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
