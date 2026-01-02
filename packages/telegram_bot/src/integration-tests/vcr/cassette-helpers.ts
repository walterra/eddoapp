/**
 * Helper functions for cassette manager
 */
import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

import type { Cassette, LLMInteraction } from './cassette-manager.js';

/**
 * Normalize system prompt by removing dynamic content
 */
function normalizeSystemPrompt(systemPrompt: string): string {
  return systemPrompt
    .replace(/Current date and time:.*$/m, 'Current date and time: [NORMALIZED]')
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g, '[ISO_DATE]')
    .replace(/Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday/g, '[DAY]')
    .replace(/eddo_test_user_testuser_\d+/g, '[DATABASE]')
    .replace(/user_testuser_\d+/g, '[USER_ID]')
    .replace(/\btestuser_\d+\b/g, '[USERNAME]')
    .replace(/agent-test-\d+-[a-f0-9]+/g, '[API_KEY]')
    .replace(/http:\/\/localhost:\d+/g, 'http://localhost:[PORT]');
}

/**
 * Normalize message content
 */
function normalizeMessageContent(content: string): string {
  return content
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g, '[ISO_DATE]')
    .replace(/"timestamp":"[^"]+"/g, '"timestamp":"[NORMALIZED]"')
    .replace(/"execution_time":"[^"]+"/g, '"execution_time":"[NORMALIZED]"')
    .replace(/"id":"[^"]+"/g, '"id":"[NORMALIZED]"')
    .replace(/\\"timestamp\\":\\"[^"]+\\"/g, '\\"timestamp\\":\\"[NORMALIZED]\\"')
    .replace(/\\"execution_time\\":\\"[^"]+\\"/g, '\\"execution_time\\":\\"[NORMALIZED]\\"')
    .replace(/\\"id\\":\\"[^"]+\\"/g, '\\"id\\":\\"[NORMALIZED]\\"')
    .replace(/\\"_id\\":\\"[^"]+\\"/g, '\\"_id\\":\\"[NORMALIZED]\\"')
    .replace(/\\"_rev\\":\\"[^"]+\\"/g, '\\"_rev\\":\\"[NORMALIZED]\\"')
    .replace(/"_id":"[^"]+"/g, '"_id":"[NORMALIZED]"')
    .replace(/"_rev":"[^"]+"/g, '"_rev":"[NORMALIZED]"')
    .replace(/eddo_test_user_testuser_\d+/g, '[DATABASE]')
    .replace(/user_testuser_\d+/g, '[USER_ID]')
    .replace(/\btestuser_\d+\b/g, '[USERNAME]')
    .replace(/http:\/\/localhost:\d+/g, 'http://localhost:[PORT]');
}

/**
 * Creates a hash of the LLM request for matching
 */
export function hashRequest(
  model: string,
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>,
): string {
  const normalizedSystemPrompt = normalizeSystemPrompt(systemPrompt);
  const normalizedMessages = messages.map((msg) => ({
    role: msg.role,
    content: normalizeMessageContent(msg.content),
  }));

  const data = JSON.stringify({
    model,
    systemPrompt: normalizedSystemPrompt,
    messages: normalizedMessages,
  });
  const hash = createHash('sha256').update(data).digest('hex').substring(0, 16);

  if (process.env.VCR_DEBUG) {
    console.log(`📼 Hash: ${hash} (model: ${model})`);
  }

  return hash;
}

/**
 * Get cassette file path from test name
 */
export function getCassettePath(cassettesDir: string, testName: string): string {
  const safeName = testName.replace(/[^a-zA-Z0-9-_]/g, '_');
  return join(cassettesDir, `${safeName}.json`);
}

/**
 * Load cassette from file
 */
export function loadCassetteFromFile(cassettePath: string): Cassette {
  const content = readFileSync(cassettePath, 'utf-8');
  return JSON.parse(content) as Cassette;
}

/**
 * Create new empty cassette
 */
export function createNewCassette(testName: string): Cassette {
  const now = new Date().toISOString();
  return {
    version: 1,
    testName,
    createdAt: now,
    frozenTime: now,
    interactions: [],
  };
}

/**
 * Save cassette to file
 */
export function saveCassetteToFile(cassettePath: string, cassette: Cassette): void {
  const dir = dirname(cassettePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(cassettePath, JSON.stringify(cassette, null, 2));
  if (process.env.VCR_DEBUG) {
    console.log(`📼 Saved cassette: ${cassettePath}`);
  }
}

/**
 * Create normalized system prompt for storage
 */
export function normalizeSystemPromptForStorage(systemPrompt: string): string {
  return normalizeSystemPrompt(systemPrompt);
}

interface InteractionRecordInput {
  requestHash: string;
  model: string;
  systemPrompt: string;
  messages: Array<{ role: string; content: string }>;
  response: string;
  responseTimeMs: number;
}

function truncateMessageContent(content: string, maxLen = 200): string {
  return content.length > maxLen ? content.substring(0, maxLen) + '...' : content;
}

/**
 * Creates interaction record for storage
 * @param input - Interaction record input parameters
 * @returns LLM interaction record
 */
export function createInteractionRecord(input: InteractionRecordInput): LLMInteraction {
  const { requestHash, model, systemPrompt, messages, response, responseTimeMs } = input;

  return {
    requestHash,
    request: {
      model,
      systemPrompt: normalizeSystemPromptForStorage(systemPrompt),
      messages: messages.map((m) => ({ role: m.role, content: truncateMessageContent(m.content) })),
    },
    response,
    metadata: {
      recordedAt: new Date().toISOString(),
      responseTimeMs,
    },
  };
}

interface HashMismatchInfo {
  index: number;
  expected: LLMInteraction;
  actualHash: string;
  model: string;
  messages: Array<{ role: string; content: string }>;
}

/**
 * Logs hash mismatch details for debugging
 * @param info - Hash mismatch information
 */
export function logHashMismatch(info: HashMismatchInfo): void {
  const { index, expected, actualHash, model, messages } = info;

  console.warn(`📼 Request hash mismatch at index ${index}`);
  console.warn(`📼 Expected hash: ${expected.requestHash}, got: ${actualHash}`);
  console.warn(`📼 Recorded model: ${expected.request.model}, current model: ${model}`);

  if (process.env.VCR_DEBUG) {
    console.warn(`📼 Recorded messages:`, JSON.stringify(expected.request.messages, null, 2));
    console.warn(
      `📼 Current messages (first 500 chars):`,
      JSON.stringify(messages, null, 2).substring(0, 500),
    );
  }
}
