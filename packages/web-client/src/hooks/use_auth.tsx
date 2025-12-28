import { isTokenExpired } from '@eddo/core-client';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';

interface AuthToken {
  token: string;
  username: string;
  expiresIn: string;
}

interface AuthContextValue {
  authToken: AuthToken | null;
  authenticate: (username: string, password: string) => Promise<boolean>;
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

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Provides authentication state to all child components.
 * Manages auth token, login/logout, and token expiration checking.
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [authToken, setAuthToken] = useState<AuthToken | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const authenticate = async (username: string, password: string): Promise<boolean> => {
    setIsAuthenticating(true);
    try {
      const response = await fetch('/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      if (response.ok) {
        const token = await response.json();
        setAuthToken(token);
        localStorage.setItem('authToken', JSON.stringify(token));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Authentication error:', error);
      return false;
    } finally {
      setIsAuthenticating(false);
    }
  };

  const register = async (
    username: string,
    email: string,
    password: string,
    telegramId?: number,
  ): Promise<{ success: boolean; error?: string }> => {
    setIsAuthenticating(true);
    try {
      const response = await fetch('/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, email, password, telegramId }),
      });

      if (response.ok) {
        const token = await response.json();
        setAuthToken(token);
        localStorage.setItem('authToken', JSON.stringify(token));
        return { success: true };
      } else {
        const errorData = await response.json();
        return {
          success: false,
          error: errorData.error || 'Registration failed',
        };
      }
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, error: 'Network error occurred' };
    } finally {
      setIsAuthenticating(false);
    }
  };

  const logout = useCallback(() => {
    setAuthToken(null);
    localStorage.removeItem('authToken');
  }, []);

  const checkTokenExpiration = useCallback(() => {
    if (authToken && isTokenExpired(authToken.token)) {
      console.warn('Authentication token expired - logging out');
      logout();
      return true;
    }
    return false;
  }, [authToken, logout]);

  // Load token from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('authToken');
    if (stored) {
      try {
        const token = JSON.parse(stored);
        if (isTokenExpired(token.token)) {
          console.warn('Stored token is expired - removing');
          localStorage.removeItem('authToken');
        } else {
          setAuthToken(token);
        }
      } catch (error) {
        console.error('Invalid stored token:', error);
        localStorage.removeItem('authToken');
      }
    }
  }, []);

  // Periodically check for token expiration
  useEffect(() => {
    if (!authToken) {
      return;
    }

    checkTokenExpiration();

    const interval = setInterval(() => {
      checkTokenExpiration();
    }, 60000); // 1 minute

    return () => clearInterval(interval);
  }, [authToken, checkTokenExpiration]);

  const value: AuthContextValue = {
    authToken,
    authenticate,
    register,
    logout,
    isAuthenticated: !!authToken,
    isAuthenticating,
    username: authToken?.username,
    checkTokenExpiration,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook for accessing authentication state and methods.
 * Must be used within an AuthProvider.
 */
export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
