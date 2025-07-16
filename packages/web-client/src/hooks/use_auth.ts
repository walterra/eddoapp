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
    logout,
    isAuthenticated: !!authToken,
    isAuthenticating,
    username: authToken?.username,
  };
};
