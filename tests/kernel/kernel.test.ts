import { describe, expect, it } from 'vitest';
import {
  addMoney,
  appError,
  compareMoney,
  createMoney,
  err,
  fixedClock,
  ok,
  parseId,
  quantity,
} from '../../src/kernel';

function valueOf<T>(result: { ok: true; value: T } | { ok: false }): T {
  if (!result.ok) throw new Error('Expected a successful result.');
  return result.value;
}

describe('kernel identifiers', () => {
  it('parses a non-empty opaque identifier', () => {
    expect(parseId<'TenantId'>(' tenant-1 ')).toEqual({
      ok: true,
      value: 'tenant-1',
    });
  });

  it('rejects an empty identifier with a stable error code', () => {
    expect(parseId<'UserId'>('   ')).toMatchObject({
      ok: false,
      error: { code: 'kernel.id.invalid', retryable: false },
    });
  });
});

describe('kernel results and errors', () => {
  it('creates explicit success and failure values', () => {
    expect(ok(42)).toEqual({ ok: true, value: 42 });
    expect(err(appError('test.failure', 'Failure', true))).toEqual({
      ok: false,
      error: { code: 'test.failure', message: 'Failure', retryable: true },
    });
  });
});

describe('kernel clock', () => {
  it('returns a defensive copy of a fixed instant', () => {
    const clock = fixedClock('2026-08-07T12:00:00.000Z');
    const first = clock.now();
    first.setUTCFullYear(2030);

    expect(clock.now().toISOString()).toBe('2026-08-07T12:00:00.000Z');
  });
});

describe('kernel money', () => {
  it('adds amounts expressed in the same currency', () => {
    const left = valueOf(createMoney(1250n, 'eur'));
    const right = valueOf(createMoney(250n, 'EUR'));

    expect(addMoney(left, right)).toEqual({
      ok: true,
      value: { minorUnits: 1500n, currency: 'EUR' },
    });
    expect(compareMoney(left, right)).toEqual({ ok: true, value: 1 });
  });

  it('refuses implicit operations across currencies', () => {
    const eur = valueOf(createMoney(100n, 'EUR'));
    const usd = valueOf(createMoney(100n, 'USD'));

    expect(addMoney(eur, usd)).toMatchObject({
      ok: false,
      error: { code: 'kernel.money.currency_mismatch', retryable: false },
    });
  });

  it('rejects an empty currency', () => {
    expect(createMoney(100n, ' ')).toMatchObject({
      ok: false,
      error: { code: 'kernel.money.invalid_currency' },
    });
  });
});

describe('kernel quantities', () => {
  it('keeps decimal values serialized as strings', () => {
    expect(quantity('12.500', 'sheet_per_hour')).toEqual({
      value: '12.500',
      unit: 'sheet_per_hour',
    });
  });
});
