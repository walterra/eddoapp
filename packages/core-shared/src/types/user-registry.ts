import { type UserRegistryEntryAlpha1 } from '../versions/user_registry_alpha1';

export type NewUserRegistryEntry = Omit<UserRegistryEntryAlpha1, '_rev'>;
export type UserRegistryEntry = UserRegistryEntryAlpha1;

export interface UserRegistryOperations {
  findByUsername(username: string): Promise<UserRegistryEntry | null>;
  findByTelegramId(telegramId: number): Promise<UserRegistryEntry | null>;
  findByEmail(email: string): Promise<UserRegistryEntry | null>;
  create(
    entry: Omit<UserRegistryEntry, '_id' | '_rev'>,
  ): Promise<UserRegistryEntry>;
  update(
    id: string,
    updates: Partial<UserRegistryEntry>,
  ): Promise<UserRegistryEntry>;
  list(): Promise<UserRegistryEntry[]>;
  delete(id: string): Promise<void>;
}

export interface UserContext {
  userId: string;
  username: string;
  telegramId?: number;
  apiKey: string;
  databaseName: string;
  permissions: string[];
  status: 'active' | 'suspended';
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
