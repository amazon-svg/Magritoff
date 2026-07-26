/**
 * Tests unitaires S7.4 — helpers purs de l'éditorial PIM.
 */

import { describe, expect, it } from 'vitest';
import {
  normalizeUsageExamples,
  parseLightMarkdown,
  pickDefinition,
  resolvePimTemplate,
  specRows,
} from '../../../../src/app/components/shop/gamme/pimEditorial.helpers';
import type { ProductDefinition } from '../../../../src/app/utils/productEnrichment';

const makeDef = (over: Partial<ProductDefinition>): ProductDefinition =>
  ({
    id: Math.random().toString(36).slice(2),
    gamme_slug: 'flyer',
    variation_filter: {},
    locale: 'fr',
    name: null,
    keywords: null,
    title_template: null,
    short_description_template: null,
    description_template: null,
    h1_template: null,
    seo_title: null,
    seo_description: null,
    schema_org_type: null,
    usage_examples: [],
    faq: [],
    quality_score: null,
    generated_by: null,
    validated_by: null,
    ...over,
  }) as ProductDefinition;

describe('pickDefinition (S7.4 AC1) — fr prioritaire, repli famille', () => {
  const defs = [
    makeDef({ gamme_slug: 'flyer', locale: 'en', name: 'EN' }),
    makeDef({ gamme_slug: 'flyer', locale: 'fr', name: 'FR' }),
    makeDef({ gamme_slug: 'affiche', locale: 'fr', name: 'Affiche FR' }),
  ];
  it('fr avant en pour la même gamme', () => {
    expect(pickDefinition(defs, 'flyer')?.name).toBe('FR');
  });
  it('repli sur la famille si la sous-gamme n a pas de définition', () => {
    expect(pickDefinition(defs, 'flyer_a6', 'flyer')?.name).toBe('FR');
  });
  it('aucune définition → null (section masquée AC2)', () => {
    expect(pickDefinition(defs, 'inconnu')).toBeNull();
    expect(pickDefinition([], 'flyer')).toBeNull();
  });
});

describe('resolvePimTemplate — jamais de {{placeholder}} brut (AC1)', () => {
  const options = { format: 'A5', paper: '170g', finishingFront: 'mat' };
  it('résout les tokens connus', () => {
    expect(
      resolvePimTemplate('Flyer {{format}} en {{grammage}}g, finition {{finition}}', options),
    ).toBe('Flyer A5 en 170g, finition mat');
  });
  it('retire les tokens inconnus proprement (papier inclus — pas de doublon grammage)', () => {
    const out = resolvePimTemplate(
      'Impression sur papier {{papier}} {{grammage}}g/m² {{inconnu}}',
      options,
    );
    expect(out).not.toContain('{{');
    expect(out).toBe('Impression sur papier 170g/m²');
  });

  it('résout quantite et finition_verso (vocabulaire prod)', () => {
    const out = resolvePimTemplate('À partir de {{quantite}} ex., verso {{finition_verso}}', {
      ...options,
      quantity: 1000,
      finishingVerso: 'brillant',
    });
    // toLocaleString fr-FR sépare les milliers par une espace fine insécable
    expect(out).toBe('À partir de 1 000 ex., verso brillant');
  });
  it('null/undefined → chaîne vide', () => {
    expect(resolvePimTemplate(null, options)).toBe('');
    expect(resolvePimTemplate(undefined, options)).toBe('');
  });
  it('sans options → tokens retirés', () => {
    expect(resolvePimTemplate('X {{format}} Y', null)).toBe('X Y');
  });
});

describe('parseLightMarkdown', () => {
  it('h2/h3, listes et paragraphes', () => {
    const blocks = parseLightMarkdown(
      '## Titre\n\nUn paragraphe.\n\n- item 1\n- item 2\n\n### Sous-titre\nsuite',
    );
    expect(blocks).toEqual([
      { kind: 'h2', text: 'Titre' },
      { kind: 'p', text: 'Un paragraphe.' },
      { kind: 'ul', items: ['item 1', 'item 2'] },
      { kind: 'h3', text: 'Sous-titre' },
      { kind: 'p', text: 'suite' },
    ]);
  });
  it('h1 rétrogradé en h2 (un seul H1 par page)', () => {
    expect(parseLightMarkdown('# Grand titre')[0]).toEqual({
      kind: 'h2',
      text: 'Grand titre',
    });
  });
  it('gras ** retiré (rendu texte)', () => {
    expect(parseLightMarkdown('- **fort** normal')[0]).toEqual({
      kind: 'ul',
      items: ['fort normal'],
    });
  });
});

describe('specRows', () => {
  it('dict simple → lignes libellé/valeur', () => {
    expect(specRows({ grammage_min: 90, formats: ['A6', 'A5'] })).toEqual([
      ['grammage min', '90'],
      ['formats', 'A6, A5'],
    ]);
  });
  it('valeurs nulles ignorées, objets imbriqués aplatis', () => {
    const rows = specRows({ a: null, delais: { standard: '48h', express: '24h' } });
    expect(rows).toHaveLength(1);
    expect(rows[0][1]).toContain('standard : 48h');
  });
  it('entrée non-objet → vide (jamais de crash)', () => {
    expect(specRows(null)).toEqual([]);
    expect(specRows('x')).toEqual([]);
    expect(specRows([1, 2])).toEqual([]);
  });
});

describe('normalizeUsageExamples — tolère objets et strings', () => {
  it('objets {title, description}', () => {
    expect(
      normalizeUsageExamples([{ title: 'T', description: 'D' }]),
    ).toEqual([{ title: 'T', description: 'D' }]);
  });
  it('strings simples', () => {
    expect(normalizeUsageExamples(['Salons pros'])).toEqual([
      { title: 'Salons pros', description: '' },
    ]);
  });
  it('entrées invalides filtrées', () => {
    expect(normalizeUsageExamples([null as never, { nope: 1 } as never])).toEqual([]);
    expect(normalizeUsageExamples(null)).toEqual([]);
  });
});
