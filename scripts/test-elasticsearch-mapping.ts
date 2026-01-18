#!/usr/bin/env npx tsx

/**
 * Test script to verify Elasticsearch index mapping works correctly.
 * Run: npx tsx scripts/test-elasticsearch-mapping.ts
 */

import { Client } from '@elastic/elasticsearch';

const ES_URL = process.env.ELASTICSEARCH_URL || 'http://localhost:9222';
const INDEX_NAME = 'eddo_todos';

const INDEX_SETTINGS = {
  number_of_shards: 1,
  number_of_replicas: 0,
  analysis: {
    analyzer: {
      todo_content: {
        type: 'custom' as const,
        tokenizer: 'standard',
        filter: ['lowercase', 'asciifolding', 'todo_stemmer'],
      },
    },
    filter: {
      todo_stemmer: {
        type: 'stemmer' as const,
        language: 'english',
      },
    },
  },
};

const INDEX_MAPPING = {
  dynamic: 'strict' as const,
  properties: {
    _id: { type: 'keyword' as const },
    _rev: { type: 'keyword' as const, index: false },
    title: {
      type: 'text' as const,
      analyzer: 'todo_content',
      fields: { keyword: { type: 'keyword' as const, ignore_above: 256 } },
    },
    description: {
      type: 'text' as const,
      analyzer: 'todo_content',
      fields: { keyword: { type: 'keyword' as const, ignore_above: 1024 } },
    },
    context: { type: 'keyword' as const },
    tags: { type: 'keyword' as const },
    due: { type: 'date' as const },
    completed: { type: 'date' as const },
    repeat: { type: 'integer' as const },
    active: { type: 'flattened' as const },
    externalId: { type: 'keyword' as const },
    link: { type: 'keyword' as const },
    parentId: { type: 'keyword' as const },
    blockedBy: { type: 'keyword' as const },
    auditLog: { type: 'keyword' as const, index: false },
    version: { type: 'keyword' as const },
    notes: {
      type: 'nested' as const,
      properties: {
        id: { type: 'keyword' as const },
        content: { type: 'text' as const, analyzer: 'todo_content' },
        createdAt: { type: 'date' as const },
        updatedAt: { type: 'date' as const },
        attachments: { type: 'keyword' as const, index: false },
      },
    },
    metadata: { type: 'flattened' as const },
    userId: { type: 'keyword' as const },
    database: { type: 'keyword' as const },
    syncedAt: { type: 'date' as const },
  },
};

/** Tests connection to Elasticsearch. */
async function testConnection(client: Client): Promise<void> {
  console.log('1. Testing connection...');
  try {
    const info = await client.info();
    console.log(`   ✅ Connected to ${info.cluster_name} (ES ${info.version.number})\n`);
  } catch (error) {
    console.error('   ❌ Connection failed:', error);
    process.exit(1);
  }
}

/** Deletes existing index if present. */
async function cleanupExistingIndex(client: Client): Promise<void> {
  console.log('2. Cleaning up existing index...');
  try {
    const exists = await client.indices.exists({ index: INDEX_NAME });
    if (exists) {
      await client.indices.delete({ index: INDEX_NAME });
      console.log(`   ✅ Deleted existing index\n`);
    } else {
      console.log(`   ✅ Index does not exist (clean slate)\n`);
    }
  } catch (error) {
    console.error('   ❌ Cleanup failed:', error);
  }
}

/** Creates index with mapping. */
async function createIndex(client: Client): Promise<void> {
  console.log('3. Creating index with mapping...');
  try {
    await client.indices.create({
      index: INDEX_NAME,
      settings: INDEX_SETTINGS,
      mappings: INDEX_MAPPING,
    });
    console.log(`   ✅ Index created successfully\n`);
  } catch (error) {
    console.error('   ❌ Index creation failed:', error);
    process.exit(1);
  }
}

/** Checks index health and document count. */
async function checkIndexHealth(client: Client): Promise<void> {
  console.log('4. Checking index health...');
  try {
    const health = await client.cluster.health({ index: INDEX_NAME });
    const count = await client.count({ index: INDEX_NAME });
    console.log(`   ✅ Status: ${health.status}`);
    console.log(`   ✅ Documents: ${count.count}\n`);
  } catch (error) {
    console.error('   ❌ Health check failed:', error);
  }
}

/** Creates a test document for mapping verification. */
function createTestDocument(): Record<string, unknown> {
  return {
    _id: '2025-01-01T00:00:00.000Z',
    _rev: '1-test',
    title: 'Test todo for mapping verification',
    description: 'This is a test document to verify the index mapping works correctly.',
    context: 'test',
    tags: ['test', 'mapping-verification'],
    due: '2025-01-31T23:59:59.999Z',
    completed: null,
    repeat: null,
    active: {},
    externalId: null,
    link: null,
    parentId: null,
    blockedBy: [],
    version: 'alpha3',
    notes: [
      {
        id: 'note-1',
        content: 'Test note content',
        createdAt: '2025-01-01T00:00:00.000Z',
      },
    ],
    metadata: {
      'agent:test': 'true',
    },
    userId: 'test-user',
    database: 'test-db',
    syncedAt: new Date().toISOString(),
  };
}

/** Indexes a test document. */
async function indexTestDocument(client: Client): Promise<void> {
  console.log('5. Testing document indexing...');
  try {
    const testDoc = createTestDocument();

    await client.index({
      index: INDEX_NAME,
      id: testDoc._id as string,
      document: testDoc,
    });

    await client.indices.refresh({ index: INDEX_NAME });
    console.log(`   ✅ Document indexed successfully\n`);
  } catch (error) {
    console.error('   ❌ Document indexing failed:', error);
    process.exit(1);
  }
}

/** Tests ES|QL query functionality. */
async function testEsqlQuery(client: Client): Promise<void> {
  console.log('6. Testing ES|QL query...');
  try {
    const result = await client.esql.query({
      query: `FROM ${INDEX_NAME} | LIMIT 1`,
    });
    console.log(`   ✅ ES|QL query successful (${result.values?.length || 0} rows)\n`);
  } catch (error) {
    console.error('   ❌ ES|QL query failed:', error);
    process.exit(1);
  }
}

/** Tests full-text search with MATCH. */
async function testFullTextSearch(client: Client): Promise<void> {
  console.log('7. Testing full-text search with MATCH...');
  try {
    const searchResult = await client.esql.query({
      query: `FROM ${INDEX_NAME} | WHERE title : "mapping verification" | KEEP title, context`,
    });
    console.log(`   ✅ MATCH search found ${searchResult.values?.length || 0} document(s)\n`);
  } catch (error) {
    console.error('   ❌ MATCH search failed:', error);
    process.exit(1);
  }
}

/** Tests exact match on keyword field. */
async function testExactMatch(client: Client): Promise<void> {
  console.log('8. Testing exact match on keyword field...');
  try {
    const exactResult = await client.esql.query({
      query: `FROM ${INDEX_NAME} | WHERE context == "test" | KEEP title, context`,
    });
    console.log(`   ✅ Exact match found ${exactResult.values?.length || 0} document(s)\n`);
  } catch (error) {
    console.error('   ❌ Exact match failed:', error);
    process.exit(1);
  }
}

/** Deletes the test document. */
async function cleanupTestDocument(client: Client): Promise<void> {
  console.log('9. Cleaning up test document...');
  try {
    await client.delete({
      index: INDEX_NAME,
      id: '2025-01-01T00:00:00.000Z',
    });
    console.log(`   ✅ Test document deleted\n`);
  } catch (error) {
    console.error('   ❌ Cleanup failed:', error);
  }
}

/** Main entry point for Elasticsearch mapping tests. */
async function main(): Promise<void> {
  console.log(`\n🔍 Testing Elasticsearch mapping at ${ES_URL}\n`);

  const client = new Client({ node: ES_URL });

  await testConnection(client);
  await cleanupExistingIndex(client);
  await createIndex(client);
  await checkIndexHealth(client);
  await indexTestDocument(client);
  await testEsqlQuery(client);
  await testFullTextSearch(client);
  await testExactMatch(client);
  await cleanupTestDocument(client);

  console.log('✅ All tests passed! Elasticsearch mapping is working correctly.\n');
}

main().catch(console.error);
