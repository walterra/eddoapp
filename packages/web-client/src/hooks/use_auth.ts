import { isTokenExpired } from '@eddo/core-client';
import { useCallback, useEffect, useState } from 'react';

interface AuthToken {
  token: string;
  username: string;
  expiresIn: string;
}

export const useAuth = () => {
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

  useEffect(() => {
    // Check for stored auth token
    const stored = localStorage.getItem('authToken');
    if (stored) {
      try {
        const token = JSON.parse(stored);
        // Check if token is expired before setting it
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

    // Check immediately
    checkTokenExpiration();

    // Then check every minute
    const interval = setInterval(() => {
      checkTokenExpiration();
    }, 60000); // 1 minute

    return () => clearInterval(interval);
  }, [authToken, checkTokenExpiration]);

  return {
    authToken,
    authenticate,
    register,
    logout,
    isAuthenticated: !!authToken,
    isAuthenticating,
    username: authToken?.username,
    checkTokenExpiration,
  };
};
