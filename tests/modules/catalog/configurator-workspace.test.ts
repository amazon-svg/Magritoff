import { describe, expect, it } from 'vitest';
import {
  INITIAL_CONFIGURATOR_WORKSPACE_STATE,
  configuratorWorkspaceReducer,
} from '@/modules/catalog/ui/workspace/configurator-workspace-state';
import { searchPimDefinitions } from '@/modules/catalog/ui/workspace/PimSearchPanel';
import type { Gamme, ProductDefinition } from '@/modules/catalog/ui/helpers/productEnrichment';

const request = {
  id: 'request-1',
  query: '500 flyers A5',
  submittedAt: '2026-09-01T10:00:00.000Z',
} as const;

describe('workspace partagé configurateur', () => {
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
});
