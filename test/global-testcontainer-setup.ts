/**
 * Global Testcontainer Setup
 * Manages CouchDB container lifecycle for integration and e2e tests
 */
import { CouchDBContainer, type StartedCouchDBContainer } from '@testcontainers/couchdb';
import fs from 'fs';
import path from 'path';

let container: StartedCouchDBContainer | null = null;

// File to share container URL between global setup and test workers
const CONTAINER_URL_FILE = path.join(process.cwd(), '.testcontainer-url');

/**
 * Start CouchDB container and expose connection details via file
 */
export async function setupTestcontainer(): Promise<void> {
  // Guard against multiple calls (e.g., if module is imported multiple times)
  if (container) {
    console.log('🐳 CouchDB testcontainer already running, reusing existing container');
    return;
  }

  try {
    // Start CouchDB container with default credentials
    container = await new CouchDBContainer('couchdb:3')
      .withUsername('admin')
      .withPassword('testpassword')
      .withExposedPorts(5984)
      .start();

    const url = `http://${container.getHost()}:${container.getMappedPort(5984)}`;
    const urlWithAuth = `http://admin:testpassword@${container.getHost()}:${container.getMappedPort(5984)}`;

    // Write connection details to file for test workers to read
    const connectionInfo = {
      url: urlWithAuth,
      host: container.getHost(),
      port: container.getMappedPort(5984).toString(),
      protocol: 'http',
      username: 'admin',
      password: 'testpassword',
    };

    fs.writeFileSync(CONTAINER_URL_FILE, JSON.stringify(connectionInfo, null, 2));

    console.log(`✅ CouchDB testcontainer started: ${url}`);
    console.log(`   Container ID: ${container.getId()}`);
    console.log(`   Connection info written to: ${CONTAINER_URL_FILE}`);
  } catch (error) {
    console.error('❌ Failed to start CouchDB testcontainer:', error);
    throw error;
  }
}

/**
 * Stop CouchDB container and cleanup connection info file
 */
export async function teardownTestcontainer(): Promise<void> {
  if (container) {
    console.log('🛑 Stopping CouchDB testcontainer...');
    try {
      await container.stop();
      console.log('✅ CouchDB testcontainer stopped');
    } catch (error) {
      console.error('⚠️  Failed to stop CouchDB testcontainer:', error);
      // Don't throw - cleanup should be best-effort
    } finally {
      container = null;
    }
  }

  // Clean up connection info file
  try {
    if (fs.existsSync(CONTAINER_URL_FILE)) {
      fs.unlinkSync(CONTAINER_URL_FILE);
      console.log('✅ Cleaned up connection info file');
    }
  } catch (error) {
    console.warn('⚠️  Failed to clean up connection info file:', error);
  }
}

/**
 * Load testcontainer connection info from file (for test workers)
 */
export function loadTestcontainerConfig() {
  try {
    if (fs.existsSync(CONTAINER_URL_FILE)) {
      const config = JSON.parse(fs.readFileSync(CONTAINER_URL_FILE, 'utf-8'));

      // Override COUCHDB_URL with testcontainer URL
      // Test code uses getTestCouchDbConfig() which falls back to COUCHDB_URL
      process.env.COUCHDB_URL = config.url;

      return config;
    }
  } catch (error) {
    console.warn('⚠️  Failed to load testcontainer config:', error);
  }
  return null;
}

/**
 * Get the running container instance (for debugging/advanced usage)
 */
export function getTestcontainer(): StartedCouchDBContainer | null {
  return container;
}
