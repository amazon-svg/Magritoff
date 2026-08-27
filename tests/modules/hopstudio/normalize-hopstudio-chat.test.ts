import { describe, expect, it } from 'vitest';
import { normalizeHopeStudioChatResponse } from '@/adapters/hopstudio/normalize-hopstudio-chat';

describe('normalisation du chat HopeStudio', () => {
  it('convertit les cartes HopeStudio vers le contrat de produits Magrit', () => {
    const result = normalizeHopeStudioChatResponse({
      response: {
        event: {
          message: 'Configuration trouvée',
          deck: [{
            UID: 'card-1',
            DBK: 'data-1',
            selected: 'Print~Flyer',
            configuration: {
              kind: 'leaflet',
              quantity: '500',
              width: 148,
              height: 210,
              material: 'Couché mat',
              weight: '170',
              gamme: 'flyer',
            },
          }],
        },
        session: {
          UID: 'session-1',
          DBK: 'session-data-1',
          alias_infos: {
            'Print~Flyer': { title: 'Flyer A5' },
          },
        },
      },
    });

    expect(result).toMatchObject({
      provider: 'hopstudio',
      sessionRef: 'session-1',
      sessionDataRef: 'session-data-1',
      teachingNote: 'Configuration trouvée',
      configs: [{
        clariprint: { kind: 'leaflet', quantity: '500' },
        display: {
          productName: 'Flyer A5',
          quantity: 500,
          format: '148 × 210',
          support: 'Couché mat',
          grammage: 170,
          gamme: 'flyer',
        },
        hopStudio: { cardRef: 'card-1', dataRef: 'data-1' },
      }],
    });
  });

  it('retient UID comme référence de conversation plutôt que la clé de données DBK', () => {
    const result = normalizeHopeStudioChatResponse({
      response: {
        session: { UID: 'session-1', DBK: 'data-1' },
      },
    });

    expect(result.sessionRef).toBe('session-1');
    expect(result.sessionDataRef).toBe('data-1');
  });

  it('accepte la réponse simplifiée avec un ui_event unique', () => {
    const result = normalizeHopeStudioChatResponse({
      response: {
        ai_message: 'Voici votre produit',
        ui_event: {
          ID: 'Box~Slide_box_alone',
          configuration: { quantity: 100, gamme_slug: 'packaging' },
        },
      },
    });

    expect(result.configs[0]).toMatchObject({
      display: { productName: 'Box~Slide_box_alone', quantity: 100, gamme: 'packaging' },
    });
  });

  it('décrit sans données sensibles la forme d une réponse hors contrat', () => {
    expect(() => normalizeHopeStudioChatResponse({
      status: 'error',
      message: 'détail serveur non exposé',
    })).toThrow('objet sans champ response; champs: status, message');
  });
});
