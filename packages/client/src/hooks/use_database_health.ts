/**
 * React hook for database health monitoring
 */
import { DatabaseHealthCheck } from '@eddo/shared';
import { useEffect, useState } from 'react';

import { usePouchDb } from '../pouch_db';

export interface DatabaseHealthState {
  /** Current health check result */
  healthCheck: DatabaseHealthCheck | null;
  /** Whether health monitoring is active */
  isMonitoring: boolean;
  /** Start health monitoring */
  startMonitoring: () => void;
  /** Stop health monitoring */
  stopMonitoring: () => void;
  /** Perform manual health check */
  performHealthCheck: () => Promise<DatabaseHealthCheck>;
}

/**
 * Hook for monitoring database health
 */
export const useDatabaseHealth = (): DatabaseHealthState => {
  const { healthMonitor } = usePouchDb();
  const [healthCheck, setHealthCheck] = useState<DatabaseHealthCheck | null>(
    null,
  );
  const [isMonitoring, setIsMonitoring] = useState(false);

  useEffect(() => {
    const handleHealthUpdate = (check: DatabaseHealthCheck) => {
      setHealthCheck(check);
    };

    healthMonitor.addListener(handleHealthUpdate);

    return () => {
      healthMonitor.removeListener(handleHealthUpdate);
    };
  }, [healthMonitor]);

  const startMonitoring = () => {
    if (!isMonitoring) {
      healthMonitor.start();
      setIsMonitoring(true);
    }
  };

  const stopMonitoring = () => {
    if (isMonitoring) {
      healthMonitor.stop();
      setIsMonitoring(false);
    }
  };

  const performHealthCheck = async () => {
    const check = await healthMonitor.performHealthCheck();
    return check;
  };

  return {
    healthCheck,
    isMonitoring,
    startMonitoring,
    stopMonitoring,
    performHealthCheck,
  };
};
