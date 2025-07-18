import isNil from 'lodash-es/isNil';

type UnknownObject = Record<string, unknown> | { [key: string]: unknown };

export type UserStatus = 'active' | 'suspended';
export type UserPermission = 'read' | 'write';
export type UserPermissions = UserPermission[];

export interface UserRegistryEntryAlpha1 {
  _id: string;
  _rev?: string;
  telegram_id?: number;
  username: string;
  email: string;
  password_hash: string;
  database_name: string;
  created_at: string;
  updated_at: string;
  permissions: UserPermissions;
  status: UserStatus;
  version: 'alpha1';
}

export function isUserRegistryEntryAlpha1(
  arg: unknown,
): arg is UserRegistryEntryAlpha1 {
  return (
    typeof arg === 'object' &&
    !isNil(arg) &&
    'version' in arg &&
    (arg as UnknownObject).version === 'alpha1'
  );
}
