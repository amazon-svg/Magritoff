import { describe, expect, it, vi } from 'vitest';
import { runWorkerLoop } from '../../../src/server/node/worker-loop.ts';

describe('runWorkerLoop', () => {
  it('execute immediatement un seul tour en mode once', async () => {
    const runOnce = vi.fn(async () => ({ claimed: 0 }));
    await runWorkerLoop(runOnce, {
      intervalMs: 60_000,
      signal: new AbortController().signal,
      once: true,
    });
    expect(runOnce).toHaveBeenCalledTimes(1);
  });

  it('attend la fin du tour et s arrete sur signal sans chevauchement', async () => {
    const abort = new AbortController();
    let active = 0;
    let maximumActive = 0;
    let turns = 0;
    const loop = runWorkerLoop(async () => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      turns += 1;
      await Promise.resolve();
      active -= 1;
      if (turns === 2) abort.abort();
      return turns;
    }, { intervalMs: 1, signal: abort.signal });

    await loop;
    expect(turns).toBe(2);
    expect(maximumActive).toBe(1);
  });

  it('journalise une erreur de tour puis poursuit', async () => {
    const abort = new AbortController();
    const onError = vi.fn();
    let turns = 0;
    const loop = runWorkerLoop(async () => {
      turns += 1;
      if (turns === 1) throw new Error('temporaire');
      abort.abort();
      return turns;
    }, { intervalMs: 1, signal: abort.signal, onError });

    await loop;
    expect(onError).toHaveBeenCalledOnce();
    expect(turns).toBe(2);
  });
});
