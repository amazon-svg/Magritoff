import { describe, expect, it } from 'vitest';
import type { AiCompletionGateway } from '@/modules/diagnostics/application/ai-completion-gateway';
import { AiCompletionUnavailableError } from '@/modules/diagnostics/application/ai-completion-gateway';
import { AiPimDefinitionGenerator } from '@/modules/catalog/application/ai-pim-definition-generator';

describe('AiPimDefinitionGenerator', () => {
  it('genere une fiche avec le fournisseur IA configure', async () => {
    let system = '';
    const gateway: AiCompletionGateway = {
      async complete(request) {
        system = request.system ?? '';
        return { text: '```json\n{"name":"Flyer A5","faq":[]}\n```', model: 'test' };
      },
    };
    const result = await new AiPimDefinitionGenerator(gateway).generateDefinition({
      gammeSlug: 'flyers',
      gammeName: 'Flyers',
      locale: 'fr',
      gammeMatchingRules: { kind: 'leaflet' },
      variationFilter: { format: 'A5' },
      mode: 'generate',
    });

    expect(result).toEqual({ name: 'Flyer A5', faq: [] });
    expect(system).toContain('expert SEO');
  });

  it('utilise le mode relecture', async () => {
    let system = '';
    const gateway: AiCompletionGateway = {
      async complete(request) {
        system = request.system ?? '';
        return { text: '{"quality_score":0.9,"issues":[],"improved":{}}', model: 'test' };
      },
    };
    await new AiPimDefinitionGenerator(gateway).generateDefinition({
      gammeSlug: 'flyers', locale: 'fr', variationFilter: {}, mode: 'validate', existing: { name: 'Flyer' },
    });
    expect(system).toContain('relecteur');
  });

  it('traduit les pannes et les reponses non JSON en erreur catalogue', async () => {
    const unavailable = new AiPimDefinitionGenerator({
      async complete() { throw new AiCompletionUnavailableError('not_configured', 'Cle absente.'); },
    });
    const invalid = new AiPimDefinitionGenerator({
      async complete() { return { text: 'pas du json', model: 'test' }; },
    });

    await expect(unavailable.generateDefinition({
      gammeSlug: 'flyers', locale: 'fr', variationFilter: {}, mode: 'generate',
    })).rejects.toMatchObject({ code: 'upstream_error', message: 'Cle absente.' });
    await expect(invalid.generateDefinition({
      gammeSlug: 'flyers', locale: 'fr', variationFilter: {}, mode: 'generate',
    })).rejects.toMatchObject({ code: 'upstream_error' });
  });
});
