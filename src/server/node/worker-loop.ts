export type WorkerLoopOptions<Report> = Readonly<{
  intervalMs: number;
  signal: AbortSignal;
  once?: boolean;
  onReport?: (report: Report) => void;
  onError?: (error: unknown) => void;
}>;

/** Boucle séquentielle : un tour terminé avant le suivant, arrêt immédiat entre deux tours. */
export async function runWorkerLoop<Report>(
  runOnce: () => Promise<Report>,
  options: WorkerLoopOptions<Report>,
): Promise<void> {
  if (!Number.isInteger(options.intervalMs) || options.intervalMs < 1) {
    throw new Error('worker.interval_invalid');
  }

  while (!options.signal.aborted) {
    try {
      const report = await runOnce();
      options.onReport?.(report);
    } catch (error) {
      options.onError?.(error);
    }
    if (options.once || options.signal.aborted) return;
    await waitForNextTurn(options.intervalMs, options.signal);
  }
}

function waitForNextTurn(intervalMs: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(finish, intervalMs);
    signal.addEventListener('abort', finish, { once: true });

    function finish(): void {
      clearTimeout(timer);
      signal.removeEventListener('abort', finish);
      resolve();
    }
  });
}
