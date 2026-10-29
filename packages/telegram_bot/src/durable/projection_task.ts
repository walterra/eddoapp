import { defineTask } from '@earendil-works/pi-durable';
import type { RuntimeRequestInput } from './state.js';

interface ProjectionInput {
  request: RuntimeRequestInput;
  answer: string;
}

interface ProjectionCheckpoint {
  phase: 'project';
}

export interface ProjectionDependencies {
  authorize: (input: RuntimeRequestInput) => Promise<unknown>;
  project: (input: RuntimeRequestInput, answer: string) => Promise<void>;
}

/** Retries application history independently of Telegram delivery and request completion. */
export function createProjectionTask(
  dependencies: ProjectionDependencies,
): ReturnType<typeof defineTask<ProjectionInput, ProjectionCheckpoint, string>> {
  return defineTask<ProjectionInput, ProjectionCheckpoint, string>({
    name: 'eddo.telegram-projection',
    version: 1,
    initial: () => ({ phase: 'project' }),
    phases: {
      project: async (task, runtime, context) => {
        await dependencies.authorize(task.input.request);
        try {
          await dependencies.project(task.input.request, task.input.answer);
        } catch (error) {
          if (runtime.signal.aborted) throw error;
          runtime.report(error);
          await runtime.sleep(Date.now() + 30_000, context);
          return;
        }
        await runtime.commit(
          () => ({
            status: 'terminal',
            outcome: { status: 'completed', result: task.input.answer },
          }),
          context,
        );
      },
    },
    abort: async (_task, runtime, context) => {
      await runtime.commit(() => ({ status: 'terminal', outcome: { status: 'aborted' } }), context);
    },
  });
}
