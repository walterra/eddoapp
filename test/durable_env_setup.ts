import { loadTestcontainerConfig } from './global-testcontainer-setup.js';

// Configure production imports before test modules evaluate them.
if (!loadTestcontainerConfig()) {
  throw new Error('Durable integration tests require the global CouchDB testcontainer setup');
}
process.env.COUCHDB_API_KEY = '';
process.env.COUCHDB_DB_NAME = 'eddo_test';
process.env.DATABASE_TEST_PREFIX = 'eddo_test';
process.env.NODE_ENV = 'test';
process.env.TELEGRAM_BOT_TOKEN = 'test-token';
