import { config } from 'dotenv-mono';
import { loadTestcontainerConfig } from './global-testcontainer-setup';

// Load environment variables from .env file for E2E tests
config();

// Load testcontainer config (overrides .env with dynamic container URL)
loadTestcontainerConfig();
