import { describe, expect, it, vi } from 'vitest';
import { SupabaseCatalogAutomationGateway } from '@/adapters/supabase/catalog-repository';
import { CatalogRejectedError } from '@/modules/catalog/application/catalog-repository';

describe('SupabaseCatalogAutomationGateway', () => {
  it('traduit la commande contractuelle vers le payload de génération legacy', async () => {
    const invoke = vi.fn(async () => ({ data: { generated: { name: 'Flyer' } }, error: null }));
    const gateway = new SupabaseCatalogAutomationGateway({ functions: { invoke } } as never);
    const generated = await gateway.generateDefinition({
      gammeSlug: 'flyers', gammeName: 'Flyers', gammeMatchingRules: { kind: 'leaflet' },
      locale: 'fr', variationFilter: {}, mode: 'generate',
    });
    expect(generated).toEqual({ name: 'Flyer' });
    expect(invoke).toHaveBeenCalledWith('pim-generate', { body: {
      gamme_slug: 'flyers', gamme_name: 'Flyers', gamme_matching_rules: { kind: 'leaflet' },
      locale: 'fr', variation_filter: {}, mode: 'generate', existing: undefined,
    } });
  });

  it('refuse un rapport d’ingestion non conforme', async () => {
    const gateway = new SupabaseCatalogAutomationGateway({ functions: { invoke: vi.fn(async () => ({ data: {}, error: null })) } } as never);
    await expect(gateway.runIngest({ dryRun: true })).rejects.toMatchObject<CatalogRejectedError>({ code: 'upstream_error' });
  });
});
