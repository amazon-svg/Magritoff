/**
 * Fuseau de reference du produit (E10.18a) — `Europe/Paris`, PREMIERE
 * occurrence d un fuseau non-UTC du depot (docs/api/CONVENTIONS.md §8.24
 * point 5 regle 8). Ce fichier exerce PRECISEMENT les bornes aux deux bords
 * d un mois, jamais un mois calendaire naif : c est le seul endroit ou ce
 * lot peut vraiment se tromper.
 */
import { describe, expect, it, vi } from 'vitest';
import { endOfDayInReferenceTimeZone, PRODUCT_REFERENCE_TIME_ZONE, startOfDayInReferenceTimeZone } from '@/kernel';

describe('fuseau de reference du produit (Europe/Paris)', () => {
  it('est Europe/Paris, constante unique', () => {
    expect(PRODUCT_REFERENCE_TIME_ZONE).toBe('Europe/Paris');
  });

  it('1er septembre 00:00 a Paris (ete, CEST +02:00) vaut 31 aout 22:00 UTC — exemple du contrat', () => {
    // docs/api/CONVENTIONS.md §8.24 : "une commande passee le 1er septembre a
    // 00h30 a Paris vaut 2026-08-31T22:30:00Z".
    expect(startOfDayInReferenceTimeZone('2026-09-01').toISOString()).toBe('2026-08-31T22:00:00.000Z');
  });

  it('31 aout 23:59:59.999 a Paris (ete) vaut 31 aout 21:59:59.999 UTC', () => {
    expect(endOfDayInReferenceTimeZone('2026-08-31').toISOString()).toBe('2026-08-31T21:59:59.999Z');
  });

  it('BORD BAS — une commande a 2026-08-31T22:30:00Z (1er septembre 00h30 a Paris) entre dans une demande de septembre et sort d une demande d aout', () => {
    const createdAt = Date.parse('2026-08-31T22:30:00.000Z');

    const septemberFrom = startOfDayInReferenceTimeZone('2026-09-01').getTime();
    expect(createdAt).toBeGreaterThanOrEqual(septemberFrom);

    const augustTo = endOfDayInReferenceTimeZone('2026-08-31').getTime();
    expect(createdAt).toBeGreaterThan(augustTo);
  });

  it('BORD HAUT (symetrique) — une commande a 2026-09-30T22:30:00Z (1er octobre 00h30 a Paris, CEST encore actif) sort d une demande de septembre et entre dans une demande d octobre', () => {
    const createdAt = Date.parse('2026-09-30T22:30:00.000Z');

    const septemberTo = endOfDayInReferenceTimeZone('2026-09-30').getTime();
    expect(createdAt).toBeGreaterThan(septemberTo);

    const octoberFrom = startOfDayInReferenceTimeZone('2026-10-01').getTime();
    expect(createdAt).toBeGreaterThanOrEqual(octoberFrom);
  });

  it('hiver (CET +01:00) : 1er janvier 00:00 a Paris vaut 31 decembre 23:00 UTC', () => {
    expect(startOfDayInReferenceTimeZone('2026-01-01').toISOString()).toBe('2025-12-31T23:00:00.000Z');
  });

  it('refuse une date civile mal formee', () => {
    expect(() => startOfDayInReferenceTimeZone('2026-9-1')).toThrow(TypeError);
    expect(() => endOfDayInReferenceTimeZone('01-09-2026')).toThrow(TypeError);
  });

  // qa-review E10.18a round 1, B1 : une regex de FORME (`/^\d{4}-\d{2}-\d{2}$/`)
  // ne verifie pas le CALENDRIER. Sans le controle aller-retour ajoute a
  // `civilDateToUtc`, `Date.UTC` reportait ces dates EN SILENCE sur le
  // mois/l annee suivants (mesure avant correctif : `created_to=2026-06-31`
  // rendait `2026-07-01T21:59:59.999Z`, `created_from=2026-02-31` rendait
  // `2026-03-02T23:00:00.000Z`, `created_to=2026-00-10` rendait
  // `2025-12-10T22:59:59.999Z` — annee PRECEDENTE, `created_from=2026-99-99`
  // rendait `2034-06-06T22:00:00.000Z`).
  it('refuse un jour inexistant du calendrier — 31 juin (juin n a que 30 jours)', () => {
    expect(() => endOfDayInReferenceTimeZone('2026-06-31')).toThrow(TypeError);
  });

  it('refuse un jour inexistant du calendrier — 31 fevrier (annee non bissextile)', () => {
    expect(() => startOfDayInReferenceTimeZone('2026-02-31')).toThrow(TypeError);
  });

  it('refuse un jour inexistant du calendrier — 30 fevrier (annee bissextile : ne rend pas licite un jour qui n existe dans aucune annee)', () => {
    expect(() => startOfDayInReferenceTimeZone('2026-02-30')).toThrow(TypeError);
  });

  it('refuse un mois inexistant du calendrier — mois 00', () => {
    expect(() => endOfDayInReferenceTimeZone('2026-00-10')).toThrow(TypeError);
  });

  it('refuse un mois et un jour hors de toute plage plausible — 2026-99-99', () => {
    expect(() => startOfDayInReferenceTimeZone('2026-99-99')).toThrow(TypeError);
  });

  it('accepte le 29 fevrier d une annee bissextile reelle (2028)', () => {
    expect(startOfDayInReferenceTimeZone('2028-02-29').toISOString()).toBe('2028-02-28T23:00:00.000Z');
    expect(endOfDayInReferenceTimeZone('2028-02-29').toISOString()).toBe('2028-02-29T22:59:59.999Z');
  });
});

describe('formatCivilDateInReferenceTimeZone — formateur MIS EN CACHE (E10.18d correctif CPU, §8.24 point 4 condition 1)', () => {
  it(
    'construit `Intl.DateTimeFormat("en-CA", ...)` UNE SEULE FOIS, quel que soit le nombre d appels ' +
      '(MESURE : 1 757 ms pour 50 000 lignes si reconstruit a chaque appel, contre 70 ms en cache — ' +
      'sans ce correctif, le plafond tenable serait 2 000 lignes au lieu des 5 000 mesurees tenables, ' +
      '§8.24 point 4 ; le plafond RETENU en production est 2 500 depuis le 2026-09-15, decision Arnaud)',
    async () => {
      // Espion pose AVANT le chargement du module : `CIVIL_DATE_FORMATTER`
      // est une constante de PORTEE MODULE, construite au premier import —
      // `vi.resetModules()` force une evaluation fraiche du module pour que
      // cette toute premiere construction soit elle-meme comptee.
      // `mockImplementation` DELEGUE au vrai constructeur (`new` explicite,
      // objet retourne) : un simple `vi.spyOn(...)` sans implementation ne
      // construit RIEN de reel quand il est appele via `new` (verifie par
      // execution reelle : `formatCivilDateInReferenceTimeZone` levait
      // `TypeError: ... .format is not a function` sans cette ligne).
      const RealDateTimeFormat = globalThis.Intl.DateTimeFormat;
      // Fonction ORDINAIRE, PAS une flèche : `vi.fn()` invoque l implementation
      // via `new` quand l appelant fait `new Intl.DateTimeFormat(...)`, et une
      // fonction flèche n a pas de `[[Construct]]` (`TypeError: ... is not a
      // constructor`, constate par execution reelle sans ce changement).
      const constructorSpy = vi.spyOn(globalThis.Intl, 'DateTimeFormat').mockImplementation(
        function delegateToRealDateTimeFormat(this: unknown, ...args: ConstructorParameters<typeof Intl.DateTimeFormat>) {
          return new RealDateTimeFormat(...args);
        } as unknown as typeof Intl.DateTimeFormat,
      );
      vi.resetModules();
      const { formatCivilDateInReferenceTimeZone } = await import('@/kernel/clock/timezone');

      const isEnCaCall = (call: unknown[]): boolean => call[0] === 'en-CA';
      const enCaCallsAfterImport = constructorSpy.mock.calls.filter(isEnCaCall).length;

      // 25 appels, sur des instants distincts, PAS un seul — c est le nombre
      // d appels qui revelerait une reconstruction a chaque appel.
      for (let index = 0; index < 25; index += 1) {
        formatCivilDateInReferenceTimeZone(`2026-0${(index % 9) + 1}-15T08:00:00+00:00`);
      }

      const enCaCallsAfterLoop = constructorSpy.mock.calls.filter(isEnCaCall).length;

      // EXACTEMENT une construction au chargement du module, ZERO de plus
      // apres 25 appels : la preuve que le formateur est reutilise.
      expect(enCaCallsAfterImport).toBe(1);
      expect(enCaCallsAfterLoop).toBe(enCaCallsAfterImport);

      constructorSpy.mockRestore();
      vi.resetModules();
    },
  );

  it('rend une date civile YYYY-MM-DD correcte APRES la mise en cache (aucun changement de comportement)', async () => {
    vi.resetModules();
    const { formatCivilDateInReferenceTimeZone } = await import('@/kernel/clock/timezone');
    // Meme cas que le test CSV/XLSX partage : 2026-09-01T22:30:00Z (ete,
    // CEST +02:00) -> 2026-09-02 heure de Paris, le jour CIVIL change.
    expect(formatCivilDateInReferenceTimeZone('2026-09-01T22:30:00+00:00')).toBe('2026-09-02');
    expect(formatCivilDateInReferenceTimeZone('2026-03-15T08:00:00+00:00')).toBe('2026-03-15');
    vi.resetModules();
  });
});
