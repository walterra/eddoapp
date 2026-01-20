/**
 * Elasticsearch index migration module.
 * Handles versioned mappings with blue-green migration strategy.
 *
 * Index naming convention:
 * - Versioned index: eddo_user_<username>_v<version> (e.g., eddo_user_walterra_v2)
 * - Alias: eddo_user_<username> (points to current versioned index)
 *
 * Metadata stored in index settings:
 * - mapping_version: Current mapping version
 * - last_seq: Last synced CouchDB sequence number
 */

import type { Client } from '@elastic/elasticsearch';
import type { Logger } from 'pino';

import { TODO_INDEX_MAPPING, TODO_INDEX_SETTINGS, TODO_MAPPING_VERSION } from './todo-mapping';

/** Index metadata stored in ES index settings */
export interface IndexMetadata {
  mappingVersion: number;
  lastSeq: string;
  createdAt: string;
  updatedAt: string;
}

/** Result of migration check */
export interface MigrationCheckResult {
  needsMigration: boolean;
  needsInitialSync: boolean;
  currentVersion: number | null;
  targetVersion: number;
  lastSeq: string;
  versionedIndexName: string;
  aliasName: string;
}

/** Configuration for index migration */
export interface MigrationConfig {
  esClient: Client;
  logger: Logger;
}

/** Gets the versioned index name for a given alias and version. */
export function getVersionedIndexName(aliasName: string, version: number): string {
  return `${aliasName}_v${version}`;
}

/** Parses a versioned index name to extract the base alias and version. */
export function parseVersionedIndexName(
  indexName: string,
): { aliasName: string; version: number } | null {
  const match = indexName.match(/^(.+)_v(\d+)$/);
  if (!match) return null;
  return { aliasName: match[1], version: parseInt(match[2], 10) };
}

/** Extracts metadata from mapping _meta field. */
function extractMetadataFromMapping(
  meta: Record<string, string> | undefined,
): IndexMetadata | null {
  if (!meta) return null;

  return {
    createdAt: meta.created_at || '',
    lastSeq: meta.last_seq || '0',
    mappingVersion: parseInt(meta.mapping_version || '0', 10),
    updatedAt: meta.updated_at || '',
  };
}

/** Gets metadata from an existing index's mapping _meta field. */
async function getIndexMetadata(
  esClient: Client,
  indexName: string,
): Promise<IndexMetadata | null> {
  try {
    const response = await esClient.indices.getMapping({ index: indexName });
    const meta = response[indexName]?.mappings?._meta as Record<string, string> | undefined;
    return extractMetadataFromMapping(meta);
  } catch (error) {
    if ((error as { meta?: { statusCode?: number } }).meta?.statusCode === 404) {
      return null;
    }
    throw error;
  }
}

/** Updates the last_seq metadata in an index's mapping _meta. */
async function updateLastSeq(
  esClient: Client,
  logger: Logger,
  indexName: string,
  lastSeq: string,
): Promise<void> {
  try {
    // Get current _meta to preserve other fields
    const currentMeta = await getIndexMetadata(esClient, indexName);

    await esClient.indices.putMapping({
      index: indexName,
      _meta: {
        created_at: currentMeta?.createdAt || new Date().toISOString(),
        last_seq: lastSeq,
        mapping_version: String(currentMeta?.mappingVersion || TODO_MAPPING_VERSION),
        updated_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error({ error, indexName, lastSeq }, 'Failed to update last_seq');
    throw error;
  }
}

/** Finds index from alias response. */
async function findIndexFromAlias(
  esClient: Client,
  aliasName: string,
): Promise<{ indexName: string; version: number } | null> {
  const aliasResponse = await esClient.indices.getAlias({ name: aliasName });
  const indices = Object.keys(aliasResponse);

  if (indices.length === 0) return null;

  const indexName = indices[0];
  const parsed = parseVersionedIndexName(indexName);
  return parsed ? { indexName, version: parsed.version } : { indexName, version: 0 };
}

/** Finds the current versioned index for an alias. */
async function findCurrentVersionedIndex(
  esClient: Client,
  aliasName: string,
): Promise<{ indexName: string; version: number } | null> {
  // Check if alias exists
  const aliasExists = await esClient.indices.existsAlias({ name: aliasName });
  if (aliasExists) {
    return findIndexFromAlias(esClient, aliasName);
  }

  // Check if non-aliased index exists (legacy or first run)
  const indexExists = await esClient.indices.exists({ index: aliasName });
  if (indexExists) {
    return { indexName: aliasName, version: 0 };
  }

  return null;
}

/** Builds migration check result for non-existent index. */
function buildNewIndexResult(aliasName: string): MigrationCheckResult {
  return {
    aliasName,
    currentVersion: null,
    lastSeq: '0',
    needsInitialSync: true,
    needsMigration: false,
    targetVersion: TODO_MAPPING_VERSION,
    versionedIndexName: getVersionedIndexName(aliasName, TODO_MAPPING_VERSION),
  };
}

/** Builds migration check result for existing index. */
function buildExistingIndexResult(
  aliasName: string,
  currentIndexName: string,
  currentVersion: number,
  lastSeq: string,
): MigrationCheckResult {
  const needsMigration = currentVersion < TODO_MAPPING_VERSION;

  return {
    aliasName,
    currentVersion,
    lastSeq: needsMigration ? '0' : lastSeq, // Full resync for migration
    needsInitialSync: needsMigration || lastSeq === '0',
    needsMigration,
    targetVersion: TODO_MAPPING_VERSION,
    versionedIndexName: needsMigration
      ? getVersionedIndexName(aliasName, TODO_MAPPING_VERSION)
      : currentIndexName,
  };
}

/** Checks if migration is needed for a database. */
async function checkMigration(esClient: Client, aliasName: string): Promise<MigrationCheckResult> {
  const current = await findCurrentVersionedIndex(esClient, aliasName);

  if (!current) {
    return buildNewIndexResult(aliasName);
  }

  const metadata = await getIndexMetadata(esClient, current.indexName);
  const currentVersion = metadata?.mappingVersion ?? current.version;
  const lastSeq = metadata?.lastSeq ?? '0';

  return buildExistingIndexResult(aliasName, current.indexName, currentVersion, lastSeq);
}

/** Creates a new versioned index with current mapping. */
async function createVersionedIndex(
  esClient: Client,
  logger: Logger,
  aliasName: string,
): Promise<string> {
  const indexName = getVersionedIndexName(aliasName, TODO_MAPPING_VERSION);
  const now = new Date().toISOString();

  logger.info({ aliasName, indexName, version: TODO_MAPPING_VERSION }, 'Creating versioned index');

  await esClient.indices.create({
    index: indexName,
    mappings: {
      ...JSON.parse(JSON.stringify(TODO_INDEX_MAPPING)),
      _meta: {
        created_at: now,
        last_seq: '0',
        mapping_version: String(TODO_MAPPING_VERSION),
        updated_at: now,
      },
    },
    settings: JSON.parse(JSON.stringify(TODO_INDEX_SETTINGS)),
  });

  return indexName;
}

/** Options for alias swap operation */
interface SwapAliasOptions {
  aliasName: string;
  newIndexName: string;
  oldIndexName?: string;
}

/** Swaps the alias to point to a new index. */
async function swapAlias(
  esClient: Client,
  logger: Logger,
  options: SwapAliasOptions,
): Promise<void> {
  const { aliasName, newIndexName, oldIndexName } = options;
  logger.info({ aliasName, newIndexName, oldIndexName }, 'Swapping alias');

  const actions: Array<
    { add: { index: string; alias: string } } | { remove: { index: string; alias: string } }
  > = [];

  if (oldIndexName && oldIndexName !== aliasName) {
    actions.push({ remove: { alias: aliasName, index: oldIndexName } });
  }

  actions.push({ add: { alias: aliasName, index: newIndexName } });

  await esClient.indices.updateAliases({ actions });
}

/** Deletes an old versioned index after migration. */
async function deleteOldIndex(esClient: Client, logger: Logger, indexName: string): Promise<void> {
  logger.info({ indexName }, 'Deleting old index after migration');

  try {
    await esClient.indices.delete({ index: indexName });
  } catch (error) {
    logger.error({ error, indexName }, 'Failed to delete old index');
  }
}

/** Migrates a legacy non-versioned index to versioned format. */
async function migrateLegacyIndex(
  esClient: Client,
  logger: Logger,
  aliasName: string,
): Promise<string | null> {
  const indexExists = await esClient.indices.exists({ index: aliasName });
  if (!indexExists) return null;

  const isAlias = await esClient.indices.existsAlias({ name: aliasName });
  if (isAlias) return null;

  logger.info({ aliasName }, 'Migrating legacy index to versioned format');

  const newIndexName = await createVersionedIndex(esClient, logger, aliasName);

  await esClient.reindex({
    dest: { index: newIndexName },
    source: { index: aliasName },
    wait_for_completion: true,
  });

  await esClient.indices.delete({ index: aliasName });
  await swapAlias(esClient, logger, { aliasName, newIndexName });

  return newIndexName;
}

/** Performs full migration for a database. */
async function performMigration(
  esClient: Client,
  logger: Logger,
  aliasName: string,
): Promise<string> {
  const current = await findCurrentVersionedIndex(esClient, aliasName);

  if (current && current.indexName === aliasName) {
    const migrated = await migrateLegacyIndex(esClient, logger, aliasName);
    if (migrated) {
      const newCheck = await checkMigration(esClient, aliasName);
      if (newCheck.needsMigration) {
        return performMigration(esClient, logger, aliasName);
      }
      return migrated;
    }
  }

  return createVersionedIndex(esClient, logger, aliasName);
}

/** Options for finalizing migration */
interface FinalizeMigrationOptions {
  aliasName: string;
  newIndexName: string;
  lastSeq: string;
}

/** Finalizes migration after initial sync completes. */
async function finalizeMigration(
  esClient: Client,
  logger: Logger,
  options: FinalizeMigrationOptions,
): Promise<void> {
  const { aliasName, newIndexName, lastSeq } = options;
  const current = await findCurrentVersionedIndex(esClient, aliasName);

  await updateLastSeq(esClient, logger, newIndexName, lastSeq);
  await swapAlias(esClient, logger, { aliasName, newIndexName, oldIndexName: current?.indexName });

  if (current && current.indexName !== newIndexName && current.indexName !== aliasName) {
    await deleteOldIndex(esClient, logger, current.indexName);
  }
}

/** Creates an index migration manager. */
export function createIndexMigration(config: MigrationConfig) {
  const { esClient, logger } = config;

  return {
    checkMigration: (aliasName: string) => checkMigration(esClient, aliasName),
    createVersionedIndex: (aliasName: string) => createVersionedIndex(esClient, logger, aliasName),
    deleteOldIndex: (indexName: string) => deleteOldIndex(esClient, logger, indexName),
    finalizeMigration: (aliasName: string, newIndexName: string, lastSeq: string) =>
      finalizeMigration(esClient, logger, { aliasName, lastSeq, newIndexName }),
    findCurrentVersionedIndex: (aliasName: string) =>
      findCurrentVersionedIndex(esClient, aliasName),
    getIndexMetadata: (indexName: string) => getIndexMetadata(esClient, indexName),
    migrateLegacyIndex: (aliasName: string) => migrateLegacyIndex(esClient, logger, aliasName),
    performMigration: (aliasName: string) => performMigration(esClient, logger, aliasName),
    swapAlias: (aliasName: string, newIndexName: string, oldIndexName?: string) =>
      swapAlias(esClient, logger, { aliasName, newIndexName, oldIndexName }),
    updateLastSeq: (indexName: string, lastSeq: string) =>
      updateLastSeq(esClient, logger, indexName, lastSeq),
  };
}

export type IndexMigration = ReturnType<typeof createIndexMigration>;
