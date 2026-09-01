import { describe, expect, it } from 'vitest';
import {
  INITIAL_CONFIGURATOR_WORKSPACE_STATE,
  configuratorWorkspaceReducer,
} from '@/modules/catalog/ui/workspace/configurator-workspace-state';
import { searchPimDefinitions } from '@/modules/catalog/ui/workspace/PimSearchPanel';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Gamme, ProductDefinition } from '@/modules/catalog/ui/helpers/productEnrichment';

const request = {
  id: 'request-1',
  query: '500 flyers A5',
  submittedAt: '2026-09-01T10:00:00.000Z',
} as const;

describe('workspace partagé configurateur', () => {
  it('présente les résultats PIM en deux colonnes avec un aperçu', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/modules/catalog/ui/workspace/PimSearchPanel.tsx'),
      'utf8',
    );

    expect(source).toContain('lg:grid-cols-2');
    expect(source).toContain('<ProductResultImage');
    expect(source).toContain('loading="lazy"');
  });

  it('passe de l accueil au split et initialise la recherche PIM', () => {
    const state = configuratorWorkspaceReducer(INITIAL_CONFIGURATOR_WORKSPACE_STATE, {
      type: 'submit',
      request,
    });

    expect(state).toEqual({ mode: 'split', initialRequest: request, pimQuery: request.query });
  });

  it('bascule entre les modes de focus sans perdre la requête', () => {
    const split = configuratorWorkspaceReducer(INITIAL_CONFIGURATOR_WORKSPACE_STATE, {
      type: 'submit',
      request,
    });
    const studio = configuratorWorkspaceReducer(split, { type: 'focus-studio' });
    const pim = configuratorWorkspaceReducer(studio, { type: 'focus-pim' });
    const restored = configuratorWorkspaceReducer(pim, { type: 'show-split' });

    expect(studio.mode).toBe('studio');
    expect(pim.mode).toBe('pim');
    expect(restored).toMatchObject({ mode: 'split', initialRequest: request });
  });

  it('recherche les définitions PIM par mots métier et privilégie le français', () => {
    const gammes: Gamme[] = [{
      id: 'gamme-1', slug: 'flyers', name: 'Flyers', parent_slug: null,
      matching_rules: {}, display_order: 1,
    }];
    const base: ProductDefinition = {
      id: 'definition-fr', gamme_slug: 'flyers', variation_filter: {}, locale: 'fr',
      name: 'Flyer A5', keywords: ['papier couché', 'prospectus'], title_template: null,
      short_description_template: 'Impression de flyers professionnels', description_template: null,
      h1_template: null, seo_title: null, seo_description: null, schema_org_type: null,
      usage_examples: [], faq: [], quality_score: null, generated_by: 'human',
      validated_by: 'human', image_url: null,
    };
    const definitions = [base, { ...base, id: 'definition-en', locale: 'en', name: 'Leaflet' }];

    const results = searchPimDefinitions('500 flyers papier', definitions, gammes);

    expect(results).toHaveLength(1);
    expect(results[0]?.definition.id).toBe('definition-fr');
    expect(results[0]?.score).toBeGreaterThanOrEqual(2);
  });

  it('écarte les produits qui ne correspondent qu à un mot faible de la demande', () => {
    const gammes: Gamme[] = [
      { id: 'cards', slug: 'business-cards', name: 'Cartes de visite', parent_slug: null, matching_rules: {}, display_order: 1 },
      { id: 'menus', slug: 'menus', name: 'Menus restaurant', parent_slug: null, matching_rules: {}, display_order: 2 },
    ];
    const definition = (id: string, gamme_slug: string, name: string, keywords: string[]): ProductDefinition => ({
      id, gamme_slug, variation_filter: {}, locale: 'fr', name, keywords,
      title_template: null, short_description_template: null, description_template: null,
      h1_template: null, seo_title: null, seo_description: null, schema_org_type: null,
      usage_examples: [], faq: [], quality_score: null, generated_by: 'human',
      validated_by: 'human', image_url: null,
    });
    const definitions = [
      definition('business-card', 'business-cards', 'Carte de visite', ['pelliculage mat']),
      definition('restaurant-menu', 'menus', 'Menu restaurant', ['carte des plats']),
    ];

    const results = searchPimDefinitions(
      '500 cartes de visite avec pelliculage mat',
      definitions,
      gammes,
    );

    expect(results.map((result) => result.definition.id)).toEqual(['business-card']);
  });

  it('retrouve un concept métier anglais depuis une requête française avec une faute légère', () => {
    const gammes: Gamme[] = [{
      id: 'flyers', slug: 'leaflets', name: 'Leaflets', parent_slug: null,
      matching_rules: {}, display_order: 1,
    }];
    const definition: ProductDefinition = {
      id: 'leaflet', gamme_slug: 'leaflets', variation_filter: {}, locale: 'fr',
      name: 'Commercial printed leaflet', keywords: ['papier couché', 'flyer'],
      title_template: null, short_description_template: null, description_template: null,
      h1_template: null, seo_title: null, seo_description: null, schema_org_type: null,
      usage_examples: [], faq: [], quality_score: 90, generated_by: 'human',
      validated_by: 'human', image_url: null,
    };

    expect(searchPimDefinitions('500 flier papier couché', [definition], gammes))
      .toHaveLength(1);
  });
});
