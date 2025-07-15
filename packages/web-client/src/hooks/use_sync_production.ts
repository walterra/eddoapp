import PouchDB from 'pouchdb-browser';
import { useEffect, useState } from 'react';

import { usePouchDb } from '../pouch_db';

interface AuthToken {
  token: string;
  username: string;
  expiresIn: string;
}

export const useSyncProduction = () => {
  const { sync } = usePouchDb();
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

  useEffect(() => {
    if (!authToken) return;

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

    // Create a custom adapter for PouchDB that uses our authenticated API
    const remoteDb = new PouchDB(`${apiUrl}/db`, {
      fetch: (url, opts) => {
        // Add authentication header to all requests
        return fetch(url, {
          ...opts,
          headers: {
            ...opts?.headers,
            Authorization: `Bearer ${authToken.token}`,
            'Content-Type': 'application/json',
          },
        });
      },
    });

    const syncHandler = sync(remoteDb, {
      live: true,
      retry: true,
    });

    return () => syncHandler.cancel();
  }, [sync, authToken]);

  return {
    authenticate,
    logout,
    isAuthenticated: !!authToken,
    isAuthenticating,
    username: authToken?.username,
  };
};
