/**
 * Contrat d'API « Parc machine » — regle metier BK-17 et schemas.
 *
 * ─── Pourquoi ces tests existent ────────────────────────────────────────────
 *
 * `parkIsCalculable` decide si un imprimeur peut, ou non, sortir un prix.
 * C est la validation la plus consequente du module — elle bloque la fin du
 * wizard et marque les parcs dans la liste — et elle n etait couverte par
 * RIEN avant le 2026-08-11. Elle est de surcroit maintenant evaluee des DEUX
 * cotes (serveur a la lecture, front sur le parc en cours de constitution) :
 * une divergence entre les deux se traduirait par un ecran qui promet un prix
 * que le moteur refusera de calculer.
 *
 * Les tests de schema, eux, verrouillent ce que le contrat PROMET a l ecrit :
 * `location` nullable, zero admis sur les couts, `calculable` jamais accepte
 * en ecriture.
 */

import { describe, expect, it } from 'vitest';
import {
  MANDATORY_MACHINE_TYPE,
  machineParkInputSchema,
  parkIsCalculable,
  parkMachineInputSchema,
  upsertParkBodySchema,
  type MachineTypeKey,
} from '../../../src/server/park/contract';

const machine = (type: MachineTypeKey, active?: boolean) => ({ type, active });

describe('BK-17 — parkIsCalculable : le massicot conditionne le prix', () => {
  it('refuse un parc vide', () => {
    expect(parkIsCalculable({ machines: [] })).toBe(false);
  });

  it('refuse un parc complet mais sans massicot', () => {
    // Presse, plieuse, decoupe, finition : tout y est SAUF la coupe.
    const park = {
      machines: [
        machine('offset'),
        machine('numerique'),
        machine('pliage'),
        machine('decoupe'),
        machine('finition'),
      ],
    };
    expect(parkIsCalculable(park)).toBe(false);
  });

  it('accepte un parc qui n a QUE un massicot', () => {
    // Volontairement absurde en production, mais c est bien la regle ecrite :
    // seule la coupe est bloquante. Si ce cas passait a false, la regle aurait
    // silencieusement gagne une seconde condition.
    expect(parkIsCalculable({ machines: [machine('massicot')] })).toBe(true);
  });

  it('accepte un parc realiste comportant un massicot', () => {
    const park = {
      machines: [machine('offset'), machine('pliage'), machine('massicot')],
    };
    expect(parkIsCalculable(park)).toBe(true);
  });

  it('BK-27 — un massicot INACTIF ne rend pas le parc calculable', () => {
    // Une machine inactive est exclue des calculs servis. Un parc dont le seul
    // massicot est desactive ne peut donc pas produire de prix — l ignorer
    // ferait promettre un prix que le moteur refusera.
    const park = { machines: [machine('offset'), machine('massicot', false)] };
    expect(parkIsCalculable(park)).toBe(false);
  });

  it('un massicot actif parmi plusieurs massicots inactifs suffit', () => {
    const park = {
      machines: [machine('massicot', false), machine('massicot', false), machine('massicot', true)],
    };
    expect(parkIsCalculable(park)).toBe(true);
  });

  it('`active` absent vaut actif — c est le defaut du contrat', () => {
    // `active` est optionnel : une machine ajoutee par le wizard sans y toucher
    // ne doit pas etre traitee comme desactivee.
    expect(parkIsCalculable({ machines: [{ type: 'massicot' }] })).toBe(true);
  });

  it('`active: null` vaut actif — la base rend null, pas undefined', () => {
    expect(parkIsCalculable({ machines: [{ type: 'massicot', active: null }] })).toBe(true);
  });

  it('la constante et la regle designent le meme type', () => {
    // Garde-fou : si `MANDATORY_MACHINE_TYPE` changeait sans que la regle
    // suive, ce test tomberait au lieu de laisser passer une regle morte.
    expect(parkIsCalculable({ machines: [machine(MANDATORY_MACHINE_TYPE)] })).toBe(true);
  });

  it('l absence de PLIEUSE n est pas bloquante', () => {
    // Distinction voisine, souvent confondue : la plieuse manquante declenche
    // une demande de confirmation, pas un refus — cas legitime de la presse
    // numerique avec groupe de pliage en ligne.
    expect(parkIsCalculable({ machines: [machine('massicot')] })).toBe(true);
  });
});

describe('Schema de machine — ce que le contrat promet', () => {
  const base = { type: 'offset' as const, brand: 'Heidelberg', model: 'SM 52-4', format: '37×52' };

  it('BK-09 — `location` absente est valide et vaut null', () => {
    const parsed = parkMachineInputSchema.parse(base);
    expect(parsed.location).toBeNull();
  });

  it('BK-09 — `location` explicitement null est valide', () => {
    expect(parkMachineInputSchema.parse({ ...base, location: null }).location).toBeNull();
  });

  it('refuse une localisation hors des deux valeurs prevues', () => {
    expect(parkMachineInputSchema.safeParse({ ...base, location: 'ailleurs' }).success).toBe(false);
  });

  it('BK-13 — un cout de transport a ZERO est accepte', () => {
    // Zero est une valeur metier : une machine externalisee sans frais de
    // transport. La rejeter forcerait a mentir ou a laisser vide.
    const parsed = parkMachineInputSchema.parse({ ...base, transportCost: 0, fixedCost: 0 });
    expect(parsed.transportCost).toBe(0);
    expect(parsed.fixedCost).toBe(0);
  });

  it('refuse un cout negatif', () => {
    expect(parkMachineInputSchema.safeParse({ ...base, transportCost: -1 }).success).toBe(false);
  });

  it('`active` vaut true par defaut', () => {
    expect(parkMachineInputSchema.parse(base).active).toBe(true);
  });

  it('`libraryId` absent vaut null — une machine hors referentiel reste valide', () => {
    expect(parkMachineInputSchema.parse(base).libraryId).toBeNull();
  });
});

describe('Schema de parc', () => {
  const park = { name: 'Parc principal', laborRate: 45, energyRate: 0.18 };

  it('accepte un parc sans machine — le wizard enregistre par etapes', () => {
    expect(machineParkInputSchema.parse(park).machines).toEqual([]);
  });

  it('refuse un parc sans nom', () => {
    const result = machineParkInputSchema.safeParse({ ...park, name: '' });
    expect(result.success).toBe(false);
  });

  it('`id` absent = creation, `id` present = remplacement', () => {
    expect(machineParkInputSchema.parse(park).id).toBeUndefined();
    expect(machineParkInputSchema.parse({ ...park, id: 'abc' }).id).toBe('abc');
  });

  it('BK-15 — le parcours et le nombre de clics sont conserves', () => {
    const parsed = machineParkInputSchema.parse({ ...park, wizardVariant: 'B', wizardClicks: 14 });
    expect(parsed.wizardVariant).toBe('B');
    expect(parsed.wizardClicks).toBe(14);
  });

  it('`calculable` envoye par un client est IGNORE, jamais repris', () => {
    // Le verdict est une conclusion du serveur. L accepter en entree
    // reviendrait a laisser un client declarer calculable un parc qui ne
    // l est pas — et donc a court-circuiter BK-17.
    const parsed = machineParkInputSchema.parse({ ...park, calculable: true } as never);
    expect('calculable' in parsed).toBe(false);
  });

  it('refuse un taux horaire negatif', () => {
    expect(machineParkInputSchema.safeParse({ ...park, laborRate: -1 }).success).toBe(false);
  });
});

describe("Enveloppe d'ecriture", () => {
  const park = { name: 'Parc', laborRate: 45, energyRate: 0.18 };

  it('exige un identifiant d espace en UUID', () => {
    expect(upsertParkBodySchema.safeParse({ tenantId: 'pas-un-uuid', park }).success).toBe(false);
  });

  it('accepte une ecriture correctement adressee', () => {
    const body = { tenantId: '00000000-0000-4000-8000-000000000001', park };
    expect(upsertParkBodySchema.safeParse(body).success).toBe(true);
  });

  it('refuse une ecriture sans espace — le tenant ne se devine pas', () => {
    // Un utilisateur peut appartenir a plusieurs espaces : deduire le tenant
    // cote serveur reviendrait a choisir a sa place.
    expect(upsertParkBodySchema.safeParse({ park }).success).toBe(false);
  });
});
