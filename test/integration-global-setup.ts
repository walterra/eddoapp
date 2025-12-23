/**
 * Integration Global Setup
 * Starts CouchDB testcontainer before all integration tests
 */
import { setupTestcontainer, teardownTestcontainer } from './global-testcontainer-setup';

export default async function setup() {
  await setupTestcontainer();
}

export async function teardown() {
  await teardownTestcontainer();
}
