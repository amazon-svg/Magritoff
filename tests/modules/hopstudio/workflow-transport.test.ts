import { describe, expect, it, vi } from 'vitest';
import {
  createWorkflowTransport,
  getHopeStudioCardDescription,
  getHopeStudioCardSvgs,
  getHopeStudioCardSvgsForImport,
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
      visibility: 'internal',
      filename: 'devis-fournisseur-card-1.pdf',
      content_type: 'application/pdf',
      data_base64: 'JVBERg==',
    });
  });

  it('récupère chaque gabarit SVG porté par la card', async () => {
    const card = selectedHopeStudioCard({
      DBK: 'card-1',
      prompt: '500 cartes de visite',
      configuration: { quantity: 500 },
      clicked_intent: { getPrice: { response: 75 } },
    }, 0);
    const getCardSvgs = vi.fn((_card: unknown, callback: (data: unknown) => void) => {
      callback({
        warnings: [],
        response: [
          { sources: ['gabarit-decoupe.svg'], svg: '<svg><path d="M 0 0"/></svg>' },
          { sources: ['dossiers/pliage.svg'], svg: '<svg>Épreuve pliage</svg>' },
        ],
      });
    });
    const getDesignerSVG = vi.fn((svg: string) => svg.replace('<svg', '<svg data-version="pao"'));
    const getPrinterSVG = vi.fn((svg: string) => svg.replace('<svg', '<svg data-version="production"'));

    const files = await getHopeStudioCardSvgs(card, { getCardSvgs, getDesignerSVG, getPrinterSVG });

    expect(getCardSvgs).toHaveBeenCalledWith(card, expect.any(Function));
    expect(files).toEqual([
      {
        kind: 'technical_template',
        visibility: 'customer',
        filename: 'gabarit-decoupe-pao.svg',
        content_type: 'image/svg+xml',
        data_base64: expect.any(String),
      },
      {
        kind: 'technical_template',
        visibility: 'internal',
        filename: 'gabarit-decoupe-production.svg',
        content_type: 'image/svg+xml',
        data_base64: expect.any(String),
      },
      {
        kind: 'technical_template',
        visibility: 'customer',
        filename: 'pliage-pao.svg',
        content_type: 'image/svg+xml',
        data_base64: expect.any(String),
      },
      {
        kind: 'technical_template',
        visibility: 'internal',
        filename: 'pliage-production.svg',
        content_type: 'image/svg+xml',
        data_base64: expect.any(String),
      },
    ]);
    expect(Buffer.from(files[0]!.data_base64, 'base64').toString('utf8'))
      .toBe('<svg data-version="pao"><path d="M 0 0"/></svg>');
    expect(Buffer.from(files[1]!.data_base64, 'base64').toString('utf8'))
      .toBe('<svg data-version="production"><path d="M 0 0"/></svg>');
    expect(getDesignerSVG).toHaveBeenCalledTimes(2);
    expect(getPrinterSVG).toHaveBeenCalledTimes(2);
  });

  it('refuse un gabarit HopeStudio incomplet', async () => {
    const card = selectedHopeStudioCard({
      DBK: 'card-1',
      configuration: {},
      clicked_intent: { getPrice: { response: 75 } },
    }, 0);
    const getCardSvgs = (_card: unknown, callback: (data: unknown) => void) => {
      callback({ reponses: [{ sources: 'gabarit.svg' }] });
    };

    await expect(getHopeStudioCardSvgs(card, {
      getCardSvgs,
      getDesignerSVG: (svg) => svg,
      getPrinterSVG: (svg) => svg,
    }))
      .rejects.toThrow('Le gabarit HopeStudio n°1 est invalide.');
  });

  it('ne bloque pas l’import lorsque les gabarits sont invalides', async () => {
    const card = selectedHopeStudioCard({
      DBK: 'card-1',
      configuration: {},
      clicked_intent: { getPrice: { response: 75 } },
    }, 0);
    const getCardSvgs = (_card: unknown, callback: (data: unknown) => void) => {
      callback({ status: 'error' });
    };

    const result = await getHopeStudioCardSvgsForImport(card, {
      getCardSvgs,
      getDesignerSVG: (svg) => svg,
      getPrinterSVG: (svg) => svg,
    });

    expect(result.files).toEqual([]);
    expect(result.warning).toBe('HopeStudio a retourné une réponse de gabarits invalide.');
  });

  it('utilise le résumé clair HopeStudio comme détail sécurisé de la ligne', () => {
    const card = selectedHopeStudioCard({
      DBK: 'card-1',
      prompt: '500 cartes de visite',
      configuration: { quantity: 500 },
      message: 'Carte <script>alert(1)</script>',
      clicked_intent: { getPrice: { response: 75 } },
    }, 0);
    const getCardClearResume = vi.fn(() => 'Carte premium &amp; pelliculage\n500 exemplaires');
    const ownerDocument = {
      createElement: () => {
        let value = '';
        return {
          get value() { return value; },
          set innerHTML(input: string) { value = input.replaceAll('&amp;', '&'); },
        };
      },
    } as unknown as Document;

    const description = getHopeStudioCardDescription(card, { getCardClearResume }, ownerDocument);

    expect(getCardClearResume).toHaveBeenCalledWith(card);
    expect(description).toBe('<p>Carte premium &amp; pelliculage<br>500 exemplaires</p>');
  });
});
