import { appendFileSync, writeFileSync } from 'node:fs';
import {
  finishBackgroundWrites,
  startBackgroundWrites,
  stopBackgroundWrites,
} from './background_write_run';
import { installObservers, pageDay, waitForDay, type PagingSample } from './day_paging_browser';
import { generateFixture, offsetDate } from './day_paging_fixture';
import { waitForQueryIdle } from './day_paging_idle';
import type { BenchmarkOptions } from './day_paging_options';

/** Persists each measurement before the next interaction can fail. */
function saveSample(sample: PagingSample, directory: string): void {
  appendFileSync(`${directory}/samples.jsonl`, `${JSON.stringify(sample)}\n`);
  console.log(
    `paging: ${sample.view} ${sample.direction} ${sample.date} | ${sample.todoCount} todos | ${sample.durationMs.toFixed(1)}ms`,
  );
}

/** Clicks navigation while independent server writes run, retaining verification on failure. */
export async function collectSamples(
  session: string,
  options: BenchmarkOptions,
  couchUrl: string,
): Promise<PagingSample[]> {
  const { profile, steps, startDate } = options;
  const docs = generateFixture(profile);
  const idsFor = (day: number): string[] =>
    docs.filter((doc) => doc.due === offsetDate(startDate, day)).map((doc) => doc._id);
  waitForDay(session, idsFor(0), startDate);
  await waitForQueryIdle(session, options.directory);
  installObservers(session);
  const writer = await startBackgroundWrites(couchUrl, options);
  try {
    const samples: PagingSample[] = [];
    for (let day = 1; day <= steps; day++) {
      const sample = pageDay(session, 'Next', offsetDate(startDate, day), idsFor(day));
      saveSample(sample, options.directory);
      samples.push(sample);
    }
    for (let day = steps - 1; day >= 0; day--) {
      const sample = pageDay(session, 'Previous', offsetDate(startDate, day), idsFor(day));
      saveSample(sample, options.directory);
      samples.push(sample);
    }
    await finishBackgroundWrites(writer, session);
    return samples;
  } catch (error) {
    await finishBackgroundWrites(writer, session, false).catch((verificationError) => {
      writeFileSync(
        `${options.directory}/background-verification-error.txt`,
        String(verificationError),
      );
    });
    throw error;
  } finally {
    await stopBackgroundWrites(writer);
  }
}
