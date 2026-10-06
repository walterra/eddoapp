import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { backgroundScenarios, type BackgroundScenario } from './background_write_plan';
import { checkCalibration } from './day_paging_calibration_check';
import { generateFixture, type DayPagingProfile } from './day_paging_fixture';

export type BenchmarkView = 'kanban' | 'table';
export type WarmupMode = 'bootstrap' | 'replication';

export interface BenchmarkOptions {
  profile: DayPagingProfile;
  steps: number;
  startDate: string;
  headed: boolean;
  directory: string;
  couchImage: string;
  warmupTimeout: number;
  views: BenchmarkView[];
  warmupMode: WarmupMode;
  background: BackgroundScenario;
}

/** Returns the value following a named CLI option. */
export function option(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

/** Selects calendar-month paging ending at the reference date by default. */
function getSequence(profile: DayPagingProfile): Pick<BenchmarkOptions, 'startDate' | 'steps'> {
  const months = Number(option('--months', '3'));
  if (!Number.isSafeInteger(months) || months < 1 || months > 12)
    throw new Error('Months must be 1–12');
  const end = new Date(`${profile.referenceDate}T12:00:00Z`);
  const start = new Date(end);
  start.setUTCMonth(start.getUTCMonth() - months);
  const startDate = option('--start-date', start.toISOString().slice(0, 10));
  const steps = Number(
    option('--steps', String(Math.round((end.getTime() - start.getTime()) / 86400000))),
  );
  if (!Number.isSafeInteger(steps) || steps < 1)
    throw new Error('Steps must be a positive integer');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || Number.isNaN(Date.parse(startDate)))
    throw new Error('Invalid start date');
  return { startDate, steps };
}

/** Rejects unsupported background scenarios before starting resources. */
function getBackgroundScenario(): BackgroundScenario {
  const background = option('--background', 'control');
  if (!backgroundScenarios.some((scenario) => scenario === background))
    throw new Error(`Background must be ${backgroundScenarios.join(', ')}`);
  return background as BackgroundScenario;
}

/** Validates options and fixture calibration before starting owned resources. */
export function getOptions(): BenchmarkOptions {
  const profilePath = option('--profile', 'benchmark-results/reference/walterra-profile.json');
  if (!existsSync(profilePath))
    throw new Error('Run pnpm benchmark:profile-reference walterra or provide --profile');
  const profile: DayPagingProfile = JSON.parse(readFileSync(profilePath, 'utf8'));
  const docs = generateFixture(profile);
  const calibration = checkCalibration(profile, docs);
  if (!existsSync('packages/web-api/public/index.html'))
    throw new Error('Run pnpm build:web-client first');
  const directory = resolve(option('--output', `benchmark-results/day-paging-${Date.now()}`));
  mkdirSync(directory, { recursive: true });
  if (calibration)
    writeFileSync(`${directory}/calibration.json`, JSON.stringify(calibration, null, 2));
  const warmupTimeout = Number(option('--warmup-timeout', '900'));
  if (!Number.isFinite(warmupTimeout) || warmupTimeout < 1)
    throw new Error('Invalid warmup timeout');
  const warmupMode = option('--warmup-mode', 'bootstrap');
  if (warmupMode !== 'bootstrap' && warmupMode !== 'replication')
    throw new Error('Warmup mode must be bootstrap or replication');
  const background = getBackgroundScenario();
  const views = option('--views', 'kanban,table').split(',');
  if (!views.length || views.some((view) => view !== 'kanban' && view !== 'table'))
    throw new Error('Views must be kanban and/or table');
  return {
    profile,
    ...getSequence(profile),
    headed: process.argv.includes('--headed'),
    directory,
    couchImage: option('--couch-image', 'couchdb:3.3.3'),
    warmupTimeout,
    views: [...new Set(views)] as BenchmarkView[],
    warmupMode,
    background: background as BackgroundScenario,
  };
}
