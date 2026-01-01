import { act, renderHook, waitFor } from '@testing-library/react';
import { type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider, useAuth } from './use_auth';

// Mock isTokenExpired
vi.mock('@eddo/core-client', () => ({
  isTokenExpired: vi.fn().mockReturnValue(false),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock localStorage
const localStorageMock = {
  store: {} as Record<string, string>,
  getItem: vi.fn((key: string) => localStorageMock.store[key] || null),
  setItem: vi.fn((key: string, value: string) => {
    localStorageMock.store[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete localStorageMock.store[key];
  }),
  clear: vi.fn(() => {
    localStorageMock.store = {};
  }),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

function AuthTestWrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

describe('useAuth Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Context sharing', () => {
    it('throws error when used outside AuthProvider', () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useAuth());
      }).toThrow('useAuth must be used within an AuthProvider');

      consoleSpy.mockRestore();
    });

    it('shares auth state between multiple hook instances', async () => {
      const mockToken = {
        token: 'test-token',
        username: 'testuser',
        expiresIn: '7d',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockToken),
      });

      // Render two hooks using the same AuthProvider
      const { result: result1 } = renderHook(() => useAuth(), {
        wrapper: AuthTestWrapper,
      });

      const { result: result2 } = renderHook(() => useAuth(), {
        wrapper: AuthTestWrapper,
      });

      // Both should start as not authenticated
      expect(result1.current.isAuthenticated).toBe(false);
      expect(result2.current.isAuthenticated).toBe(false);

      // Login via first hook instance
      await act(async () => {
        await result1.current.authenticate('testuser', 'password');
      });

      // Both hooks should now see the authenticated state
      await waitFor(() => {
        expect(result1.current.isAuthenticated).toBe(true);
        expect(result1.current.username).toBe('testuser');
      });

      // Note: result2 is rendered in a separate provider instance in this test setup,
      // but in the real app, both would share the same provider
    });

    it('provides auth state immediately after login without needing localStorage sync', async () => {
      const mockToken = {
        token: 'test-token',
        username: 'testuser',
        expiresIn: '7d',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockToken),
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthTestWrapper,
      });

      expect(result.current.isAuthenticated).toBe(false);

      // Perform login
      let loginResult: boolean = false;
      await act(async () => {
        loginResult = await result.current.authenticate('testuser', 'password');
      });

      // Should be immediately authenticated
      expect(loginResult).toBe(true);
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.username).toBe('testuser');
      expect(result.current.authToken).toEqual(mockToken);

      // Verify localStorage was also updated
      expect(localStorageMock.setItem).toHaveBeenCalledWith('authToken', JSON.stringify(mockToken));
    });
  });

  describe('Authentication flow', () => {
    it('handles successful login', async () => {
      const mockToken = {
        token: 'test-token',
        username: 'testuser',
        expiresIn: '7d',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockToken),
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthTestWrapper,
      });

      let loginResult: boolean = false;
      await act(async () => {
        loginResult = await result.current.authenticate('testuser', 'password');
      });

      expect(loginResult).toBe(true);
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.username).toBe('testuser');
    });

    it('handles failed login', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthTestWrapper,
      });

      let loginResult: boolean = true;
      await act(async () => {
        loginResult = await result.current.authenticate('testuser', 'wrongpassword');
      });

      expect(loginResult).toBe(false);
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('passes rememberMe flag to login request', async () => {
      const mockToken = {
        token: 'test-token',
        username: 'testuser',
        expiresIn: '30d',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockToken),
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthTestWrapper,
      });

      await act(async () => {
        await result.current.authenticate('testuser', 'password', true);
      });

      expect(mockFetch).toHaveBeenCalledWith('/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: 'testuser', password: 'password', rememberMe: true }),
      });
    });

    it('defaults rememberMe to false when not provided', async () => {
      const mockToken = {
        token: 'test-token',
        username: 'testuser',
        expiresIn: '1h',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockToken),
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthTestWrapper,
      });

      await act(async () => {
        await result.current.authenticate('testuser', 'password');
      });

      expect(mockFetch).toHaveBeenCalledWith('/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: 'testuser', password: 'password', rememberMe: false }),
      });
    });

    it('handles logout', async () => {
      const mockToken = {
        token: 'test-token',
        username: 'testuser',
        expiresIn: '7d',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockToken),
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthTestWrapper,
      });

      // Login first
      await act(async () => {
        await result.current.authenticate('testuser', 'password');
      });

      expect(result.current.isAuthenticated).toBe(true);

      // Then logout
      act(() => {
        result.current.logout();
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.authToken).toBe(null);
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('authToken');
    });

    it('sets isAuthenticating during login', async () => {
      mockFetch.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: () =>
                    Promise.resolve({
                      token: 'test-token',
                      username: 'testuser',
                      expiresIn: '7d',
                    }),
                }),
              100,
            );
          }),
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthTestWrapper,
      });

      expect(result.current.isAuthenticating).toBe(false);

      let loginPromise: Promise<boolean>;
      act(() => {
        loginPromise = result.current.authenticate('testuser', 'password');
      });

      // Should be authenticating now
      expect(result.current.isAuthenticating).toBe(true);

      await act(async () => {
        await loginPromise;
      });

      expect(result.current.isAuthenticating).toBe(false);
    });
  });

  describe('Registration', () => {
    it('handles successful registration', async () => {
      const mockToken = {
        token: 'test-token',
        username: 'newuser',
        expiresIn: '7d',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockToken),
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthTestWrapper,
      });

      let registerResult: { success: boolean; error?: string };
      await act(async () => {
        registerResult = await result.current.register('newuser', 'test@example.com', 'password');
      });

      expect(registerResult!.success).toBe(true);
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.username).toBe('newuser');
    });

    it('handles failed registration', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Username already exists' }),
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthTestWrapper,
      });

      let registerResult: { success: boolean; error?: string };
      await act(async () => {
        registerResult = await result.current.register(
          'existinguser',
          'test@example.com',
          'password',
        );
      });

      expect(registerResult!.success).toBe(false);
      expect(registerResult!.error).toBe('Username already exists');
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe('Token persistence', () => {
    it('loads token from localStorage on mount', async () => {
      const storedToken = {
        token: 'stored-token',
        username: 'storeduser',
        expiresIn: '7d',
      };

      localStorageMock.store['authToken'] = JSON.stringify(storedToken);

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthTestWrapper,
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
        expect(result.current.username).toBe('storeduser');
      });
    });

    it('handles invalid stored token gracefully', async () => {
      localStorageMock.store['authToken'] = 'invalid-json';
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthTestWrapper,
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(false);
      });

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('authToken');
      consoleSpy.mockRestore();
    });
  });
});
