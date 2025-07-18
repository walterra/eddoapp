/**
 * Shared utilities for backup and restore operations
 */

import fs from 'fs';
import path from 'path';
import type { BackupOptions as CouchBackupOptions, RestoreOptions as CouchRestoreOptions } from '@cloudant/couchbackup';

export interface BackupOptions extends CouchBackupOptions {
  parallelism?: number;
  requestTimeout?: number;
  logfile?: string;
}

export interface RestoreOptions extends CouchRestoreOptions {
  parallelism?: number;
  requestTimeout?: number;
  logfile?: string;
}

export interface DatabaseInfo {
  exists: boolean;
  docCount: number;
}

export interface BackupFileInfo {
  path: string;
  database: string;
  timestamp: string;
  size: number;
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG = {
  backupDir: process.env.BACKUP_DIR || './backups',
  parallelism: 5,
  timeout: 60000,
} as const;

/**
 * Ensure backup directory exists
 */
export function ensureBackupDir(backupDir: string = DEFAULT_CONFIG.backupDir): void {
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
}

/**
 * Generate backup filename with timestamp
 */
export function generateBackupFilename(database: string, backupDir: string = DEFAULT_CONFIG.backupDir): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return path.join(backupDir, `${database}-${timestamp}.json`);
}

/**
 * Get latest backup file for a database
 */
export function getLatestBackupFile(database: string, backupDir: string = DEFAULT_CONFIG.backupDir): string {
  if (!fs.existsSync(backupDir)) {
    throw new Error(`Backup directory does not exist: ${backupDir}`);
  }

  const files = fs.readdirSync(backupDir)
    .filter((file) => file.startsWith(`${database}-`) && file.endsWith('.json'))
    .sort()
    .reverse();

  if (files.length === 0) {
    throw new Error(`No backup files found for database: ${database}`);
  }

  return path.join(backupDir, files[0]);
}

/**
 * Get all backup files with metadata
 */
export function getAllBackupFiles(backupDir: string = DEFAULT_CONFIG.backupDir): BackupFileInfo[] {
  if (!fs.existsSync(backupDir)) {
    return [];
  }

  return fs.readdirSync(backupDir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => {
      const fullPath = path.join(backupDir, file);
      const stats = fs.statSync(fullPath);
      
      // Parse database name and timestamp from filename
      const match = file.match(/^(.+?)-([\d-T]+Z)\.json$/);
      if (!match) {
        return null;
      }

      return {
        path: fullPath,
        database: match[1],
        timestamp: match[2].replace(/-/g, ':'),
        size: stats.size,
      };
    })
    .filter((info): info is BackupFileInfo => info !== null)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

/**
 * Check if database exists and get document count
 */
export async function checkDatabaseExists(
  dbName: string,
  couchdbUrl: string
): Promise<DatabaseInfo> {
  try {
    const url = new URL(couchdbUrl);
    const baseUrl = `${url.protocol}//${url.host}`;
    const credentials = url.username && url.password 
      ? Buffer.from(`${url.username}:${url.password}`).toString('base64')
      : null;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (credentials) {
      headers['Authorization'] = `Basic ${credentials}`;
    }

    const response = await fetch(`${baseUrl}/${dbName}`, {
      method: 'GET',
      headers,
    });

    if (response.status === 404) {
      return { exists: false, docCount: 0 };
    }

    if (!response.ok) {
      throw new Error(`Failed to check database: ${response.statusText}`);
    }

    const dbInfo = await response.json();
    return { exists: true, docCount: dbInfo.doc_count || 0 };
    
  } catch (error) {
    throw new Error(`Failed to check database: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Recreate database (delete if exists, then create)
 */
export async function recreateDatabase(
  dbName: string,
  couchdbUrl: string
): Promise<void> {
  try {
    const url = new URL(couchdbUrl);
    const baseUrl = `${url.protocol}//${url.host}`;
    const credentials = url.username && url.password 
      ? Buffer.from(`${url.username}:${url.password}`).toString('base64')
      : null;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (credentials) {
      headers['Authorization'] = `Basic ${credentials}`;
    }

    // Delete existing database
    const deleteResponse = await fetch(`${baseUrl}/${dbName}`, {
      method: 'DELETE',
      headers,
    });

    if (!deleteResponse.ok && deleteResponse.status !== 404) {
      throw new Error(`Failed to delete database: ${deleteResponse.statusText}`);
    }

    // Create new database
    const createResponse = await fetch(`${baseUrl}/${dbName}`, {
      method: 'PUT',
      headers,
    });

    if (!createResponse.ok) {
      throw new Error(`Failed to create database: ${createResponse.statusText}`);
    }

  } catch (error) {
    throw new Error(`Failed to recreate database: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Format file size in human readable format
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Format duration in human readable format
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Parse backup filename to extract metadata
 */
export function parseBackupFilename(filename: string): { database: string; timestamp: string } | null {
  const basename = path.basename(filename, '.json');
  const match = basename.match(/^(.+?)-([\d-T]+Z)$/);
  
  if (!match) {
    return null;
  }

  return {
    database: match[1],
    timestamp: match[2].replace(/-/g, ':'),
  };
}

/**
 * Create default backup options
 */
export function createBackupOptions(overrides?: Partial<BackupOptions>): BackupOptions {
  return {
    parallelism: DEFAULT_CONFIG.parallelism,
    requestTimeout: DEFAULT_CONFIG.timeout,
    ...overrides,
  };
}

/**
 * Create default restore options
 */
export function createRestoreOptions(overrides?: Partial<RestoreOptions>): RestoreOptions {
  return {
    parallelism: DEFAULT_CONFIG.parallelism,
    requestTimeout: DEFAULT_CONFIG.timeout,
    ...overrides,
  };
}

/**
 * Get replication status from CouchDB
 */
export async function getReplicationStatus(
  replicationId: string,
  couchdbUrl: string
): Promise<any> {
  try {
    const url = new URL(couchdbUrl);
    const baseUrl = `${url.protocol}//${url.host}`;
    const credentials = url.username && url.password 
      ? Buffer.from(`${url.username}:${url.password}`).toString('base64')
      : null;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (credentials) {
      headers['Authorization'] = `Basic ${credentials}`;
    }

    const response = await fetch(`${baseUrl}/_replicator/${replicationId}`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      throw new Error(`Failed to get replication status: ${response.statusText}`);
    }

    return await response.json();
    
  } catch (error) {
    throw new Error(`Failed to get replication status: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * List all active replications
 */
export async function listActiveReplications(couchdbUrl: string): Promise<any[]> {
  try {
    const url = new URL(couchdbUrl);
    const baseUrl = `${url.protocol}//${url.host}`;
    const credentials = url.username && url.password 
      ? Buffer.from(`${url.username}:${url.password}`).toString('base64')
      : null;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (credentials) {
      headers['Authorization'] = `Basic ${credentials}`;
    }

    const response = await fetch(`${baseUrl}/_scheduler/jobs`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      throw new Error(`Failed to list replications: ${response.statusText}`);
    }

    const data = await response.json();
    return data.jobs || [];
    
  } catch (error) {
    throw new Error(`Failed to list replications: ${error instanceof Error ? error.message : String(error)}`);
  }
}