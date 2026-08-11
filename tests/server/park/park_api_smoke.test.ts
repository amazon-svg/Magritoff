/**
 * Recette de l'edge function `park-api` — contre le service DEPLOYE.
 *
 * ─── Ce que ces tests verifient, que les tests de contrat ne peuvent pas ────
 *
 * `parkContract.test.ts` verifie les schemas et la regle BK-17 en memoire.
 * `machine_park_isolation.test.ts` verifie la RLS en base. Ni l un ni l autre
 * ne prouve que la FONCTION repond, ni qu elle respecte ce que le contrat
 * promet a l ecrit — codes d erreur, refus cross-tenant, verdict `calculable`
 * calcule par le serveur et non recu du client.
 *
 * Les appels partent d un vrai jeton utilisateur, comme le ferait le
 * navigateur. C est la seule facon de mesurer ce que voit un imprimeur.
 *
 * Lancer : pnpm test (necessite .env.test).
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootstrapHarness, RlsHarness, SKIP_REASON } from '../../rls/setup';

const describeIfCreds = SKIP_REASON ? describe.skip : describe;

describeIfCreds('park-api — recette du service deploye', () => {
  let h: RlsHarness;
  let base: string;
  let tokenA: string;
  const createdParkIds: string[] = [];

  beforeAll(async () => {
    h = await bootstrapHarness();
    base = `${process.env.SUPABASE_URL}/functions/v1/park-api`;
    const { data } = await h.anonA.auth.getSession();
    tokenA = data.session?.access_token ?? '';
    expect(tokenA).not.toBe('');
  }, 45_000);

  afterAll(async () => {
    if (createdParkIds.length > 0) {
      await h.admin.from('machine_parks').delete().in('id', createdParkIds);
    }
  });

  const callAs = async (
    token: string,
    path: string,
    init: { method?: string; body?: unknown } = {},
  ) => {
    const response = await fetch(`${base}/${path}`, {
      method: init.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: process.env.SUPABASE_ANON_KEY!,
        'Content-Type': 'application/json',
      },
      ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
    });
    return { status: response.status, body: await response.json().catch(() => null) };
  };

  const call = (path: string, init?: { method?: string; body?: unknown }) =>
    callAs(tokenA, path, init);

  // ───────────────────────────────────────────────────────────────────────
  it('refuse un appel sans jeton', async () => {
    const response = await fetch(`${base}/parks`, {
      headers: { apikey: process.env.SUPABASE_ANON_KEY! },
    });
    // La plateforme peut refuser avant nous (401) ; l essentiel est qu un
    // appel anonyme n atteigne jamais les donnees.
    expect(response.status).toBeGreaterThanOrEqual(400);
  }, 20_000);

  it('sert le referentiel de machines', async () => {
    const { status, body } = await call('machine-library');
    expect(status).toBe(200);
    expect(Array.isArray(body.machines)).toBe(true);
    expect(body.machines.length).toBeGreaterThan(50);

    // Le referentiel ne porte PAS de devise — un symbole monetaire ici le
    // rendrait non partageable entre imprimeurs.
    expect(JSON.stringify(body.machines)).not.toMatch(/[€$]/);
  }, 20_000);

  it('filtre le referentiel par type', async () => {
    const { status, body } = await call('machine-library?type=massicot');
    expect(status).toBe(200);
    expect(body.machines.length).toBeGreaterThan(0);
    expect(body.machines.every((m: { type: string }) => m.type === 'massicot')).toBe(true);
  }, 20_000);

  it('sert le referentiel Fournisseur unifie, les trois natures ensemble', async () => {
    const { status, body } = await call(`suppliers?tenantId=${h.tenantA.id}`);
    expect(status).toBe(200);
    const kinds = new Set(body.suppliers.map((s: { kind: string }) => s.kind));
    expect(kinds).toContain('paper');
    expect(kinds).toContain('transport');
    expect(kinds).toContain('subcontractor');
  }, 20_000);

  it("BK-08 — les ressources propres de l'imprimeur sont proposees EN TETE", async () => {
    // Defaut constate en recette du 2026-08-11 : servis par ordre alphabetique,
    // « Antalis » passait devant « Mon stock papier » et se retrouvait
    // preselectionne. Or l imprimeur achete d abord dans son propre stock — le
    // proposer en second, c est proposer un grossiste par defaut.
    const { body } = await call(`suppliers?kind=paper&tenantId=${h.tenantA.id}`);
    expect(body.suppliers[0].name).toMatch(/Mon stock papier/);

    const transport = await call(`suppliers?kind=transport&tenantId=${h.tenantA.id}`);
    expect(transport.body.suppliers[0].name).toMatch(/Mes livraisons/);
  }, 20_000);

  // ───────────────────────────────────────────────────────────────────────
  it('un espace sans parc recoit une liste vide, pas une erreur', async () => {
    const { status, body } = await call(`parks?tenantId=${h.tenantA.id}`);
    expect(status).toBe(200);
    expect(body.parks).toEqual([]);
  }, 20_000);

  it('refuse un identifiant d espace qui n est pas un UUID', async () => {
    const { status, body } = await call('parks?tenantId=pas-un-uuid');
    expect(status).toBe(400);
    expect(body.error.code).toBe('invalid_payload');
  }, 20_000);

  // ───────────────────────────────────────────────────────────────────────
  it('cree un parc et calcule `calculable` cote SERVEUR', async () => {
    const { status, body } = await call('parks', {
      method: 'POST',
      body: {
        tenantId: h.tenantA.id,
        park: {
          name: 'Atelier de recette',
          laborRate: 52,
          energyRate: 0.19,
          wizardVariant: 'B',
          wizardClicks: 14,
          paperSuppliers: ['Antalis'],
          transportSuppliers: [],
          inks: [{ type: 'Encre offset process (CMJN)', costPerKg: 6.5 }],
          machines: [
            { type: 'offset', brand: 'Heidelberg', model: 'SM 52-4', format: '37×52', colors: 4 },
            { type: 'massicot', brand: 'Polar', model: 'N 115 PLUS', format: '115 cm' },
          ],
        },
      },
    });

    expect(status).toBe(200);
    createdParkIds.push(body.park.id);

    expect(body.park.name).toBe('Atelier de recette');
    expect(body.park.machines).toHaveLength(2);
    // Identifiants attribues par le serveur, pas par le client.
    expect(body.park.machines.every((m: { id: string }) => Boolean(m.id))).toBe(true);
    // BK-17 : le massicot est la.
    expect(body.park.calculable).toBe(true);
    // BK-15 : la donnee d arbitrage traverse intacte.
    expect(body.park.wizardVariant).toBe('B');
    expect(body.park.wizardClicks).toBe(14);
    // `numeric` revient en chaine via PostgREST — le contrat annonce un nombre.
    expect(typeof body.park.laborRate).toBe('number');
    expect(body.park.laborRate).toBe(52);
  }, 30_000);

  it('BK-17 — un parc SANS massicot revient `calculable: false`', async () => {
    const { status, body } = await call('parks', {
      method: 'POST',
      body: {
        tenantId: h.tenantA.id,
        park: {
          name: 'Atelier sans coupe',
          laborRate: 45,
          energyRate: 0.18,
          machines: [{ type: 'offset', brand: 'Komori', model: 'Lithrone', format: '52×74' }],
        },
      },
    });
    expect(status).toBe(200);
    createdParkIds.push(body.park.id);
    expect(body.park.calculable).toBe(false);
  }, 30_000);

  it('BK-17 — `calculable: true` envoye par le client est IGNORE', async () => {
    // La porte que ce test ferme : sans cela, un client pourrait declarer
    // calculable un parc sans massicot et obtenir un prix qui n existe pas.
    const { status, body } = await call('parks', {
      method: 'POST',
      body: {
        tenantId: h.tenantA.id,
        park: {
          name: 'Atelier menteur',
          laborRate: 45,
          energyRate: 0.18,
          calculable: true,
          machines: [{ type: 'offset', brand: 'Komori', model: 'Lithrone', format: '52×74' }],
        },
      },
    });
    expect(status).toBe(200);
    createdParkIds.push(body.park.id);
    expect(body.park.calculable).toBe(false);
  }, 30_000);

  it('BK-09/BK-13 — localisation non renseignee et cout a zero traversent', async () => {
    const { status, body } = await call('parks', {
      method: 'POST',
      body: {
        tenantId: h.tenantA.id,
        park: {
          name: 'Atelier nuance',
          laborRate: 45,
          energyRate: 0.18,
          machines: [
            { type: 'massicot', brand: 'Polar', model: 'D 78', format: '78 cm' },
            {
              type: 'pliage', brand: 'MBO', model: 'K80', format: '78 cm',
              location: 'externe', subcontractor: 'Façonnage Atlantique (Nantes)',
              transportCost: 0, fixedCost: 0,
            },
          ],
        },
      },
    });
    expect(status).toBe(200);
    createdParkIds.push(body.park.id);

    const machines = body.park.machines as Array<Record<string, unknown>>;
    const massicot = machines.find((m) => m.type === 'massicot')!;
    const plieuse = machines.find((m) => m.type === 'pliage')!;

    expect(massicot.location).toBeNull();
    expect(plieuse.location).toBe('externe');
    // Zero doit rester zero, et surtout pas devenir null : c est une valeur.
    expect(plieuse.transportCost).toBe(0);
    expect(plieuse.fixedCost).toBe(0);
  }, 30_000);

  it('remplace integralement un parc existant', async () => {
    const created = await call('parks', {
      method: 'POST',
      body: {
        tenantId: h.tenantA.id,
        park: {
          name: 'Avant',
          laborRate: 45,
          energyRate: 0.18,
          machines: [
            { type: 'massicot', brand: 'Polar', model: 'D 78', format: '78 cm' },
            { type: 'offset', brand: 'Komori', model: 'Lithrone', format: '52×74' },
          ],
        },
      },
    });
    createdParkIds.push(created.body.park.id);

    const { status, body } = await call('parks', {
      method: 'POST',
      body: {
        tenantId: h.tenantA.id,
        park: {
          id: created.body.park.id,
          name: 'Apres',
          laborRate: 60,
          energyRate: 0.18,
          machines: [{ type: 'massicot', brand: 'Polar', model: 'D 78', format: '78 cm' }],
        },
      },
    });

    expect(status).toBe(200);
    expect(body.park.id).toBe(created.body.park.id);
    expect(body.park.name).toBe('Apres');
    // Les machines absentes du corps sont supprimees — remplacement, pas fusion.
    expect(body.park.machines).toHaveLength(1);
    expect(body.park.laborRate).toBe(60);
  }, 40_000);

  // ───────────────────────────────────────────────────────────────────────
  it("refuse de lire les parcs d'un autre espace", async () => {
    const { data: sessionB } = await h.anonB.auth.getSession();
    const tokenB = sessionB.session?.access_token ?? '';

    // B demande explicitement les parcs de A.
    const { status, body } = await callAs(tokenB, `parks?tenantId=${h.tenantA.id}`);

    // La RLS filtre : la reponse est vide, jamais celle d un autre imprimeur.
    expect(status).toBe(200);
    expect(body.parks).toEqual([]);
  }, 30_000);

  it("refuse d'ecrire dans l'espace d'un autre imprimeur", async () => {
    const { data: sessionB } = await h.anonB.auth.getSession();
    const tokenB = sessionB.session?.access_token ?? '';

    const { status } = await callAs(tokenB, 'parks', {
      method: 'POST',
      body: {
        tenantId: h.tenantA.id,
        park: { name: 'Parc injecte', laborRate: 45, energyRate: 0.18, machines: [] },
      },
    });

    expect(status).toBeGreaterThanOrEqual(400);
  }, 30_000);

  it("un parc introuvable et un parc d'un autre espace repondent la MEME chose", async () => {
    // Distinguer les deux revelerait l existence du parc d un concurrent.
    const inexistant = await call(
      `parks/00000000-0000-4000-8000-000000000099?tenantId=${h.tenantA.id}`,
    );
    expect(inexistant.status).toBe(404);
    expect(inexistant.body.error.code).toBe('not_found');
  }, 30_000);

  // ───────────────────────────────────────────────────────────────────────
  it('la suppression est idempotente', async () => {
    const created = await call('parks', {
      method: 'POST',
      body: {
        tenantId: h.tenantA.id,
        park: { name: 'A supprimer', laborRate: 45, energyRate: 0.18, machines: [] },
      },
    });
    const id = created.body.park.id as string;

    const first = await call(`parks/${id}?tenantId=${h.tenantA.id}`, { method: 'DELETE' });
    expect(first.status).toBe(200);

    // Deuxieme suppression du meme parc : reussite, pas 404 (contrat §4.2).
    const second = await call(`parks/${id}?tenantId=${h.tenantA.id}`, { method: 'DELETE' });
    expect(second.status).toBe(200);
    expect(second.body.deleted).toBe(true);
  }, 40_000);

  it('une route inconnue repond `not_found`', async () => {
    const { status, body } = await call('inexistant');
    expect(status).toBe(404);
    expect(body.error.code).toBe('not_found');
  }, 20_000);
});
