/**
 * Tests vitest pour `useClaudeSseStream` (R2 Phase A).
 *
 * On teste les helpers purs exportes (`truncateMessages` + `detectBillingError`)
 * + le contrat ClaudeSseStreamError. Le hook React lui-meme n'est pas teste
 * (vitest tourne en environment node, pas de @testing-library/react).
 */

import { describe, it, expect } from 'vitest';
import {
  ClaudeSseStreamError,
  MAX_CONTEXT_MESSAGES,
  detectBillingError,
  truncateMessages,
} from '../../src/app/hooks/useClaudeSseStream';

describe('truncateMessages - troncage 25 messages (E5 fix)', () => {
  it('1. Liste vide → vide, 0 dropped', () => {
    const { truncated, droppedCount } = truncateMessages<number>([]);
    expect(truncated).toEqual([]);
    expect(droppedCount).toBe(0);
  });

  it('2. <=25 messages → inchange, 0 dropped', () => {
    const msgs = Array.from({ length: 10 }, (_, i) => i);
    const { truncated, droppedCount } = truncateMessages(msgs);
    expect(truncated).toEqual(msgs);
    expect(droppedCount).toBe(0);
  });

  it('3. Exactement 25 messages → tous conserves, 0 dropped', () => {
    const msgs = Array.from({ length: 25 }, (_, i) => i);
    const { truncated, droppedCount } = truncateMessages(msgs);
    expect(truncated.length).toBe(25);
    expect(droppedCount).toBe(0);
  });

  it('4. 30 messages → garde les 25 plus recents (drop 5 anciens)', () => {
    const msgs = Array.from({ length: 30 }, (_, i) => i);
    const { truncated, droppedCount } = truncateMessages(msgs);
    expect(truncated.length).toBe(25);
    expect(droppedCount).toBe(5);
    expect(truncated[0]).toBe(5);
    expect(truncated[24]).toBe(29);
  });

  it('5. Param max custom → respecte', () => {
    const msgs = Array.from({ length: 10 }, (_, i) => i);
    const { truncated, droppedCount } = truncateMessages(msgs, 5);
    expect(truncated.length).toBe(5);
    expect(droppedCount).toBe(5);
    expect(truncated).toEqual([5, 6, 7, 8, 9]);
  });

  it('6. MAX_CONTEXT_MESSAGES est exporte = 25 (NFR43)', () => {
    expect(MAX_CONTEXT_MESSAGES).toBe(25);
  });
});

describe('detectBillingError - heuristique billing (E4 fix)', () => {
  function makeResponse(status: number, body = ''): Response {
    return new Response(body, { status });
  }

  it('7. Status 402 → true (Payment Required)', async () => {
    expect(await detectBillingError(makeResponse(402))).toBe(true);
  });

  it('8. Status 401 avec body "billing" → true', async () => {
    expect(
      await detectBillingError(makeResponse(401, 'Anthropic billing suspended')),
    ).toBe(true);
  });

  it('9. Status 403 avec "insufficient_quota" → true', async () => {
    expect(
      await detectBillingError(makeResponse(403, '{"error":"insufficient_quota"}')),
    ).toBe(true);
  });

  it('10. Status 500 (serveur) → false (pas billing)', async () => {
    expect(await detectBillingError(makeResponse(500, 'Internal'))).toBe(false);
  });

  it('11. Status 200 → false (pas une erreur)', async () => {
    expect(await detectBillingError(makeResponse(200))).toBe(false);
  });

  it('12. Status 400 sans mot-cle billing → false', async () => {
    expect(await detectBillingError(makeResponse(400, 'Bad request'))).toBe(false);
  });
});

describe('ClaudeSseStreamError - typage discrimine', () => {
  it('13. Instance d Error + kind preserve', () => {
    const err = new ClaudeSseStreamError('billing', 'test', 402);
    expect(err).toBeInstanceOf(Error);
    expect(err.kind).toBe('billing');
    expect(err.status).toBe(402);
  });

  it('14. 4 kinds supportes (billing/network/aborted/protocol)', () => {
    const kinds = ['billing', 'network', 'aborted', 'protocol'] as const;
    for (const k of kinds) {
      const e = new ClaudeSseStreamError(k, '');
      expect(e.kind).toBe(k);
    }
  });
});
