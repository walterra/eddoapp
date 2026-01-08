/**
 * Tests for HealthIndicatorPopover component
 */
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { DatabaseHealthCheck } from '@eddo/core-client';

import '../test-polyfill';
import { HealthIndicatorPopover } from './health_indicator_popover';

const createHealthCheck = (overrides: Partial<DatabaseHealthCheck> = {}): DatabaseHealthCheck => ({
  status: 'healthy',
  timestamp: new Date('2026-01-08T10:00:00.000Z'),
  issues: [],
  metrics: {
    isConnected: true,
    lastSuccessfulOperation: new Date('2026-01-08T09:59:00.000Z'),
    lastResponseTime: 42,
    syncStatus: 'connected',
    consecutiveFailures: 0,
    storageQuota: {
      used: 1000000,
      available: 10000000,
      percentage: 10,
    },
    ...overrides.metrics,
  },
  ...overrides,
});

describe('HealthIndicatorPopover', () => {
  describe('rendering', () => {
    it('should render unknown status when healthCheck is null', () => {
      render(<HealthIndicatorPopover databaseName="test-db" healthCheck={null} />);

      const indicator = screen.getByTitle('Database status unknown');
      expect(indicator).toBeInTheDocument();
    });

    it('should render healthy status indicator', () => {
      const healthCheck = createHealthCheck({ status: 'healthy' });

      render(<HealthIndicatorPopover databaseName="test-db" healthCheck={healthCheck} />);

      const button = screen.getByRole('button', { name: /database health status/i });
      expect(button).toHaveAttribute('title', 'Database: Healthy');
    });

    it('should render degraded status indicator', () => {
      const healthCheck = createHealthCheck({ status: 'degraded' });

      render(<HealthIndicatorPopover databaseName="test-db" healthCheck={healthCheck} />);

      const button = screen.getByRole('button', { name: /database health status/i });
      expect(button).toHaveAttribute('title', 'Database: Degraded');
    });

    it('should render unhealthy status indicator', () => {
      const healthCheck = createHealthCheck({ status: 'unhealthy' });

      render(<HealthIndicatorPopover databaseName="test-db" healthCheck={healthCheck} />);

      const button = screen.getByRole('button', { name: /database health status/i });
      expect(button).toHaveAttribute('title', 'Database: Unhealthy');
    });
  });

  describe('popover interactions', () => {
    it('should open popover when clicked', async () => {
      const healthCheck = createHealthCheck();

      render(<HealthIndicatorPopover databaseName="test-db" healthCheck={healthCheck} />);

      const button = screen.getByRole('button', { name: /database health status/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('Healthy')).toBeInTheDocument();
        expect(screen.getByText('test-db')).toBeInTheDocument();
      });
    });

    it('should close popover on escape key', async () => {
      const healthCheck = createHealthCheck();

      render(<HealthIndicatorPopover databaseName="test-db" healthCheck={healthCheck} />);

      const button = screen.getByRole('button', { name: /database health status/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('Healthy')).toBeInTheDocument();
      });

      fireEvent.keyDown(document, { key: 'Escape' });

      await waitFor(() => {
        // The status text in the popover should be gone
        expect(screen.queryByText('Database')).not.toBeInTheDocument();
      });
    });
  });

  describe('popover content', () => {
    it('should display database name', async () => {
      const healthCheck = createHealthCheck();

      render(<HealthIndicatorPopover databaseName="my-database" healthCheck={healthCheck} />);

      fireEvent.click(screen.getByRole('button', { name: /database health status/i }));

      await waitFor(() => {
        expect(screen.getByText('my-database')).toBeInTheDocument();
      });
    });

    it('should display response time', async () => {
      const healthCheck = createHealthCheck({
        metrics: {
          isConnected: true,
          lastSuccessfulOperation: new Date(),
          lastResponseTime: 123,
          syncStatus: 'connected',
          consecutiveFailures: 0,
          storageQuota: null,
        },
      });

      render(<HealthIndicatorPopover databaseName="test-db" healthCheck={healthCheck} />);

      fireEvent.click(screen.getByRole('button', { name: /database health status/i }));

      await waitFor(() => {
        expect(screen.getByText('(123ms)')).toBeInTheDocument();
      });
    });

    it('should display sync status', async () => {
      const healthCheck = createHealthCheck({
        metrics: {
          isConnected: true,
          lastSuccessfulOperation: new Date(),
          lastResponseTime: 42,
          syncStatus: 'connected',
          consecutiveFailures: 0,
          storageQuota: null,
        },
      });

      render(<HealthIndicatorPopover databaseName="test-db" healthCheck={healthCheck} />);

      fireEvent.click(screen.getByRole('button', { name: /database health status/i }));

      await waitFor(() => {
        expect(screen.getByText('connected')).toBeInTheDocument();
      });
    });

    it('should display storage percentage', async () => {
      const healthCheck = createHealthCheck({
        metrics: {
          isConnected: true,
          lastSuccessfulOperation: new Date(),
          lastResponseTime: 42,
          syncStatus: 'connected',
          consecutiveFailures: 0,
          storageQuota: {
            used: 5000000,
            available: 10000000,
            percentage: 50,
          },
        },
      });

      render(<HealthIndicatorPopover databaseName="test-db" healthCheck={healthCheck} />);

      fireEvent.click(screen.getByRole('button', { name: /database health status/i }));

      await waitFor(() => {
        expect(screen.getByText('50.0%')).toBeInTheDocument();
      });
    });

    it('should display consecutive failures when present', async () => {
      const healthCheck = createHealthCheck({
        metrics: {
          isConnected: false,
          lastSuccessfulOperation: new Date(),
          lastResponseTime: 42,
          syncStatus: 'error',
          consecutiveFailures: 3,
          storageQuota: null,
        },
      });

      render(<HealthIndicatorPopover databaseName="test-db" healthCheck={healthCheck} />);

      fireEvent.click(screen.getByRole('button', { name: /database health status/i }));

      await waitFor(() => {
        expect(screen.getByText('3')).toBeInTheDocument();
        expect(screen.getByText('Failures')).toBeInTheDocument();
      });
    });
  });

  describe('issues display', () => {
    it('should display critical issues', async () => {
      const healthCheck = createHealthCheck({
        status: 'unhealthy',
        issues: [
          {
            type: 'connectivity',
            severity: 'critical',
            message: 'Database connection lost',
            autoResolvable: false,
          },
        ],
      });

      render(<HealthIndicatorPopover databaseName="test-db" healthCheck={healthCheck} />);

      fireEvent.click(screen.getByRole('button', { name: /database health status/i }));

      await waitFor(() => {
        expect(screen.getByText('Critical:')).toBeInTheDocument();
        expect(screen.getByText('Database connection lost')).toBeInTheDocument();
      });
    });

    it('should display high severity issues as warnings', async () => {
      const healthCheck = createHealthCheck({
        status: 'degraded',
        issues: [
          {
            type: 'sync',
            severity: 'high',
            message: 'Sync delayed',
            autoResolvable: true,
          },
        ],
      });

      render(<HealthIndicatorPopover databaseName="test-db" healthCheck={healthCheck} />);

      fireEvent.click(screen.getByRole('button', { name: /database health status/i }));

      await waitFor(() => {
        expect(screen.getByText('Warning:')).toBeInTheDocument();
        expect(screen.getByText('Sync delayed')).toBeInTheDocument();
      });
    });

    it('should not display low severity issues', async () => {
      const healthCheck = createHealthCheck({
        issues: [
          {
            type: 'performance',
            severity: 'low',
            message: 'Minor issue',
            autoResolvable: true,
          },
        ],
      });

      render(<HealthIndicatorPopover databaseName="test-db" healthCheck={healthCheck} />);

      fireEvent.click(screen.getByRole('button', { name: /database health status/i }));

      await waitFor(() => {
        expect(screen.getByText('Healthy')).toBeInTheDocument();
      });

      expect(screen.queryByText('Minor issue')).not.toBeInTheDocument();
    });
  });
});
