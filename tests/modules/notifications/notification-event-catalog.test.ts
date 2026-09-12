/**
 * Catalogue des evenements notifiables — source unique du validateur
 * d enregistrement ET d un futur ecran de parametrage (story E10.15a).
 */
import { describe, expect, it } from 'vitest';
import {
  allowedTagsForEvent,
  deferredTagsForEvent,
  eventSupportsStepFilter,
  exampleTagContext,
  isNotifiableEventName,
  listNotificationEventCatalog,
} from '@/modules/notifications/application/notification-event-catalog';
import { NOTIFICATION_EVENT_NAMES, NOTIFICATION_TAG_IDS } from '@/modules/notifications/api/contracts';

describe('listNotificationEventCatalog', () => {
  it('rend les cinq evenements notifiables, jamais order.created', () => {
    const catalog = listNotificationEventCatalog(false);
    expect(catalog.map((e) => e.event_name).sort()).toEqual([...NOTIFICATION_EVENT_NAMES].sort());
    expect(catalog.some((e) => (e.event_name as string) === 'order.created')).toBe(false);
  });

  it('le canal sms est absent du catalogue si l espace ne l a pas arme, present sinon', () => {
    expect(listNotificationEventCatalog(false).every((e) => e.channels.length === 1 && e.channels[0] === 'email')).toBe(
      true,
    );
    expect(
      listNotificationEventCatalog(true).every((e) => e.channels.length === 2 && e.channels.includes('sms')),
    ).toBe(true);
  });

  it('seul order.step_changed supporte le filtre d etape', () => {
    for (const descriptor of listNotificationEventCatalog(false)) {
      expect(descriptor.supports_step_filter).toBe(descriptor.event_name === 'order.step_changed');
    }
  });

  it('seul order.files_submitted regroupe (coalescing_window_minutes non nul)', () => {
    for (const descriptor of listNotificationEventCatalog(false)) {
      if (descriptor.event_name === 'order.files_submitted') {
        expect(descriptor.coalescing_window_minutes).toBeGreaterThan(0);
      } else {
        expect(descriptor.coalescing_window_minutes).toBe(0);
      }
    }
  });

  it('chaque balise proposee par le catalogue appartient a la liste blanche NOTIFICATION_TAG_IDS', () => {
    for (const descriptor of listNotificationEventCatalog(true)) {
      for (const tag of descriptor.tags) {
        expect(NOTIFICATION_TAG_IDS).toContain(tag.id);
        expect(tag.syntax).toBe(`{{${tag.id}}}`);
      }
    }
  });

  it('aucune balise de montant, taux, remise ou statut (hors step.label) — regle definitive du contrat', () => {
    const forbidden = ['amount', 'total', 'price', 'discount', 'rate', 'status'];
    for (const descriptor of listNotificationEventCatalog(true)) {
      for (const tag of descriptor.tags) {
        for (const word of forbidden) {
          expect(tag.id.toLowerCase()).not.toContain(word);
        }
      }
    }
  });

  /**
   * E10.15d-1 (§8.23 point 11, trou de couverture signale explicitement par
   * l architecte : « les tests de contrat ne le rattrapent pas »). Verrouille
   * trois regles OPPOSABLES sur `render_stage`, servies telles quelles par
   * `listNotificationEvents` — le mecanisme de rendu differe lui-meme reste
   * HORS PERIMETRE de ce lot (E10.15d-2).
   */
  it('chaque balise servie porte render_stage ; files.count est la SEULE delivery ; une balise delivery n apparait que sur un evenement a fenetre (coalescing_window_minutes > 0)', () => {
    const catalog = listNotificationEventCatalog(true);
    for (const descriptor of catalog) {
      for (const tag of descriptor.tags) {
        expect(['enqueue', 'delivery']).toContain(tag.render_stage);
        if (tag.render_stage === 'delivery') {
          expect(tag.id).toBe('files.count');
          expect(descriptor.coalescing_window_minutes).toBeGreaterThan(0);
        } else {
          expect(tag.id).not.toBe('files.count');
        }
      }
    }
    // `files.count` existe aujourd hui UNIQUEMENT sur `order.files_submitted`
    // (catalogue) — confirme que la regle ci-dessus n est pas vide de sens
    // (un catalogue qui ne proposerait `files.count` nulle part la
    // satisferait trivialement).
    const eventsWithFilesCount = catalog.filter((descriptor) => descriptor.tags.some((tag) => tag.id === 'files.count'));
    expect(eventsWithFilesCount.map((descriptor) => descriptor.event_name)).toEqual(['order.files_submitted']);
  });
});

describe('isNotifiableEventName', () => {
  it('accepte les cinq noms notifiables, refuse un evenement interne du bus', () => {
    for (const name of NOTIFICATION_EVENT_NAMES) {
      expect(isNotifiableEventName(name)).toBe(true);
    }
    expect(isNotifiableEventName('price_rule.changed')).toBe(false);
    expect(isNotifiableEventName('order.created')).toBe(false);
  });
});

describe('allowedTagsForEvent / eventSupportsStepFilter', () => {
  it('order.step_changed est le seul evenement a accepter step.label', () => {
    expect(allowedTagsForEvent('order.step_changed').has('step.label')).toBe(true);
    expect(allowedTagsForEvent('customer.created').has('step.label')).toBe(false);
    expect(eventSupportsStepFilter('order.step_changed')).toBe(true);
    expect(eventSupportsStepFilter('customer.created')).toBe(false);
  });
});

describe('exampleTagContext', () => {
  it('fournit une valeur d exemple FICTIVE pour chaque balise de la liste blanche', () => {
    const context = exampleTagContext();
    for (const id of NOTIFICATION_TAG_IDS) {
      expect(typeof context[id]).toBe('string');
      expect(context[id].length).toBeGreaterThan(0);
    }
  });
});

/** E10.15d-2 (§8.23 point 11.3 §1) : source UNIQUE lue par la mise en file, jamais une liste en dur. */
describe('deferredTagsForEvent', () => {
  it('order.files_submitted propose EXACTEMENT files.count comme balise differee', () => {
    expect([...deferredTagsForEvent('order.files_submitted')]).toEqual(['files.count']);
  });

  it('les quatre autres evenements ne proposent AUCUNE balise differee', () => {
    for (const eventName of ['quote.sent', 'quote.converted', 'order.step_changed', 'customer.created'] as const) {
      expect(deferredTagsForEvent(eventName).size).toBe(0);
    }
  });

  it('un evenement inconnu rend un ensemble VIDE, jamais une erreur', () => {
    expect(deferredTagsForEvent('price_rule.changed' as never).size).toBe(0);
  });
});
