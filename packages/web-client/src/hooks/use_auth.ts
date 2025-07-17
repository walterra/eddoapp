import { useEffect, useState } from 'react';

interface AuthToken {
  token: string;
  username: string;
  expiresIn: string;
}

export const useAuth = () => {
  const [authToken, setAuthToken] = useState<AuthToken | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const authenticate = async (
    username: string,
    password: string,
  ): Promise<boolean> => {
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

  const logout = () => {
    setAuthToken(null);
    localStorage.removeItem('authToken');
  };

  useEffect(() => {
    // Check for stored auth token
    const stored = localStorage.getItem('authToken');
    if (stored) {
      try {
        const token = JSON.parse(stored);
        setAuthToken(token);
      } catch (error) {
        console.error('Invalid stored token:', error);
        localStorage.removeItem('authToken');
      }
    }
  }, []);

  return {
    authToken,
    authenticate,
    register,
    logout,
    isAuthenticated: !!authToken,
    isAuthenticating,
    username: authToken?.username,
  };
};
