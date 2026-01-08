import { isTokenExpired } from '@eddo/core-client';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';

import { clearTelemetryUser, setTelemetryUser } from '../telemetry';

interface AuthToken {
  token: string;
  username: string;
  expiresIn: string;
}

interface AuthContextValue {
  authToken: AuthToken | null;
  authenticate: (username: string, password: string, rememberMe?: boolean) => Promise<boolean>;
  register: (
    username: string,
    email: string,
    password: string,
    telegramId?: number,
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isAuthenticated: boolean;
  isAuthenticating: boolean;
  username: string | undefined;
  checkTokenExpiration: () => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

type SetAuthToken = (t: AuthToken) => void;

/** Saves token to state and localStorage */
function persistToken(token: AuthToken, setAuthToken: SetAuthToken): void {
  setAuthToken(token);
  localStorage.setItem('authToken', JSON.stringify(token));
}

/** Load and validate token from localStorage */
function loadStoredToken(): AuthToken | null {
  const stored = localStorage.getItem('authToken');
  if (!stored) return null;
  try {
    const token = JSON.parse(stored);
    if (isTokenExpired(token.token)) {
      console.warn('Stored token is expired - removing');
      localStorage.removeItem('authToken');
      return null;
    }
    return token;
  } catch (error) {
    console.error('Invalid stored token:', error);
    localStorage.removeItem('authToken');
    return null;
  }
}

interface LoginParams {
  username: string;
  password: string;
  rememberMe: boolean;
}
interface RegisterParams {
  username: string;
  email: string;
  password: string;
  telegramId?: number;
}

/** Authenticate user with login credentials */
async function doLogin(params: LoginParams, setAuthToken: SetAuthToken): Promise<boolean> {
  const response = await fetch('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (response.ok) {
    persistToken(await response.json(), setAuthToken);
    return true;
  }
  return false;
}

/** Register new user account */
async function doRegister(
  params: RegisterParams,
  setAuthToken: SetAuthToken,
): Promise<{ success: boolean; error?: string }> {
  const response = await fetch('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (response.ok) {
    persistToken(await response.json(), setAuthToken);
    return { success: true };
  }
  const errorData = await response.json();
  return { success: false, error: errorData.error || 'Registration failed' };
}

/** Hook to set up token expiration checking interval */
function useTokenExpirationCheck(authToken: AuthToken | null, checkFn: () => boolean) {
  useEffect(() => {
    if (!authToken) return;
    checkFn();
    const interval = setInterval(checkFn, 60000);
    return () => clearInterval(interval);
  }, [authToken, checkFn]);
}

/** Wrap async action with isAuthenticating state management */
function useAuthAction<T>(
  setIsAuthenticating: (v: boolean) => void,
  action: () => Promise<T>,
  fallback: T,
): () => Promise<T> {
  return async () => {
    setIsAuthenticating(true);
    try {
      return await action();
    } catch (error) {
      console.error('Auth action error:', error);
      return fallback;
    } finally {
      setIsAuthenticating(false);
    }
  };
}

/** Provides authentication state to all child components */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [authToken, setAuthToken] = useState<AuthToken | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const logout = useCallback(() => {
    setAuthToken(null);
    localStorage.removeItem('authToken');
    clearTelemetryUser();
  }, []);
  const checkTokenExpiration = useCallback(() => {
    if (authToken && isTokenExpired(authToken.token)) {
      console.warn('Authentication token expired - logging out');
      logout();
      return true;
    }
    return false;
  }, [authToken, logout]);

  useEffect(() => {
    setAuthToken(loadStoredToken());
  }, []);

  // Update telemetry user context when auth state changes
  useEffect(() => {
    if (authToken?.username) {
      setTelemetryUser(authToken.username);
    } else {
      clearTelemetryUser();
    }
  }, [authToken?.username]);

  useTokenExpirationCheck(authToken, checkTokenExpiration);

  const value: AuthContextValue = {
    authToken,
    authenticate: async (username, password, rememberMe = false) =>
      useAuthAction(
        setIsAuthenticating,
        () => doLogin({ username, password, rememberMe }, setAuthToken),
        false,
      )(),
    register: async (username, email, password, telegramId) =>
      useAuthAction(
        setIsAuthenticating,
        () => doRegister({ username, email, password, telegramId }, setAuthToken),
        { success: false, error: 'Network error occurred' },
      )(),
    logout,
    isAuthenticated: !!authToken,
    isAuthenticating,
    username: authToken?.username,
    checkTokenExpiration,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Hook for accessing authentication state and methods */
export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
