import { beforeAll } from 'vitest';

beforeAll(() => {
  // Set up test environment variables
  process.env.JWT_SECRET =
    'test-secret-key-at-least-32-characters-long-for-testing';
  process.env.COUCHDB_URL = 'http://admin:password@localhost:5984';
  process.env.COUCHDB_DB_NAME = 'test-db';
  process.env.NODE_ENV = 'test';
});
