/**
 * Elasticsearch index manager for Eddo indices.
 * Handles index templates for per-user todo and audit indices.
 *
 * Index naming (1:1 with CouchDB):
 * - eddo_user_<username> - Todo documents
 * - eddo_audit_<username> - Audit log documents
 */

import type { Client } from '@elastic/elasticsearch';
import type {
  IndicesIndexSettings,
  IndicesPutIndexTemplateRequest,
  MappingTypeMapping,
} from '@elastic/elasticsearch/lib/api/types';

import { AUDIT_INDEX_MAPPING, AUDIT_INDEX_TEMPLATE } from './audit-mapping';
import { TODO_INDEX_MAPPING, TODO_INDEX_SETTINGS, TODO_INDEX_TEMPLATE } from './todo-mapping';

/** Result of index management operations */
export interface IndexOperationResult {
  success: boolean;
  message: string;
  details?: Record<string, unknown>;
}

/** Checks if an index exists. */
async function checkIndexExists(client: Client, indexName: string): Promise<boolean> {
  return client.indices.exists({ index: indexName });
}

/** Creates the todo index template. */
async function createTodoTemplate(client: Client): Promise<IndexOperationResult> {
  const request: IndicesPutIndexTemplateRequest = {
    _meta: TODO_INDEX_TEMPLATE._meta as Record<string, unknown>,
    index_patterns: [...TODO_INDEX_TEMPLATE.index_patterns],
    name: 'eddo_user_template',
    priority: TODO_INDEX_TEMPLATE.priority,
    template: {
      mappings: TODO_INDEX_MAPPING as MappingTypeMapping,
      settings: TODO_INDEX_SETTINGS as unknown as IndicesIndexSettings,
    },
  };

  await client.indices.putIndexTemplate(request);
  return { message: 'Index template "eddo_user_template" created/updated', success: true };
}

/** Creates the audit log index template. */
async function createAuditTemplate(client: Client): Promise<IndexOperationResult> {
  const request: IndicesPutIndexTemplateRequest = {
    _meta: AUDIT_INDEX_TEMPLATE._meta as Record<string, unknown>,
    index_patterns: [...AUDIT_INDEX_TEMPLATE.index_patterns],
    name: 'eddo_audit_template',
    priority: AUDIT_INDEX_TEMPLATE.priority,
    template: {
      mappings: AUDIT_INDEX_MAPPING as MappingTypeMapping,
      settings: TODO_INDEX_SETTINGS as unknown as IndicesIndexSettings,
    },
  };

  await client.indices.putIndexTemplate(request);
  return { message: 'Index template "eddo_audit_template" created/updated', success: true };
}

/** Gets health and document count for indices matching a pattern. */
async function getIndicesHealth(client: Client, pattern: string): Promise<IndexOperationResult> {
  try {
    const [stats, count] = await Promise.all([
      client.indices.stats({ index: pattern }),
      client.count({ index: pattern }),
    ]);

    const indices = Object.keys(stats.indices ?? {});

    return {
      details: { indices, totalDocuments: count.count },
      message: `Found ${indices.length} indices matching "${pattern}"`,
      success: true,
    };
  } catch (error) {
    if ((error as { meta?: { statusCode?: number } }).meta?.statusCode === 404) {
      return {
        details: { indices: [], totalDocuments: 0 },
        message: `No indices matching "${pattern}"`,
        success: true,
      };
    }
    throw error;
  }
}

/** Deletes an index. */
async function deleteIndex(client: Client, indexName: string): Promise<IndexOperationResult> {
  const exists = await checkIndexExists(client, indexName);

  if (!exists) {
    return { message: `Index "${indexName}" does not exist`, success: true };
  }

  await client.indices.delete({ index: indexName });
  return { message: `Index "${indexName}" deleted`, success: true };
}

/** Deletes all indices matching a pattern. */
async function deleteIndicesByPattern(
  client: Client,
  pattern: string,
): Promise<IndexOperationResult> {
  try {
    await client.indices.delete({ index: pattern });
    return { message: `Deleted indices matching "${pattern}"`, success: true };
  } catch (error) {
    if ((error as { meta?: { statusCode?: number } }).meta?.statusCode === 404) {
      return { message: `No indices matching "${pattern}" to delete`, success: true };
    }
    throw error;
  }
}

/** Refreshes indices matching a pattern. */
async function refreshIndices(client: Client, pattern: string): Promise<IndexOperationResult> {
  try {
    await client.indices.refresh({ index: pattern });
    return { message: `Refreshed indices matching "${pattern}"`, success: true };
  } catch (error) {
    if ((error as { meta?: { statusCode?: number } }).meta?.statusCode === 404) {
      return { message: `No indices matching "${pattern}" to refresh`, success: true };
    }
    throw error;
  }
}

/** Gets the mapping for an index. */
async function getMapping(client: Client, indexName: string): Promise<IndexOperationResult> {
  const exists = await checkIndexExists(client, indexName);

  if (!exists) {
    return { message: `Index "${indexName}" does not exist`, success: false };
  }

  const response = await client.indices.getMapping({ index: indexName });
  const mappings = response[indexName]?.mappings;

  return {
    details: mappings as unknown as Record<string, unknown>,
    message: 'Mapping retrieved',
    success: true,
  };
}

/** Initializes both index templates. */
async function initializeTemplates(client: Client): Promise<IndexOperationResult> {
  const todoResult = await createTodoTemplate(client);
  const auditResult = await createAuditTemplate(client);

  return {
    details: { auditTemplate: auditResult, todoTemplate: todoResult },
    message: `${todoResult.message}; ${auditResult.message}`,
    success: todoResult.success && auditResult.success,
  };
}

/**
 * Creates an Elasticsearch index manager.
 */
export function createIndexManager(client: Client) {
  return {
    createAuditTemplate: () => createAuditTemplate(client),
    createTodoTemplate: () => createTodoTemplate(client),
    deleteIndex: (indexName: string) => deleteIndex(client, indexName),
    deleteIndicesByPattern: (pattern: string) => deleteIndicesByPattern(client, pattern),
    getIndicesHealth: (pattern: string) => getIndicesHealth(client, pattern),
    getMapping: (indexName: string) => getMapping(client, indexName),
    indexExists: (indexName: string) => checkIndexExists(client, indexName),
    initialize: () => initializeTemplates(client),
    refreshIndices: (pattern: string) => refreshIndices(client, pattern),
  };
}

/** Type for the index manager */
export type IndexManager = ReturnType<typeof createIndexManager>;
