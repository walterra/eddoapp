import { builtinModels } from '@earendil-works/pi-ai/providers/all';
import { dotenvLoad } from 'dotenv-mono';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { resolveConfiguredModel } from '../ai/llm-model-resolution.js';
import { loadRecordings } from './files.js';
import { renderReport, type ReviewResult } from './report.js';
import { REVIEW_PROMPT, RUBRIC_VERSION, reviewRecording } from './reviewer.js';
import { REVIEW_JSON_SCHEMA, type Recording } from './schema.js';

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));

async function runReviews(modelName: string, recordings: Recording[]): Promise<ReviewResult[]> {
  const models = builtinModels();
  const reference = resolveConfiguredModel(modelName, models);
  const model = models.getModel(reference.provider, reference.modelId);
  if (!model) throw new Error(`Unknown reviewer model: ${modelName}`);
  const results: ReviewResult[] = [];
  console.log(
    `status: reviewing ${recordings.length} recordings with ${modelName}; paid provider calls`,
  );
  for (const recording of recordings) {
    try {
      const review = await reviewRecording(models, model, recording);
      results.push({ status: 'completed', recording, review });
      console.log(`completed: ${recording.path}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({ status: 'error', recording, error: message });
      console.error(`error: ${recording.path}: ${message}`);
    }
  }
  return results;
}

/** Runs paid qualitative review without starting the application or replaying tools. */
async function main(): Promise<void> {
  dotenvLoad();
  const { values } = parseArgs({
    options: {
      model: { type: 'string' },
      staged: { type: 'boolean', default: false },
      out: { type: 'string' },
      help: { type: 'boolean' },
    },
  });
  if (values.help) {
    console.log(
      'usage: pnpm eval:recordings --model provider/model [--staged] [--out directory]\nCalls a paid reviewer model. Requires provider credentials; no Docker or MCP.',
    );
    return;
  }
  const modelName = values.model ?? process.env.EVAL_MODEL;
  if (!modelName) throw new Error('Set --model provider/model or EVAL_MODEL');
  const recordings = loadRecordings(ROOT, values.staged);
  if (!recordings.length) throw new Error('No recordings selected');
  const results = await runReviews(modelName, recordings);
  const createdAt = new Date().toISOString();
  const output = resolve(ROOT, values.out ?? 'eval-reports');
  mkdirSync(output, { recursive: true });
  const report = {
    schemaVersion: 1,
    status: results.some((item) => item.status === 'error') ? 'error' : 'completed',
    createdAt,
    reviewerModel: modelName,
    rubricVersion: RUBRIC_VERSION,
    rubricSha256: createHash('sha256').update(REVIEW_PROMPT).digest('hex'),
    results,
  };
  writeFileSync(resolve(output, 'review.json'), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(resolve(output, 'review.md'), renderReport(results));
  writeFileSync(
    resolve(output, 'judge-response.schema.json'),
    `${JSON.stringify(REVIEW_JSON_SCHEMA, null, 2)}\n`,
  );
  console.log(`report: ${output}`);
  if (report.status === 'error') process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
