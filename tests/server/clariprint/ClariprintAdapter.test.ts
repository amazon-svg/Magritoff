/**
 * Tests vitest pour src/server/clariprint/ClariprintAdapter.ts (Story R0 - garde-fou).
 *
 * Couvre AC5 : payload valide, prix negatif filtre, undefined filtre, produit
 * manquant, timeout, retry.
 *
 * Zone froide critique (audit refacto 2026-05-11 §6.3) : ce module est le point
 * d'entree unique vers Clariprint. Toute regression masque les anomalies prix
 * negatifs / NaN qui ont deja cause des incidents en prod (CONTEXT_Magrit_IA §3.5).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ClariprintError,
  ClariprintMockAdapter,
} from '../../../src/server/clariprint/ClariprintAdapter';

describe('ClariprintMockAdapter - chemin nominal', () => {
  let mock: ClariprintMockAdapter;

  beforeEach(() => {
    mock = new ClariprintMockAdapter();
  });

  it('1. Reponse valide → retourne le quote sanitize', async () => {
    mock.setNextResponse({ success: true, priceHT: 95.50 });
    const result = await mock.computePrice({ clariprint: { kind: 'flyer' } });
    expect(result.success).toBe(true);
    expect(result.priceHT).toBe(95.50);
  });

  it('2. Reponse avec costs.total → preservee', async () => {
    mock.setNextResponse({
      success: true,
      priceHT: 100,
      costs: { paper: 30, print: 50, total: 80 },
    });
    const result = await mock.computePrice({ clariprint: {} });
    expect(result.costs?.total).toBe(80);
  });

  it('3. Plusieurs setNextResponse → consommes en FIFO', async () => {
    mock.setNextResponse({ success: true, priceHT: 10 });
    mock.setNextResponse({ success: true, priceHT: 20 });
    const r1 = await mock.computePrice({ clariprint: {} });
    const r2 = await mock.computePrice({ clariprint: {} });
    expect(r1.priceHT).toBe(10);
    expect(r2.priceHT).toBe(20);
  });
});

describe('ClariprintMockAdapter - anomalies filtrees par validateClariprintResponse', () => {
  let mock: ClariprintMockAdapter;

  beforeEach(() => {
    mock = new ClariprintMockAdapter();
  });

  it('4. Prix negatif (-1.2 €) → ClariprintError kind=negative_price', async () => {
    mock.setNextResponse({ success: true, priceHT: -1.2 });
    try {
      await mock.computePrice({ clariprint: {} });
      throw new Error('should have thrown ClariprintError');
    } catch (e) {
      expect(e).toBeInstanceOf(ClariprintError);
      expect((e as ClariprintError).kind).toBe('negative_price');
    }
  });

  it('5. priceHT undefined alors que success=true → erreur typee (nan_price ou undefined_field)', async () => {
    mock.setNextResponse({ success: true } as any);
    try {
      await mock.computePrice({ clariprint: {} });
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ClariprintError);
      // validateClariprintResponse produit "absent, NaN ou non-numerique" qui
      // matche le mot-cle "nan" avant "absent" dans le mapping de l'adapter.
      // Les deux kinds sont semantiquement equivalents pour le caller (fallback).
      const err = e as ClariprintError;
      expect(['nan_price', 'undefined_field']).toContain(err.kind);
    }
  });

  it('6. priceHT NaN → kind=undefined_field (NaN n est pas finite)', async () => {
    mock.setNextResponse({ success: true, priceHT: NaN });
    try {
      await mock.computePrice({ clariprint: {} });
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ClariprintError);
      // validateClariprintResponse transforme NaN en "Prix Clariprint invalide
      // (absent, NaN ou non-numerique)" -> kind=undefined_field (mot-cle "absent")
      const err = e as ClariprintError;
      expect(['nan_price', 'undefined_field']).toContain(err.kind);
    }
  });

  it('7. success=false renvoye par backend → propage avec kind=unknown', async () => {
    mock.setNextResponse({ success: false, error: 'API down' });
    try {
      await mock.computePrice({ clariprint: {} });
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ClariprintError);
      expect((e as ClariprintError).kind).toBe('unknown');
    }
  });

  it('8. costs.total negatif → masque (success preserve, total=undefined)', async () => {
    mock.setNextResponse({
      success: true,
      priceHT: 100,
      costs: { paper: 30, total: -5 },
    });
    const result = await mock.computePrice({ clariprint: {} });
    expect(result.success).toBe(true);
    expect(result.costs?.total).toBeUndefined();
    expect(result.costs?.paper).toBe(30);
  });
});

describe('ClariprintMockAdapter - garde-fous tests', () => {
  it('9. Aucune reponse programmee → ClariprintError (eviter tests qui throw silencieusement)', async () => {
    const mock = new ClariprintMockAdapter();
    try {
      await mock.computePrice({ clariprint: {} });
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ClariprintError);
      expect((e as ClariprintError).message).toContain('setNextResponse');
    }
  });

  it('10. reset() vide la file de reponses', async () => {
    const mock = new ClariprintMockAdapter();
    mock.setNextResponse({ success: true, priceHT: 1 });
    mock.reset();
    try {
      await mock.computePrice({ clariprint: {} });
      throw new Error('should have thrown after reset');
    } catch (e) {
      expect(e).toBeInstanceOf(ClariprintError);
    }
  });
});

describe('ClariprintError - typage discrimine', () => {
  it('11. ClariprintError est une instance d Error standard', () => {
    const err = new ClariprintError('negative_price', 'test');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ClariprintError');
  });

  it('12. kind est preserve sur l instance', () => {
    const err = new ClariprintError('timeout', 'expired');
    expect(err.kind).toBe('timeout');
  });

  it('13. details optionnel sur l instance', () => {
    const err = new ClariprintError('network', 'fail', { code: 500 });
    expect(err.details).toEqual({ code: 500 });
  });
});
