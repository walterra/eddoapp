/**
 * Server Info Tool - Get comprehensive server information and documentation
 */
import { z } from 'zod';

import type { GetUserDb, ToolContext } from './types.js';

/** Tool description for LLM consumption */
export const getServerInfoDescription =
  'Get comprehensive information about the Eddo MCP server with authentication, including data model, available tools, and usage examples';

/** Zod schema for getServerInfo parameters */
export const getServerInfoParameters = z.object({
  section: z
    .enum(['overview', 'datamodel', 'examples', 'tagstats', 'memories', 'all'])
    .default('all')
    .describe('Specific section of documentation to retrieve'),
});

export type GetServerInfoArgs = z.infer<typeof getServerInfoParameters>;

/**
 * Fetches tag statistics from the database
 */
async function fetchTagStats(db: ReturnType<GetUserDb>): Promise<string> {
  try {
    const result = await db.view('tags', 'by_tag', { group: true, reduce: true });

    const sortedTags = result.rows
      .sort((a, b) =>
        typeof a.value === 'number' && typeof b.value === 'number' ? b.value - a.value : 0,
      )
      .slice(0, 10);

    const tagList =
      sortedTags.length > 0
        ? sortedTags.map((row) => `- **${row.key}**: ${row.value} uses`).join('\n')
        : '- No tags found';

    return `# Top Used Tags

The most frequently used tags across all todos:

${tagList}

*Showing top 10 most used tags*`;
  } catch (error) {
    return `# Top Used Tags\n\nError retrieving tag statistics: ${error}`;
  }
}

/**
 * Fetches user memories from the database
 */
async function fetchMemories(db: ReturnType<GetUserDb>): Promise<string> {
  try {
    const memoryResult = await db.find({
      selector: { tags: { $elemMatch: { $eq: 'user:memory' } } },
      use_index: 'tags-index',
    });

    const memories = memoryResult.docs || [];
    const sortedMemories = memories.sort((a, b) => b._id.localeCompare(a._id));
    const memoryList =
      sortedMemories.length > 0
        ? sortedMemories.map((todo) => `- ${todo.title}: ${todo.description}`).join('\n')
        : '- No memories found';

    return `# User Memories

Current stored memories for context:

${memoryList}

*Memories are stored as todos with tag 'user:memory'*`;
  } catch (error) {
    return `# User Memories\n\nError retrieving memories: ${error}`;
  }
}

/**
 * Returns the overview section
 */
function getOverviewSection(context: ToolContext): string {
  const userId = context.session?.userId || 'anonymous';
  const dbName = context.session?.dbName || 'default';

  return `# Eddo MCP Server Overview

The Eddo MCP server provides a Model Context Protocol interface for the Eddo GTD-inspired todo and time tracking application with per-user authentication.

- **Database**: CouchDB with per-user databases
- **Data Model**: TodoAlpha3 schema
- **Features**: Todo CRUD, time tracking, repeating tasks, GTD contexts
- **Authentication**: Per-request authentication via X-User-ID, X-Database-Name, X-Telegram-ID, X-API-Key headers
- **Current User**: ${userId}
- **Database**: ${dbName}`;
}

/**
 * Returns the data model section
 */
function getDataModelSection(): string {
  return `# TodoAlpha3 Data Model

{
  _id: string;              // ISO timestamp of creation (auto-generated)
  _rev: string;             // CouchDB revision (auto-managed)
  active: Record<string, string | null>;  // Time tracking: key=start ISO, value=end ISO or null if running
  completed: string | null; // Completion ISO timestamp (null if not completed)
  context: string;          // GTD context (e.g., "work", "private", "errands")
  description: string;      // Detailed notes (supports markdown)
  due: string;              // Due date ISO string
  link: string | null;      // Optional URL/reference
  repeat: number | null;    // Repeat interval in days
  tags: string[];           // Categorization tags
  title: string;            // Todo title
  version: 'alpha3';        // Schema version
}`;
}

/**
 * Returns the examples section
 */
function getExamplesSection(): string {
  return `# Usage Examples

## Authentication
Pass user headers and API key to authenticate:
curl \
  -H "X-User-ID: your-username" \
  -H "X-Database-Name: your-db-name" \
  -H "X-Telegram-ID: your-telegram-id" \
  -H "X-API-Key: your-api-key-here" \
  http://localhost:3001/mcp

## Create a simple todo
{
  "tool": "createTodo",
  "arguments": {
    "title": "Buy groceries"
  }
}

## Create a work todo with full details
{
  "tool": "createTodo",
  "arguments": {
    "title": "Complete Q4 report",
    "description": "Include sales analysis and projections",
    "context": "work",
    "due": "2025-06-25T17:00:00.000Z",
    "tags": ["reports", "urgent"],
    "repeat": 90,
    "link": "https://docs.example.com/q4-template"
  }
}

## List incomplete work todos
{
  "tool": "listTodos",
  "arguments": {
    "context": "work",
    "completed": false
  }
}

## Start time tracking
{
  "tool": "startTimeTracking",
  "arguments": {
    "id": "2025-06-19T10:30:00.000Z"
  }
}`;
}

/**
 * Returns static documentation sections
 */
function getStaticSections(context: ToolContext): Record<string, string> {
  return {
    overview: getOverviewSection(context),
    datamodel: getDataModelSection(),
    examples: getExamplesSection(),
  };
}

/**
 * Execute handler for getServerInfo tool
 */
export async function executeGetServerInfo(
  args: GetServerInfoArgs,
  context: ToolContext,
  getUserDb: GetUserDb,
): Promise<string> {
  const db = getUserDb(context);

  context.log.debug('Retrieving server info for user', {
    userId: context.session?.userId,
    section: args.section,
  });

  const sections: Record<string, string> = getStaticSections(context);

  if (args.section === 'tagstats' || args.section === 'all') {
    sections.tagstats = await fetchTagStats(db);
  }

  if (args.section === 'memories' || args.section === 'all') {
    sections.memories = await fetchMemories(db);
  }

  if (args.section === 'all') {
    return Object.values(sections).join('\n\n---\n\n');
  }

  return (
    sections[args.section] ||
    'Invalid section. Choose from: overview, datamodel, tools, examples, tagstats, memories, all'
  );
}
