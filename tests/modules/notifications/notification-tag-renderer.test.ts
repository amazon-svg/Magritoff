/**
 * Moteur de rendu des modeles de notification — grammaire fermee (story
 * E10.15a, contrat §8.23 §5).
 */
import { describe, expect, it } from 'vitest';
import {
  assertKnownNotificationTags,
  extractNotificationTagTokens,
  joinDeferredSegments,
  renderNotificationTags,
  renderNotificationTagsWithDeferred,
  UnknownNotificationTagError,
} from '@/modules/notifications/application/notification-tag-renderer';

describe('extractNotificationTagTokens', () => {
  it('extrait le contenu de chaque jeton {{...}}, dans l ordre, sans doublon', () => {
    expect(extractNotificationTagTokens('{{order.number}} — {{step.label}} — {{order.number}}')).toEqual([
      'order.number',
      'step.label',
    ]);
  });

  it('un texte sans balise ne rend aucun jeton', () => {
    expect(extractNotificationTagTokens('Texte simple, sans rien.')).toEqual([]);
  });

  it('une accolade isolee ({) n est pas un jeton', () => {
    expect(extractNotificationTagTokens('Tarif { promo } du moment.')).toEqual([]);
  });

  it('une variante avec espaces ({{ order.number }}) est capturee TELLE QUELLE, espaces compris', () => {
    expect(extractNotificationTagTokens('{{ order.number }}')).toEqual([' order.number ']);
  });

  it('une variante a une seule accolade ({order.number}) n est pas un jeton', () => {
    expect(extractNotificationTagTokens('{order.number}')).toEqual([]);
  });

  it('qa-review m1 — une balise IMBRIQUEE ({{ {{order.number}} }}) capture un contenu qui contient lui-meme des accolades, jamais l identifiant interne seul', () => {
    const tokens = extractNotificationTagTokens('{{ {{order.number}} }}');
    expect(tokens).toEqual([' {{order.number']);
    // Le contenu capture ne doit JAMAIS etre exactement "order.number" seul
    // (ce serait le signe que l ouverture externe a ete silencieusement
    // sautee, qa-review round 1).
    expect(tokens).not.toContain('order.number');
  });
});

describe('assertKnownNotificationTags', () => {
  const allowed = new Set(['order.number', 'step.label']);

  it('ne leve rien sur un texte sans balise', () => {
    expect(() => assertKnownNotificationTags('Texte simple.', allowed)).not.toThrow();
  });

  it('ne leve rien sur une balise CONNUE, syntaxe exacte', () => {
    expect(() => assertKnownNotificationTags('Commande {{order.number}}.', allowed)).not.toThrow();
  });

  it('leve UnknownNotificationTagError sur une balise absente de la liste blanche', () => {
    expect(() => assertKnownNotificationTags('Montant : {{order.total}}.', allowed)).toThrow(
      UnknownNotificationTagError,
    );
  });

  it('CA5 — une variante avec espaces ({{ order.number }}) est REFUSEE comme balise inconnue, jamais acceptee comme texte litteral ni comme la balise valide', () => {
    let caught: unknown;
    try {
      assertKnownNotificationTags('Commande {{ order.number }}.', allowed);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(UnknownNotificationTagError);
    expect((caught as UnknownNotificationTagError).tags).toEqual([' order.number ']);
  });

  it('rapporte TOUTES les balises inconnues d un texte, pas seulement la premiere', () => {
    let caught: unknown;
    try {
      assertKnownNotificationTags('{{a.b}} et {{c.d}}', new Set(['order.number']));
    } catch (error) {
      caught = error;
    }
    expect((caught as UnknownNotificationTagError).tags).toEqual(['a.b', 'c.d']);
  });

  it('qa-review m1 — une balise IMBRIQUEE ({{ {{order.number}} }}) est REFUSEE, meme si order.number est par ailleurs une balise connue', () => {
    expect(() => assertKnownNotificationTags('Texte {{ {{order.number}} }}.', allowed)).toThrow(
      UnknownNotificationTagError,
    );
  });
});

describe('renderNotificationTags', () => {
  it('un texte sans balise traverse INCHANGE', () => {
    expect(renderNotificationTags('Texte simple, sans rien.', {})).toBe('Texte simple, sans rien.');
  });

  it('substitue une balise CONNUE par sa valeur de contexte', () => {
    expect(renderNotificationTags('Commande {{order.number}}.', { 'order.number': 'CDE-2026-00042' })).toBe(
      'Commande CDE-2026-00042.',
    );
  });

  it('une balise ABSENTE du contexte rend une CHAINE VIDE, jamais un tiret ni le nom de la balise', () => {
    expect(renderNotificationTags('Livraison le {{order.expected_delivery_date}}.', {})).toBe('Livraison le .');
  });

  it('substitue plusieurs balises distinctes, chacune independamment', () => {
    const rendered = renderNotificationTags('{{tenant.name}} — {{order.number}} — {{step.label}}', {
      'tenant.name': 'Imprimerie Exemple',
      'order.number': 'CDE-2026-00042',
      'step.label': 'En cours de production',
    });
    expect(rendered).toBe('Imprimerie Exemple — CDE-2026-00042 — En cours de production');
  });

  it('UNE VALEUR SUBSTITUEE N EST JAMAIS RE-BALAYEE : une valeur de contexte contenant elle-meme un jeton litteral n est pas interpretee une seconde fois', () => {
    const rendered = renderNotificationTags('Client : {{customer.company_name}}.', {
      'customer.company_name': 'SARL {{order.number}} Frères',
      'order.number': 'CDE-2026-00042',
    });
    expect(rendered).toBe('Client : SARL {{order.number}} Frères.');
  });

  it('une balise repetee est substituee a chaque occurrence', () => {
    expect(renderNotificationTags('{{order.number}} / {{order.number}}', { 'order.number': 'CDE-2026-00042' })).toBe(
      'CDE-2026-00042 / CDE-2026-00042',
    );
  });

  it('qa-review m1 — une balise IMBRIQUEE ne fait JAMAIS fuiter les accolades externes autour de la valeur substituee', () => {
    // Avant correctif : rendait "{{ CDE-2026-00042 }}" (accolades externes
    // livrees au client). Le span couvre desormais TOUT le contenu imbrique
    // (context["...order.number"] est absent -> chaine vide), et seul le
    // texte hors span (ici trainant) reste litteral.
    const rendered = renderNotificationTags('{{ {{order.number}} }}', { 'order.number': 'CDE-2026-00042' });
    expect(rendered).not.toContain('CDE-2026-00042');
    expect(rendered).not.toMatch(/\{\{\s*CDE-2026-00042\s*\}\}/);
  });
});

/**
 * RENDU DIFFERE (E10.15d-2, §8.23 point 11) — `files.count` SEULE balise
 * `delivery` du catalogue. Ces tests verrouillent la propriete NON
 * NEGOCIABLE du point 11.1 : le texte PROVISOIRE laisse une balise differee
 * EN CLAIR, et la remise reconstitue le texte final par CONCATENATION PURE
 * des segments — JAMAIS un second balayage.
 */
describe('renderNotificationTagsWithDeferred', () => {
  const DEFERRED = new Set(['files.count']);

  it('un texte sans aucune balise ne produit qu un SEGMENT LITTERAL, texte inchange', () => {
    const result = renderNotificationTagsWithDeferred('Texte simple, sans rien.', {}, DEFERRED);
    expect(result.text).toBe('Texte simple, sans rien.');
    expect(result.segments).toEqual([{ kind: 'literal', text: 'Texte simple, sans rien.' }]);
  });

  it('une balise ENQUEUE (non differee) est substituee IMMEDIATEMENT — jamais un segment `tag`', () => {
    const result = renderNotificationTagsWithDeferred('Commande {{order.number}}.', { 'order.number': 'CDE-2026-00042' }, DEFERRED);
    expect(result.text).toBe('Commande CDE-2026-00042.');
    expect(result.segments).toEqual([{ kind: 'literal', text: 'Commande CDE-2026-00042.' }]);
  });

  it('une balise DIFFEREE est LAISSEE EN CLAIR dans le texte provisoire, ET devient un segment `tag`', () => {
    const result = renderNotificationTagsWithDeferred('Vous avez déposé {{files.count}} fichier(s).', {}, DEFERRED);
    expect(result.text).toBe('Vous avez déposé {{files.count}} fichier(s).');
    expect(result.segments).toEqual([
      { kind: 'literal', text: 'Vous avez déposé ' },
      { kind: 'tag', id: 'files.count' },
      { kind: 'literal', text: ' fichier(s).' },
    ]);
  });

  it('melange balise ENQUEUE + balise DIFFEREE : la premiere est substituee, la seconde laissee en clair, un seul flux de segments', () => {
    const result = renderNotificationTagsWithDeferred(
      '{{order.number}} : {{files.count}} fichier(s).',
      { 'order.number': 'CDE-2026-00042' },
      DEFERRED,
    );
    expect(result.text).toBe('CDE-2026-00042 : {{files.count}} fichier(s).');
    expect(result.segments).toEqual([
      { kind: 'literal', text: 'CDE-2026-00042 : ' },
      { kind: 'tag', id: 'files.count' },
      { kind: 'literal', text: ' fichier(s).' },
    ]);
  });

  it('une occurrence CLIENT contenant litteralement {{files.count}} (donnee, pas une balise reelle) devient un segment LITTERAL — jamais un segment `tag`', () => {
    const result = renderNotificationTagsWithDeferred('Client : {{customer.company_name}}.', {
      'customer.company_name': 'SARL {{files.count}} Frères',
    }, DEFERRED);
    expect(result.text).toBe('Client : SARL {{files.count}} Frères.');
    // AUCUN segment `tag` : la substitution de `customer.company_name`
    // (balise enqueue) a produit une VALEUR, jamais re-balayee.
    expect(result.segments.every((segment) => segment.kind === 'literal')).toBe(true);
  });
});

describe('joinDeferredSegments', () => {
  it('CONCATENE les segments, resolvant chaque balise differee dans `values`', () => {
    const segments = [
      { kind: 'literal' as const, text: 'Vous avez déposé ' },
      { kind: 'tag' as const, id: 'files.count' },
      { kind: 'literal' as const, text: ' fichier(s).' },
    ];
    expect(joinDeferredSegments(segments, { 'files.count': '3' })).toBe('Vous avez déposé 3 fichier(s).');
  });

  it('une balise ABSENTE de `values` rend une CHAINE VIDE, jamais une exception', () => {
    const segments = [{ kind: 'tag' as const, id: 'files.count' }];
    expect(joinDeferredSegments(segments, {})).toBe('');
  });

  it('NE RE-BALAYE JAMAIS : un segment litteral portant litteralement {{files.count}} traverse INCHANGE, meme si la valeur est fournie', () => {
    const segments = [{ kind: 'literal' as const, text: 'SARL {{files.count}} Frères' }];
    expect(joinDeferredSegments(segments, { 'files.count': '99' })).toBe('SARL {{files.count}} Frères');
  });

  it('un tableau de segments VIDE rend une chaine VIDE', () => {
    expect(joinDeferredSegments([], { 'files.count': '3' })).toBe('');
  });
});
