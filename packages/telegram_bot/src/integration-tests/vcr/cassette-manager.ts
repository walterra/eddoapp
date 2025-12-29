/**
 * VCR-style Cassette Manager for LLM Response Caching
 *
 * Records LLM API responses to cassette files on first run,
 * replays them on subsequent runs for deterministic, fast, free tests.
 */
import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

/** Recorded LLM interaction */
export interface LLMInteraction {
  /** Hash of request for matching */
  requestHash: string;
  /** Original request data (for debugging) */
  request: {
    model: string;
    systemPrompt: string;
    messages: Array<{ role: string; content: string }>;
  };
  /** Recorded response */
  response: string;
  /** Recording metadata */
  metadata: {
    recordedAt: string;
    responseTimeMs?: number;
  };
}

/** Cassette file structure */
export interface Cassette {
  /** Cassette format version */
  version: 1;
  /** Test name for identification */
  testName: string;
  /** When the cassette was created */
  createdAt: string;
  /** Frozen time for replay (ISO timestamp) - ensures consistent "current date" */
  frozenTime: string;
  /** Recorded interactions in order */
  interactions: LLMInteraction[];
}

/** Recording mode */
export type RecordMode = 'record' | 'playback' | 'auto';

/** Cassette manager configuration */
export interface CassetteManagerConfig {
  /** Directory to store cassette files */
  cassettesDir: string;
  /** Recording mode: 'record' (always record), 'playback' (always replay), 'auto' (record if missing) */
  mode: RecordMode;
}

/**
 * Creates a hash of the LLM request for matching
 * Excludes timestamps and other non-deterministic fields
 */
function hashRequest(
  model: string,
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>,
): string {
  // Normalize system prompt by removing dynamic content
  const normalizedSystemPrompt = systemPrompt
    // Normalize date/time references
    .replace(/Current date and time:.*$/m, 'Current date and time: [NORMALIZED]')
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g, '[ISO_DATE]')
    .replace(/Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday/g, '[DAY]')
    // Normalize user-specific content (test user IDs and database names)
    .replace(/user_testuser_\d+/g, '[USER_ID]')
    .replace(/testuser_\d+/g, '[USERNAME]')
    .replace(/eddo_test_user_testuser_\d+/g, '[DATABASE]')
    // Normalize any remaining dynamic IDs
    .replace(/agent-test-\d+-[a-f0-9]+/g, '[API_KEY]');

  // Normalize messages by removing tool result timestamps and IDs
  // Handle both regular JSON and escaped JSON (e.g., in stringified tool results)
  const normalizedMessages = messages.map((msg) => ({
    role: msg.role,
    content: msg.content
      // Normalize ISO dates (both escaped and unescaped)
      .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g, '[ISO_DATE]')
      // Normalize JSON fields (unescaped)
      .replace(/"timestamp":"[^"]+"/g, '"timestamp":"[NORMALIZED]"')
      .replace(/"execution_time":"[^"]+"/g, '"execution_time":"[NORMALIZED]"')
      .replace(/"id":"[^"]+"/g, '"id":"[NORMALIZED]"')
      // Normalize JSON fields (escaped - from stringified JSON in tool results)
      .replace(/\\"timestamp\\":\\"[^"]+\\"/g, '\\"timestamp\\":\\"[NORMALIZED]\\"')
      .replace(/\\"execution_time\\":\\"[^"]+\\"/g, '\\"execution_time\\":\\"[NORMALIZED]\\"')
      .replace(/\\"id\\":\\"[^"]+\\"/g, '\\"id\\":\\"[NORMALIZED]\\"')
      .replace(/\\"_id\\":\\"[^"]+\\"/g, '\\"_id\\":\\"[NORMALIZED]\\"')
      .replace(/\\"_rev\\":\\"[^"]+\\"/g, '\\"_rev\\":\\"[NORMALIZED]\\"')
      // Normalize unescaped CouchDB fields
      .replace(/"_id":"[^"]+"/g, '"_id":"[NORMALIZED]"')
      .replace(/"_rev":"[^"]+"/g, '"_rev":"[NORMALIZED]"')
      // Normalize user/database references
      .replace(/user_testuser_\d+/g, '[USER_ID]')
      .replace(/testuser_\d+/g, '[USERNAME]')
      .replace(/eddo_test_user_testuser_\d+/g, '[DATABASE]'),
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

/** Callback to freeze/unfreeze time */
export interface TimeController {
  freeze: (isoTime: string) => void;
  unfreeze: () => void;
}

/**
 * Factory function to create a cassette manager
 */
export function createCassetteManager(
  config: CassetteManagerConfig,
  timeController?: TimeController,
) {
  const { cassettesDir, mode } = config;
  let currentCassette: Cassette | null = null;
  let currentCassettePath: string | null = null;
  let interactionIndex = 0;
  let modified = false;
  let timeFrozen = false;

  // Ensure cassettes directory exists
  if (!existsSync(cassettesDir)) {
    mkdirSync(cassettesDir, { recursive: true });
  }

  /**
   * Load or create a cassette for a test
   */
  function loadCassette(testName: string): void {
    // Save previous cassette if modified and unfreeze time
    if (currentCassette && modified && currentCassettePath) {
      saveCassette();
    }
    if (timeFrozen && timeController) {
      timeController.unfreeze();
      timeFrozen = false;
    }

    const safeName = testName.replace(/[^a-zA-Z0-9-_]/g, '_');
    currentCassettePath = join(cassettesDir, `${safeName}.json`);
    interactionIndex = 0;
    modified = false;

    if (existsSync(currentCassettePath) && mode !== 'record') {
      // Load existing cassette
      const content = readFileSync(currentCassettePath, 'utf-8');
      currentCassette = JSON.parse(content) as Cassette;
      console.log(
        `📼 Loaded cassette: ${safeName} (${currentCassette.interactions.length} interactions)`,
      );

      // Freeze time to match recording for deterministic replay
      if (timeController && currentCassette.frozenTime) {
        console.log(`📼 Freezing time to: ${currentCassette.frozenTime}`);
        timeController.freeze(currentCassette.frozenTime);
        timeFrozen = true;
      }
    } else {
      // Create new cassette with current time as frozen time
      const now = new Date().toISOString();
      currentCassette = {
        version: 1,
        testName,
        createdAt: now,
        frozenTime: now,
        interactions: [],
      };
      if (mode === 'playback') {
        throw new Error(`Cassette not found for playback: ${currentCassettePath}`);
      }
      console.log(`📼 Created new cassette: ${safeName}`);
    }
  }

  /**
   * Save current cassette to disk
   */
  function saveCassette(): void {
    if (!currentCassette || !currentCassettePath) return;

    const dir = dirname(currentCassettePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(currentCassettePath, JSON.stringify(currentCassette, null, 2));
    console.log(`📼 Saved cassette: ${currentCassettePath}`);
    modified = false;
  }

  /**
   * Record or replay an LLM interaction
   * Returns cached response if available, otherwise calls the real API
   */
  async function handleInteraction(
    model: string,
    systemPrompt: string,
    messages: Array<{ role: string; content: string }>,
    realCall: () => Promise<string>,
  ): Promise<string> {
    if (!currentCassette) {
      throw new Error('No cassette loaded. Call loadCassette() first.');
    }

    const requestHash = hashRequest(model, systemPrompt, messages);

    // Try to find matching interaction in cassette
    if (mode !== 'record' && interactionIndex < currentCassette.interactions.length) {
      const interaction = currentCassette.interactions[interactionIndex];

      if (interaction.requestHash === requestHash) {
        interactionIndex++;
        console.log(
          `📼 Replaying interaction ${interactionIndex}/${currentCassette.interactions.length}`,
        );
        return interaction.response;
      } else {
        console.warn(`📼 Request hash mismatch at index ${interactionIndex}`);
        console.warn(`📼 Expected hash: ${interaction.requestHash}, got: ${requestHash}`);
        console.warn(`📼 Recorded model: ${interaction.request.model}, current model: ${model}`);
        if (process.env.VCR_DEBUG) {
          console.warn(
            `📼 Recorded messages:`,
            JSON.stringify(interaction.request.messages, null, 2),
          );
          console.warn(
            `📼 Current messages (first 500 chars):`,
            JSON.stringify(messages, null, 2).substring(0, 500),
          );
        }
        // Hash mismatch - need to re-record from this point
        currentCassette.interactions = currentCassette.interactions.slice(0, interactionIndex);
      }
    }

    // Record new interaction
    if (mode === 'playback') {
      throw new Error(
        `No matching interaction in cassette at index ${interactionIndex}. ` +
          `Run with VCR_MODE=auto or VCR_MODE=record to record new interactions.`,
      );
    }

    console.log(`📼 Recording new interaction ${interactionIndex + 1}`);
    const startTime = Date.now();
    const response = await realCall();
    const responseTimeMs = Date.now() - startTime;

    currentCassette.interactions.push({
      requestHash,
      request: {
        model,
        systemPrompt: systemPrompt.substring(0, 500) + '...', // Truncate for readability
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content.substring(0, 200) + (m.content.length > 200 ? '...' : ''),
        })),
      },
      response,
      metadata: {
        recordedAt: new Date().toISOString(),
        responseTimeMs,
      },
    });

    interactionIndex++;
    modified = true;

    return response;
  }

  /**
   * Finish using current cassette (saves if modified, unfreezes time)
   */
  function ejectCassette(): void {
    if (currentCassette && modified && currentCassettePath) {
      saveCassette();
    }
    if (timeFrozen && timeController) {
      timeController.unfreeze();
      timeFrozen = false;
    }
    currentCassette = null;
    currentCassettePath = null;
    interactionIndex = 0;
    modified = false;
  }

  /**
   * Get current recording mode
   */
  function getMode(): RecordMode {
    return mode;
  }

  /**
   * Check if currently replaying (vs recording)
   */
  function isReplaying(): boolean {
    if (!currentCassette) return false;
    return mode !== 'record' && currentCassette.interactions.length > 0;
  }

  return {
    loadCassette,
    handleInteraction,
    ejectCassette,
    saveCassette,
    getMode,
    isReplaying,
  };
}

export type CassetteManager = ReturnType<typeof createCassetteManager>;
