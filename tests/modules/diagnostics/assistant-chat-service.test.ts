import { describe, expect, it, vi } from 'vitest';
import { AssistantChatService } from '@/modules/diagnostics/application/assistant-chat-service';

const generated = {
  teachingNote: '',
  assumptions: ['Format A5 supposé'],
  clarification: null,
  clarificationOptions: [],
  products: [{
    clariprint: { reference: 'Flyer A5', kind: 'leaflet', quantity: '500' },
    display: {
      productName: 'Flyers A5',
      gamme: 'flyer',
      quantity: 500,
      format: 'A5',
      support: 'Couché brillant',
      grammage: 170,
      impression: { recto: 'Quadrichromie', verso: 'Sans impression' },
      finitionRecto: 'Sans finition',
      finitionVerso: 'Sans finition',
      suggestions: [],
    },
  }],
};

describe('AssistantChatService', () => {
  it('normalise la génération fournisseur vers le contrat historique du chat', async () => {
    const complete = vi.fn(async () => ({
      text: JSON.stringify(generated),
      model: 'gpt-test',
      inputTokens: 20,
      outputTokens: 40,
    }));
    const result = await new AssistantChatService({ complete }).generate({
      messages: [{ role: 'user', content: '500 flyers A5' }],
      mode: 'open',
    });
    expect(result).toMatchObject({
      configs: generated.products,
      assumptions: ['Format A5 supposé'],
      model: 'gpt-test',
      demoMode: false,
      usage: { input_tokens: 20, output_tokens: 40 },
    });
    expect(result.content[0]?.text).toContain('500 Flyers A5');
    expect(complete).toHaveBeenCalledWith(expect.objectContaining({
      outputSchema: expect.objectContaining({ name: 'magrit_catalog_suggestions' }),
    }));
  });

  it('rejette une configuration fournisseur qui ne respecte pas le contrat catalogue', async () => {
    const service = new AssistantChatService({ complete: async () => ({ text: '{"products":[]}', model: 'test' }) });
    await expect(service.generate({ messages: [{ role: 'user', content: 'Bonjour' }] })).rejects.toThrow();
  });
});
