import { describe, expect, it } from 'vitest';
import { appError, err, fixedClock, ok, parseId } from '../../src/kernel';

describe('kernel minimal', () => {
  it('normalise un identifiant non vide', () => {
    const result = parseId<'TenantId'>('  tenant-1  ');

    expect(result).toEqual({ ok: true, value: 'tenant-1' });
  });

  it('refuse un identifiant vide avec une erreur stable', () => {
    const result = parseId<'TenantId'>('   ');

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'kernel.id.invalid',
        message: 'Un identifiant ne peut pas être vide.',
        retryable: false,
      },
    });
  });

  it('expose un résultat explicite sans exception métier', () => {
    const failure = appError('test.failure', 'Échec attendu');

    expect(ok(42)).toEqual({ ok: true, value: 42 });
    expect(err(failure)).toEqual({ ok: false, error: failure });
  });

  it('rend le temps déterministe dans les tests', () => {
    const clock = fixedClock('2026-08-11T10:00:00.000Z');

    expect(clock.now().toISOString()).toBe('2026-08-11T10:00:00.000Z');
    expect(clock.now()).not.toBe(clock.now());
  });
});
