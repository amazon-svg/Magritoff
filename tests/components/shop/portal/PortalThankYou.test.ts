/**
 * Tests vitest pour PortalThankYou helpers (Story S-CONSO-3, Sprint 4 Phase 2).
 */

import { describe, it, expect } from 'vitest';
import { formatShortOrderId } from '../../../../src/app/components/shop/portal/PortalThankYou';

describe('formatShortOrderId', () => {
  it('UUID standard -> 8 premiers chars uppercase', () => {
    expect(formatShortOrderId('a1b2c3d4-e5f6-7890-abcd-ef1234567890')).toBe('A1B2C3D4');
  });

  it('UUID avec lettres mixed case -> normalise uppercase', () => {
    expect(formatShortOrderId('aBcDeF12-3456-7890-abcd-ef1234567890')).toBe('ABCDEF12');
  });

  it('string vide -> "—"', () => {
    expect(formatShortOrderId('')).toBe('—');
  });

  it('null -> "—"', () => {
    // @ts-expect-error test null safety
    expect(formatShortOrderId(null)).toBe('—');
  });

  it('undefined -> "—"', () => {
    // @ts-expect-error test undefined safety
    expect(formatShortOrderId(undefined)).toBe('—');
  });

  it('non-string -> "—"', () => {
    // @ts-expect-error test type safety
    expect(formatShortOrderId(12345)).toBe('—');
  });

  it('UUID court (<8 chars) -> retourne tout uppercase', () => {
    expect(formatShortOrderId('abc')).toBe('ABC');
  });
});
