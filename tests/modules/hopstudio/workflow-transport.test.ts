import { describe, expect, it, vi } from 'vitest';
import {
  createWorkflowTransport,
  getHopeStudioSupplierQuote,
  selectedHopeStudioCard,
} from '@/modules/hopstudio/ui/HopeStudioWorkspace';

describe('transport du workflow HopeStudio', () => {
  it('relaie le corps exact sans inventer un appel newSession', async () => {
    const callWorkflow = vi.fn(async () => ({ status: 'ok', datas: {} }));
    const transport = createWorkflowTransport(
      { callWorkflow },
      'tenant-1',
      'user-1',
    );
    const body = 'action=loadSession&tenant_id=tenant-1&user_id=user-1&data_key=last';

    const response = await transport('/json.wcl', { method: 'POST', body });

    expect(response.status).toBe(200);
    expect(callWorkflow).toHaveBeenCalledTimes(1);
    expect(callWorkflow).toHaveBeenCalledWith('tenant-1', expect.objectContaining({
      context: expect.objectContaining({ body }),
    }), undefined);
    expect(callWorkflow.mock.calls[0]?.[1].context.body).not.toContain('action=newSession');
  });
});

describe('ajout d’un chiffrage HopeStudio au projet', () => {
  it('utilise le prix du processus choisi par callbackAddToBasket', () => {
    const card = selectedHopeStudioCard({
      DBK: 'card-1',
      prompt: '500 cartes de visite',
      selected: 'Carte premium',
      configuration: { quantity: 500 },
      clicked_intent: {
        getPrice: {
          response: 75,
          all_process: [{ total: 80 }, { total: 125.5 }],
        },
      },
    }, 1);

    expect(card.clicked_intent.getPrice.response).toBe(125.5);
  });

  it('récupère le PDF fournisseur avec la clé portée par la card', async () => {
    const card = selectedHopeStudioCard({
      DBK: 'card-1',
      prompt: '500 cartes de visite',
      configuration: { quantity: 500 },
      clicked_intent: {
        getPrice: {
          response: 75,
          quote_process_key: 'quote-process-1',
        },
      },
    }, 0);
    const getAttachment = vi.fn(async () => Response.json({
      status: 'ok',
      datas: 'JVBERg==',
    }));

    const file = await getHopeStudioSupplierQuote(card, { getAttachment });

    expect(getAttachment).toHaveBeenCalledWith('quote-process-1');
    expect(file).toEqual({
      kind: 'supplier_quote',
      filename: 'devis-fournisseur-card-1.pdf',
      content_type: 'application/pdf',
      data_base64: 'JVBERg==',
    });
  });
});
