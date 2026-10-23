export interface ProgressOptions {
  progress?: (text: string) => Promise<unknown>;
  onReport?: (error: unknown) => void;
}

/** Sends sparse best-effort feedback without claiming tool success or blocking execution. */
export async function notifyProgress(options: ProgressOptions, callNumber: number): Promise<void> {
  if (!options.progress || (callNumber !== 1 && callNumber % 10 !== 0)) return;
  const text = callNumber === 1 ? 'Working on your request…' : 'Still working on your request…';
  try {
    await options.progress(text);
  } catch (error) {
    options.onReport?.(error);
  }
}
