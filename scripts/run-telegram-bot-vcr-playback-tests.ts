#!/usr/bin/env tsx
/**
 * Run telegram-bot VCR playback once per recorded model.
 */
import { spawn } from 'child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

interface CassetteInteraction {
  request?: {
    model?: string;
  };
}

interface CassetteFile {
  interactions?: CassetteInteraction[];
}

const CASSETTES_DIR = join(
  process.cwd(),
  'packages',
  'telegram_bot',
  'src',
  'integration-tests',
  'cassettes',
);

/** Returns cassette JSON paths within a model directory. */
function getCassetteFiles(modelDirectory: string): string[] {
  return readdirSync(modelDirectory)
    .filter((entry) => entry.endsWith('.json'))
    .map((entry) => join(modelDirectory, entry));
}

/** Reads the recorded model id from a cassette file. */
function readRecordedModel(cassettePath: string): string | null {
  const cassette = JSON.parse(readFileSync(cassettePath, 'utf-8')) as CassetteFile;
  return (
    cassette.interactions?.find((interaction) => interaction.request?.model)?.request?.model ?? null
  );
}

/** Discovers model ids with VCR cassette directories. */
function discoverRecordedModels(): string[] {
  if (!existsSync(CASSETTES_DIR)) return [];

  const models = new Set<string>();
  for (const entry of readdirSync(CASSETTES_DIR)) {
    const modelDirectory = join(CASSETTES_DIR, entry);
    if (!statSync(modelDirectory).isDirectory()) continue;

    const model = getCassetteFiles(modelDirectory).map(readRecordedModel).find(Boolean);
    if (model) models.add(model);
  }

  return [...models].sort();
}

/** Runs one playback test process for a model. */
function runPlaybackForModel(model: string): Promise<number> {
  console.log(`📼 Running VCR playback for ${model}`);
  const child = spawn('tsx', ['scripts/run-telegram-bot-integration-tests.ts'], {
    env: { ...process.env, VCR_MODE: 'playback', LLM_MODEL: model },
    stdio: 'inherit',
  });

  return new Promise((resolve) => {
    child.on('exit', (code) => resolve(code ?? 1));
  });
}

/** Runs playback for all discovered recorded models. */
async function runPlaybackForAllModels(): Promise<void> {
  const models = discoverRecordedModels();
  if (models.length === 0) {
    throw new Error(`No model cassette directories found in ${CASSETTES_DIR}`);
  }

  console.log(`📼 Found ${models.length} VCR model cassette set(s): ${models.join(', ')}`);
  for (const model of models) {
    const exitCode = await runPlaybackForModel(model);
    if (exitCode !== 0) process.exit(exitCode);
  }
}

runPlaybackForAllModels().catch((error) => {
  console.error('❌ Telegram bot VCR playback failed:', error);
  process.exit(1);
});
