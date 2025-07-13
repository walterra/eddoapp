import type PouchDB from 'pouchdb-browser';

export interface DatabaseConfig {
  name: string;
  adapter?: string;
  // Add other PouchDB options as needed
}

export type DatabaseFactory = (config: DatabaseConfig) => PouchDB.Database;

/**
 * Creates a PouchDB database instance with the given configuration
 */
export function createDatabase(
  PouchDBConstructor: typeof PouchDB,
  config: DatabaseConfig,
): PouchDB.Database {
  const { name, adapter, ...otherOptions } = config;

  const options: PouchDB.Configuration.DatabaseConfiguration = {
    ...otherOptions,
  };

  if (adapter) {
    options.adapter = adapter;
  }

  return new PouchDBConstructor(name, options);
}
