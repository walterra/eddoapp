/**
 * Elasticsearch client factory for Eddo.
 * Provides configured ES client for todo search functionality.
 */

import { Client, type ClientOptions } from '@elastic/elasticsearch';

/** Configuration options for creating an ES client */
export interface ElasticsearchClientConfig {
  /** ES node URL (e.g., "http://localhost:9222") */
  node: string;
  /** Optional API key for authentication */
  apiKey?: string;
  /** Optional username for basic auth */
  username?: string;
  /** Optional password for basic auth */
  password?: string;
  /** Skip TLS verification (development only) */
  tlsRejectUnauthorized?: boolean;
}

/**
 * Creates an Elasticsearch client with the given configuration.
 * @param config - Client configuration options
 * @returns Configured Elasticsearch client
 */
export function createElasticsearchClient(config: ElasticsearchClientConfig): Client {
  const clientOptions: ClientOptions = {
    node: config.node,
  };

  // Authentication
  if (config.apiKey) {
    clientOptions.auth = { apiKey: config.apiKey };
  } else if (config.username && config.password) {
    clientOptions.auth = {
      username: config.username,
      password: config.password,
    };
  }

  // TLS configuration
  if (config.tlsRejectUnauthorized === false) {
    clientOptions.tls = { rejectUnauthorized: false };
  }

  return new Client(clientOptions);
}

/**
 * Creates an ES client from environment variables.
 *
 * Environment variables:
 * - ELASTICSEARCH_URL: Node URL (required)
 * - ELASTICSEARCH_API_KEY: API key auth
 * - ELASTICSEARCH_USERNAME: Basic auth username
 * - ELASTICSEARCH_PASSWORD: Basic auth password
 * - ELASTICSEARCH_TLS_REJECT_UNAUTHORIZED: "false" to skip TLS verification
 */
export function createElasticsearchClientFromEnv(): Client {
  const node = process.env.ELASTICSEARCH_URL;

  if (!node) {
    throw new Error('ELASTICSEARCH_URL environment variable is required');
  }

  return createElasticsearchClient({
    node,
    apiKey: process.env.ELASTICSEARCH_API_KEY,
    username: process.env.ELASTICSEARCH_USERNAME,
    password: process.env.ELASTICSEARCH_PASSWORD,
    tlsRejectUnauthorized: process.env.ELASTICSEARCH_TLS_REJECT_UNAUTHORIZED !== 'false',
  });
}

/**
 * Tests the connection to Elasticsearch.
 * @param client - ES client to test
 * @returns Connection info or throws on failure
 */
export async function testConnection(client: Client): Promise<{
  connected: boolean;
  version: string;
  clusterName: string;
}> {
  const info = await client.info();

  return {
    connected: true,
    version: info.version.number,
    clusterName: info.cluster_name,
  };
}
