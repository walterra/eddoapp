import type { ChildProcess } from 'child_process';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerRunnerCleanup, stopProcessTree } from './integration_process_cleanup.js';

const child = { pid: 12345 } as ChildProcess;
const missingProcess = Object.assign(new Error('No process'), { code: 'ESRCH' });

afterEach(() => vi.restoreAllMocks());

describe('integration process cleanup', () => {
  it('signals the entire group and accepts an already stopped group', async () => {
    const kill = vi.spyOn(process, 'kill').mockImplementation(() => {
      throw missingProcess;
    });
    await stopProcessTree(child);
    expect(kill).toHaveBeenCalledWith(-12345, 'SIGTERM');
  });

  it('waits for descendants rather than trusting the launcher killed flag', async () => {
    const kill = vi
      .spyOn(process, 'kill')
      .mockReturnValueOnce(true)
      .mockImplementation(() => {
        throw missingProcess;
      });
    await stopProcessTree(child);
    expect(kill.mock.calls).toEqual([
      [-12345, 'SIGTERM'],
      [-12345, 0],
    ]);
  });

  it('escalates when the process group survives the grace period', async () => {
    vi.spyOn(Date, 'now').mockReturnValueOnce(0).mockReturnValue(2001);
    const kill = vi.spyOn(process, 'kill').mockReturnValue(true);
    await stopProcessTree(child);
    expect(kill).toHaveBeenLastCalledWith(-12345, 'SIGKILL');
  });

  it('surfaces unexpected signaling errors', async () => {
    vi.spyOn(process, 'kill').mockImplementation(() => {
      throw new Error('Unexpected failure');
    });
    await expect(stopProcessTree(child)).rejects.toThrow('Unexpected failure');
  });

  it('cleans up once and removes signal handlers', async () => {
    const before = process.listenerCount('SIGINT');
    const cleanup = vi.fn().mockResolvedValue(undefined);
    const finish = registerRunnerCleanup(cleanup);
    expect(process.listenerCount('SIGINT')).toBe(before + 1);
    await Promise.all([finish(), finish()]);
    expect(cleanup).toHaveBeenCalledOnce();
    expect(process.listenerCount('SIGINT')).toBe(before);
  });
});
