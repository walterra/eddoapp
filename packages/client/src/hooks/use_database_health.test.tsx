import { DatabaseHealthCheck } from '@eddo/shared';
import '@testing-library/jest-dom';
import { act, renderHook } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PouchDbContext, type PouchDbContextType } from '../pouch_db_types';
import '../test-polyfill';
import { createTestPouchDb, destroyTestPouchDb } from '../test-setup';
import { useDatabaseHealth } from './use_database_health';

describe('useDatabaseHealth', () => {
  let testDb: PouchDB.Database;
  let contextValue: PouchDbContextType;

  beforeEach(async () => {
    const setup = createTestPouchDb();
    testDb = setup.db;
    contextValue = setup.contextValue;
  });

  afterEach(async () => {
    await destroyTestPouchDb(testDb);
  });

  const renderHookWithContext = () => {
    return renderHook(() => useDatabaseHealth(), {
      wrapper: ({ children }) =>
        React.createElement(
          PouchDbContext.Provider,
          { value: contextValue },
          children,
        ),
    });
  };

  describe('Initial state', () => {
    it('returns initial state with null health check', () => {
      const { result } = renderHookWithContext();

      expect(result.current.healthCheck).toBeNull();
      expect(result.current.isMonitoring).toBe(false);
      expect(typeof result.current.startMonitoring).toBe('function');
      expect(typeof result.current.stopMonitoring).toBe('function');
      expect(typeof result.current.performHealthCheck).toBe('function');
    });
  });

  describe('Health monitoring', () => {
    it('starts monitoring when startMonitoring is called', () => {
      const { result } = renderHookWithContext();
      const startSpy = vi.spyOn(contextValue.healthMonitor, 'start');

      act(() => {
        result.current.startMonitoring();
      });

      expect(startSpy).toHaveBeenCalledTimes(1);
      expect(result.current.isMonitoring).toBe(true);
    });

    it('does not start monitoring if already monitoring', () => {
      const { result } = renderHookWithContext();
      const startSpy = vi.spyOn(contextValue.healthMonitor, 'start');

      // First call starts monitoring
      act(() => {
        result.current.startMonitoring();
      });

      expect(result.current.isMonitoring).toBe(true);
      expect(startSpy).toHaveBeenCalledTimes(1);

      // Second call should be ignored
      act(() => {
        result.current.startMonitoring();
      });

      expect(startSpy).toHaveBeenCalledTimes(1); // Still 1, not 2
      expect(result.current.isMonitoring).toBe(true);
    });

    it('stops monitoring when stopMonitoring is called', () => {
      const { result } = renderHookWithContext();
      const stopSpy = vi.spyOn(contextValue.healthMonitor, 'stop');

      // First start monitoring
      act(() => {
        result.current.startMonitoring();
      });

      expect(result.current.isMonitoring).toBe(true);

      // Then stop monitoring
      act(() => {
        result.current.stopMonitoring();
      });

      expect(stopSpy).toHaveBeenCalledTimes(1);
      expect(result.current.isMonitoring).toBe(false);
    });

    it('does not stop monitoring if not monitoring', () => {
      const { result } = renderHookWithContext();
      const stopSpy = vi.spyOn(contextValue.healthMonitor, 'stop');

      act(() => {
        result.current.stopMonitoring(); // Should be ignored
      });

      expect(stopSpy).not.toHaveBeenCalled();
      expect(result.current.isMonitoring).toBe(false);
    });
  });

  describe('Health check updates', () => {
    it('updates health check when health monitor emits update', () => {
      const { result } = renderHookWithContext();
      const mockHealthCheck: DatabaseHealthCheck = {
        status: 'healthy',
        timestamp: new Date(),
        metrics: {
          isConnected: true,
          lastSuccessfulOperation: new Date(),
          consecutiveFailures: 0,
          lastResponseTime: 50,
          syncStatus: 'connected',
          storageQuota: null,
        },
        issues: [],
      };

      // Simulate health update
      act(() => {
        // Find the listener that was added
        const listeners =
          (
            contextValue.healthMonitor as unknown as {
              listeners?: ((check: DatabaseHealthCheck) => void)[];
            }
          ).listeners || [];
        if (listeners.length > 0) {
          listeners[0](mockHealthCheck);
        }
      });

      expect(result.current.healthCheck).toEqual(mockHealthCheck);
    });

    it('handles multiple health check updates', () => {
      const { result } = renderHookWithContext();
      const firstCheck: DatabaseHealthCheck = {
        status: 'healthy',
        timestamp: new Date(),
        metrics: {
          isConnected: true,
          lastSuccessfulOperation: new Date(),
          consecutiveFailures: 0,
          lastResponseTime: 50,
          syncStatus: 'connected',
          storageQuota: null,
        },
        issues: [],
      };
      const secondCheck: DatabaseHealthCheck = {
        status: 'degraded',
        timestamp: new Date(),
        metrics: {
          isConnected: true,
          lastSuccessfulOperation: new Date(),
          consecutiveFailures: 1,
          lastResponseTime: 200,
          syncStatus: 'syncing',
          storageQuota: null,
        },
        issues: [],
      };

      act(() => {
        const listeners =
          (
            contextValue.healthMonitor as unknown as {
              listeners?: ((check: DatabaseHealthCheck) => void)[];
            }
          ).listeners || [];
        if (listeners.length > 0) {
          listeners[0](firstCheck);
        }
      });

      expect(result.current.healthCheck).toEqual(firstCheck);

      act(() => {
        const listeners =
          (
            contextValue.healthMonitor as unknown as {
              listeners?: ((check: DatabaseHealthCheck) => void)[];
            }
          ).listeners || [];
        if (listeners.length > 0) {
          listeners[0](secondCheck);
        }
      });

      expect(result.current.healthCheck).toEqual(secondCheck);
    });
  });

  describe('Manual health check', () => {
    it('performs manual health check and returns result', async () => {
      const { result } = renderHookWithContext();
      const mockHealthCheck: DatabaseHealthCheck = {
        status: 'healthy',
        timestamp: new Date(),
        metrics: {
          isConnected: true,
          lastSuccessfulOperation: new Date(),
          consecutiveFailures: 0,
          lastResponseTime: 30,
          syncStatus: 'connected',
          storageQuota: null,
        },
        issues: [],
      };

      const performHealthCheckSpy = vi
        .spyOn(contextValue.healthMonitor, 'performHealthCheck')
        .mockResolvedValue(mockHealthCheck);

      let healthCheckResult: DatabaseHealthCheck;
      await act(async () => {
        healthCheckResult = await result.current.performHealthCheck();
      });

      expect(performHealthCheckSpy).toHaveBeenCalledTimes(1);
      expect(healthCheckResult!).toEqual(mockHealthCheck);
    });

    it('handles health check errors', async () => {
      const { result } = renderHookWithContext();
      const error = new Error('Health check failed');

      const performHealthCheckSpy = vi
        .spyOn(contextValue.healthMonitor, 'performHealthCheck')
        .mockRejectedValue(error);

      await act(async () => {
        await expect(result.current.performHealthCheck()).rejects.toThrow(
          'Health check failed',
        );
      });

      expect(performHealthCheckSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Cleanup', () => {
    it('removes listener when component unmounts', () => {
      const removeListenerSpy = vi.spyOn(
        contextValue.healthMonitor,
        'removeListener',
      );
      const addListenerSpy = vi.spyOn(
        contextValue.healthMonitor,
        'addListener',
      );

      const { unmount } = renderHookWithContext();

      expect(addListenerSpy).toHaveBeenCalledTimes(1);

      unmount();

      expect(removeListenerSpy).toHaveBeenCalledTimes(1);
      expect(removeListenerSpy).toHaveBeenCalledWith(
        addListenerSpy.mock.calls[0][0],
      );
    });

    it('removes the same listener that was added', () => {
      const listeners: ((check: DatabaseHealthCheck) => void)[] = [];
      const addListenerSpy = vi
        .spyOn(contextValue.healthMonitor, 'addListener')
        .mockImplementation((listener) => {
          listeners.push(listener);
        });
      const removeListenerSpy = vi
        .spyOn(contextValue.healthMonitor, 'removeListener')
        .mockImplementation((listener) => {
          const index = listeners.indexOf(listener);
          if (index > -1) {
            listeners.splice(index, 1);
          }
        });

      const { unmount } = renderHookWithContext();

      expect(listeners).toHaveLength(1);

      unmount();

      expect(listeners).toHaveLength(0);
      expect(addListenerSpy).toHaveBeenCalledTimes(1);
      expect(removeListenerSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Integration with health monitor', () => {
    it('works with real health monitor lifecycle', () => {
      const { result } = renderHookWithContext();

      // Start monitoring
      act(() => {
        result.current.startMonitoring();
      });

      expect(result.current.isMonitoring).toBe(true);

      // Stop monitoring
      act(() => {
        result.current.stopMonitoring();
      });

      expect(result.current.isMonitoring).toBe(false);
    });

    it('maintains state consistency across operations', () => {
      const { result } = renderHookWithContext();

      // Initial state
      expect(result.current.isMonitoring).toBe(false);
      expect(result.current.healthCheck).toBeNull();

      // Start monitoring
      act(() => {
        result.current.startMonitoring();
      });

      expect(result.current.isMonitoring).toBe(true);

      // Simulate health update
      const healthCheck: DatabaseHealthCheck = {
        status: 'healthy',
        timestamp: new Date(),
        metrics: {
          isConnected: true,
          lastSuccessfulOperation: new Date(),
          consecutiveFailures: 0,
          lastResponseTime: 45,
          syncStatus: 'connected',
          storageQuota: null,
        },
        issues: [],
      };

      act(() => {
        const listeners =
          (
            contextValue.healthMonitor as unknown as {
              listeners?: ((check: DatabaseHealthCheck) => void)[];
            }
          ).listeners || [];
        if (listeners.length > 0) {
          listeners[0](healthCheck);
        }
      });

      expect(result.current.healthCheck).toEqual(healthCheck);
      expect(result.current.isMonitoring).toBe(true);

      // Stop monitoring
      act(() => {
        result.current.stopMonitoring();
      });

      expect(result.current.isMonitoring).toBe(false);
      expect(result.current.healthCheck).toEqual(healthCheck); // Health check persists
    });
  });
});
