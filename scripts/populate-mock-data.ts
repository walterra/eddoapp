#!/usr/bin/env tsx

/**
 * Mock data population script for CouchDB
 * Creates GTD todos for a typical week of a Starfleet officer
 */

import { getCouchDbConfig, validateEnv } from '@eddo/core-server/config';
import type { TodoAlpha3 } from '@eddo/core-server/types/todo';
import fetch from 'node-fetch';

import {
  generateTagsForTodo,
  generateTodoTemplates,
  GITHUB_ISSUES,
} from './populate-mock-data-templates.js';

const env = validateEnv(process.env);
const couchConfig = getCouchDbConfig(env);

interface BulkDocsRequest {
  docs: TodoAlpha3[];
}

interface BulkDocsResponse {
  id: string;
  rev?: string;
  error?: string;
  reason?: string;
}

/**
 * Generate mock todo data for a Starfleet officer's typical week
 */
function generateStarfleetTodos(): TodoAlpha3[] {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());

  const todoData = generateTodoTemplates(weekStart);

  return todoData.map((todo) => {
    const createdTime = new Date(now.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000);

    return {
      _id: createdTime.toISOString(),
      version: 'alpha3' as const,
      title: todo.title,
      description: `Starfleet duty: ${todo.title}`,
      context: todo.context,
      due: todo.due,
      tags: generateTagsForTodo(todo),
      active: {},
      completed: Math.random() > 0.8 ? new Date().toISOString() : null,
      repeat: todo.title.includes('Weekly') ? 7 : null,
      externalId: GITHUB_ISSUES[todo.title] || null,
      link: null,
    };
  });
}

function getAuthHeaders(): Record<string, string> {
  const url = new URL(couchConfig.url);
  if (url.username && url.password) {
    const auth = Buffer.from(`${url.username}:${url.password}`).toString('base64');
    return { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' };
  }
  return { 'Content-Type': 'application/json' };
}

function getCleanUrl(): string {
  const url = new URL(couchConfig.url);
  url.username = '';
  url.password = '';
  return `${url.origin}/${couchConfig.dbName}`;
}

async function ensureDatabase(): Promise<void> {
  const cleanUrl = getCleanUrl();
  const headers = getAuthHeaders();

  const response = await fetch(cleanUrl, { headers });
  if (response.status === 404) {
    console.log(`Creating database: ${couchConfig.dbName}`);
    const createResponse = await fetch(cleanUrl, { method: 'PUT', headers });
    if (!createResponse.ok) {
      throw new Error(`Failed to create database: ${createResponse.statusText}`);
    }
  } else if (!response.ok) {
    throw new Error(`Database check failed: ${response.statusText}`);
  }
}

function displayContextDistribution(todos: TodoAlpha3[]): void {
  const contextCounts: Record<string, number> = {};
  todos.forEach((todo) => {
    contextCounts[todo.context] = (contextCounts[todo.context] || 0) + 1;
  });

  console.log('Todo distribution by context:');
  Object.entries(contextCounts).forEach(([context, count]) => {
    console.log(`  ${context}: ${count}`);
  });
}

function displayDryRunSample(todos: TodoAlpha3[]): void {
  console.log('\n📝 Sample todos that would be created:');
  todos.slice(0, 5).forEach((todo, i) => {
    console.log(`${i + 1}. [${todo.context}] ${todo.title}`);
    console.log(`   Due: ${new Date(todo.due).toLocaleString()}`);
    console.log(`   Tags: ${todo.tags.join(', ')}`);
    console.log('');
  });
  console.log(`... and ${todos.length - 5} more todos`);
  console.log('\n🖖 Run without --dry-run to actually insert data');
}

async function insertTodos(todos: TodoAlpha3[]): Promise<void> {
  const bulkDoc: BulkDocsRequest = { docs: todos };
  const cleanUrl = getCleanUrl();
  const headers = getAuthHeaders();

  const response = await fetch(`${cleanUrl}/_bulk_docs`, {
    method: 'POST',
    headers,
    body: JSON.stringify(bulkDoc),
  });

  if (!response.ok) {
    throw new Error(`Bulk insert failed: ${response.statusText}`);
  }

  const result = (await response.json()) as BulkDocsResponse[];
  const errors = result.filter((doc) => doc.error);

  if (errors.length > 0) {
    console.warn(`${errors.length} documents failed to insert:`);
    errors.forEach((error) => console.warn(`  ${error.id}: ${error.error}`));
  }

  const successful = result.length - errors.length;
  console.log(`✅ Successfully inserted ${successful} todos`);
  console.log(`📅 Date range: ${new Date().toLocaleDateString()} week`);
  console.log(`🖖 Ready for a productive week in Starfleet!`);
}

async function populateMockData(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');

  try {
    console.log(`Connecting to CouchDB at ${couchConfig.url}`);
    console.log(`Target database: ${couchConfig.dbName}`);

    if (dryRun) {
      console.log('🧪 DRY RUN MODE - No data will be inserted');
    } else {
      await ensureDatabase();
    }

    const todos = generateStarfleetTodos();
    console.log(`Generated ${todos.length} Starfleet officer todos`);
    displayContextDistribution(todos);

    if (dryRun) {
      displayDryRunSample(todos);
    } else {
      await insertTodos(todos);
    }
  } catch (error) {
    console.error(
      'Mock data population failed:',
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  populateMockData().catch(console.error);
}

export { populateMockData };
