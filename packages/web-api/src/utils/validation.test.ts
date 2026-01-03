import { describe, expect, it } from 'vitest';

import {
  isReservedUsername,
  RESERVED_USERNAMES,
  validateEmail,
  validatePassword,
  validateUsername,
} from './validation.js';

describe('validateUsername', () => {
  it('accepts valid usernames', () => {
    const validUsernames = ['john', 'John123', 'user_name', 'Alice', 'bob_smith_42'];

    for (const username of validUsernames) {
      const result = validateUsername(username);
      expect(result.isValid, `Expected "${username}" to be valid`).toBe(true);
      expect(result.errors).toHaveLength(0);
    }
  });

  it('rejects usernames shorter than 3 characters', () => {
    const result = validateUsername('ab');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Username must be at least 3 characters long');
  });

  it('rejects usernames longer than 20 characters', () => {
    const result = validateUsername('a'.repeat(21));
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Username must be no more than 20 characters long');
  });

  it('rejects usernames with invalid characters', () => {
    const invalidUsernames = ['user@name', 'user-name', 'user.name', 'user name', 'user!'];

    for (const username of invalidUsernames) {
      const result = validateUsername(username);
      expect(result.isValid, `Expected "${username}" to be invalid`).toBe(false);
      expect(result.errors).toContain(
        'Username can only contain letters, numbers, and underscores',
      );
    }
  });

  it('rejects usernames that do not start with a letter', () => {
    const invalidUsernames = ['123user', '_username', '9lives'];

    for (const username of invalidUsernames) {
      const result = validateUsername(username);
      expect(result.isValid, `Expected "${username}" to be invalid`).toBe(false);
      expect(result.errors).toContain('Username must start with a letter');
    }
  });

  describe('reserved usernames', () => {
    it('rejects "registry" to prevent database collision', () => {
      const result = validateUsername('registry');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('This username is reserved and cannot be used');
    });

    it('rejects "registry" case-insensitively', () => {
      const variations = ['Registry', 'REGISTRY', 'ReGiStRy'];

      for (const username of variations) {
        const result = validateUsername(username);
        expect(result.isValid, `Expected "${username}" to be rejected`).toBe(false);
        expect(result.errors).toContain('This username is reserved and cannot be used');
      }
    });

    it('rejects all reserved usernames', () => {
      for (const reserved of RESERVED_USERNAMES) {
        const result = validateUsername(reserved);
        expect(result.isValid, `Expected "${reserved}" to be rejected`).toBe(false);
        expect(result.errors).toContain('This username is reserved and cannot be used');
      }
    });

    it('rejects reserved usernames regardless of case', () => {
      const testCases = [
        'Admin',
        'ADMIN',
        'Root',
        'ROOT',
        'System',
        'SYSTEM',
        'NULL',
        'Null',
        'UNDEFINED',
        'Undefined',
      ];

      for (const username of testCases) {
        const result = validateUsername(username);
        expect(result.isValid, `Expected "${username}" to be rejected`).toBe(false);
      }
    });
  });

  it('reports multiple errors when applicable', () => {
    const result = validateUsername('1!');
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1);
  });
});

describe('isReservedUsername', () => {
  it('returns true for reserved usernames', () => {
    expect(isReservedUsername('registry')).toBe(true);
    expect(isReservedUsername('admin')).toBe(true);
    expect(isReservedUsername('root')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isReservedUsername('REGISTRY')).toBe(true);
    expect(isReservedUsername('Admin')).toBe(true);
    expect(isReservedUsername('ROOT')).toBe(true);
  });

  it('returns false for non-reserved usernames', () => {
    expect(isReservedUsername('john')).toBe(false);
    expect(isReservedUsername('alice')).toBe(false);
    expect(isReservedUsername('bob123')).toBe(false);
  });
});

describe('validateEmail', () => {
  it('accepts valid email addresses', () => {
    const validEmails = [
      'user@example.com',
      'user.name@example.com',
      'user+tag@example.com',
      'user@subdomain.example.com',
    ];

    for (const email of validEmails) {
      expect(validateEmail(email), `Expected "${email}" to be valid`).toBe(true);
    }
  });

  it('rejects invalid email addresses', () => {
    const invalidEmails = [
      'invalid',
      'invalid@',
      '@example.com',
      'user@',
      'user name@example.com',
      'user@example',
    ];

    for (const email of invalidEmails) {
      expect(validateEmail(email), `Expected "${email}" to be invalid`).toBe(false);
    }
  });
});

describe('validatePassword', () => {
  it('accepts strong passwords', () => {
    const result = validatePassword('SecurePass123!');
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects passwords shorter than 8 characters', () => {
    const result = validatePassword('Short1!');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Password must be at least 8 characters long');
  });

  it('requires lowercase letter', () => {
    const result = validatePassword('UPPERCASE123!');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Password must contain at least one lowercase letter');
  });

  it('requires uppercase letter', () => {
    const result = validatePassword('lowercase123!');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Password must contain at least one uppercase letter');
  });

  it('requires a number', () => {
    const result = validatePassword('NoNumbers!!');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Password must contain at least one number');
  });

  it('requires a special character', () => {
    const result = validatePassword('NoSpecial123');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Password must contain at least one special character');
  });
});
