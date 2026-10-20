/** Types the couchbackup API used by Eddo's backup and restore scripts. */
declare module '@cloudant/couchbackup' {
  import type { EventEmitter } from 'node:events';
  import type { Readable, Writable } from 'node:stream';

  export interface BackupOptions {
    parallelism?: number;
    requestTimeout?: number;
    logfile?: string;
    attachments?: boolean;
    mode?: 'full' | 'shallow';
  }
  export interface RestoreOptions {
    parallelism?: number;
    requestTimeout?: number;
    logfile?: string;
    attachments?: boolean;
  }
  export type CompletionCallback = (error: Error | null, data?: unknown) => void;
  export interface CouchBackupLibrary {
    backup: (
      url: string,
      output: Writable,
      options: BackupOptions,
      callback: CompletionCallback,
    ) => EventEmitter;
    restore: (
      input: Readable,
      url: string,
      options: RestoreOptions,
      callback: CompletionCallback,
    ) => EventEmitter;
  }
  const couchbackup: CouchBackupLibrary;
  export default couchbackup;
}
