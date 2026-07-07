/**
 * S2.11 — Tests unitaires productFamilyIdentity (identité visuelle de famille).
 *
 * Le repère famille (couleur + libellé) doit :
 *  - réutiliser la taxonomie MockupTemplate existante (7 familles) ;
 *  - fournir un libellé FR + une tonalité (couleur) constante par famille ;
 *  - être neutre/sémantique (pas thémé par la boutique — décision Arnaud 2026-07-07) ;
 *  - couvrir les 7 familles + le fallback.
 */

import { describe, expect, it } from 'vitest';
import {
  resolveFamilyIdentity,
  FAMILY_IDENTITY,
  FAMILY_ICON,
} from '../../src/app/utils/productFamilyIdentity';
import type { MockupTemplate } from '../../src/app/utils/productMockupAssets';

const ALL_TEMPLATES: MockupTemplate[] = [
  'flyer',
  'carteVisite',
  'brochure',
  'depliant',
  'etiquette',
  'kakemono',
  'packaging',
];

describe('productFamilyIdentity — couverture des 7 familles', () => {
  it('mappe chaque famille à un libellé + tonalité + picto', () => {
    for (const t of ALL_TEMPLATES) {
      const id = FAMILY_IDENTITY[t];
      expect(id, `identité manquante pour ${t}`).toBeDefined();
      expect(id.label.length).toBeGreaterThan(0);
      expect(id.tone).toMatch(/^#[0-9a-fA-F]{6}$/); // hex constant, pas un token tenant
      expect(FAMILY_ICON[t], `picto manquant pour ${t}`).toBeDefined();
    }
  });

  it('donne des tonalités distinctes par famille (repère scannable)', () => {
    const tones = ALL_TEMPLATES.map((t) => FAMILY_IDENTITY[t].tone);
    expect(new Set(tones).size).toBe(ALL_TEMPLATES.length);
  });

  it('des libellés distincts et humains (FR)', () => {
    const labels = ALL_TEMPLATES.map((t) => FAMILY_IDENTITY[t].label);
    expect(new Set(labels).size).toBe(ALL_TEMPLATES.length);
  });
});

describe('productFamilyIdentity — resolveFamilyIdentity(product)', () => {
  it('résout via le kind Clariprint (carte de visite)', () => {
    const id = resolveFamilyIdentity({ config: { kind: 'carte_visite' } });
    expect(id.template).toBe('carteVisite');
    expect(id.label).toBe(FAMILY_IDENTITY.carteVisite.label);
  });

  it('résout via inférence nom quand kind absent (kakémono)', () => {
    const id = resolveFamilyIdentity({ name: 'Roll-up salon 85x200' });
    expect(id.template).toBe('kakemono');
  });

  it('fallback flyer quand rien n est reconnaissable (jamais de card cassée)', () => {
    const id = resolveFamilyIdentity({});
    expect(id.template).toBe('flyer');
    expect(id.tone).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(id.label.length).toBeGreaterThan(0);
  });

  it('la tonalité ne dépend PAS de la boutique (constante inter-tenant)', () => {
    const a = resolveFamilyIdentity({ config: { kind: 'brochure' } });
    const b = resolveFamilyIdentity({ config: { kind: 'brochure' } });
    expect(a.tone).toBe(b.tone);
    expect(a.tone).toBe(FAMILY_IDENTITY.brochure.tone);
  });
});
