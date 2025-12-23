/**
 * E2E Global Setup
 * Starts CouchDB testcontainer before all e2e tests
 */
import { setupTestcontainer, teardownTestcontainer } from './global-testcontainer-setup';

export default async function setup() {
  await setupTestcontainer();
}

export async function teardown() {
  await teardownTestcontainer();
}
