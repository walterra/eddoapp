import { describe, expect, it } from 'vitest';
import { loginSchema, registerSchema } from './auth_schemas';

const registration = { username: 'user', email: 'user@example.com', password: 'password' };

describe('authentication schema compatibility', () => {
  it('supplies rememberMe defaults and projects unrelated fields', () => {
    expect(loginSchema.parse({ username: 'user', password: 'password', private: true })).toEqual({
      username: 'user',
      password: 'password',
      rememberMe: false,
    });
    expect(registerSchema.parse({ ...registration, rememberMe: undefined })).toEqual({
      ...registration,
      rememberMe: false,
    });
  });

  it('preserves UTF-16 minimum lengths without counting Unicode code points', () => {
    expect(
      registerSchema.parse({ ...registration, username: '😀a', password: '😀'.repeat(4) }).password,
    ).toBe('😀'.repeat(4));
  });

  it.each([
    { ...registration, username: 'ab' },
    { ...registration, username: '😀'.repeat(11) },
    { ...registration, password: 'short' },
    { ...registration, rememberMe: 'true' },
    { ...registration, telegramId: Infinity },
    { ...registration, email: 'not-an-email' },
    { ...registration, email: '.user@example.com' },
    { ...registration, email: 'a..b@example.com' },
  ])('rejects previously invalid registration input', (value) => {
    expect(registerSchema.safeParse(value).success).toBe(false);
  });

  it.each(['user+tag@example.com', "o'neil@example.com", 'a.b@sub.example.com'])(
    'accepts practical email addresses: %s',
    (email) => {
      expect(registerSchema.parse({ ...registration, email }).email).toBe(email);
    },
  );

  it('does not retain rejected credentials in errors', () => {
    const result = registerSchema.safeParse({ ...registration, password: 'secret' });
    expect(result.success).toBe(false);
    if (result.success) throw new Error('expected failure');
    expect(result.error.message).not.toContain('secret');
  });
});
