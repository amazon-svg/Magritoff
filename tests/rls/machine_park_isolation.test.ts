/**
 * Parc machine — isolation RLS (migration 20260811000100).
 *
 * ─── Ce que ces tests protegent ─────────────────────────────────────────────
 *
 * Le parc machine d un imprimeur dit tout de son outil de production : ce qu il
 * possede, ce qu il sous-traite et a qui, ses couts horaires. C est parmi les
 * donnees les plus sensibles de la plateforme — un concurrent qui les lit
 * connait sa structure de prix.
 *
 * L architecture met deux barrieres : le navigateur ne parle jamais a ces
 * tables (R1, seule l edge function `park-api` les atteint), et la RLS refuse
 * ce qui n appartient pas a l appelant. Ces tests verifient la SECONDE, celle
 * qui doit tenir meme si la premiere cede.
 *
 * Cas couverts :
 *   1. lecture cross-tenant bloquee
 *   2. ecriture cross-tenant bloquee
 *   3. ecriture dans son propre espace autorisee
 *   4. machines : heritage de l isolation du parc
 *   5. garde-fou d incoherence parc / espace (trigger)
 *   6. referentiel machines : lisible par tous, non modifiable
 *   7. referentiel fournisseurs : commun visible, ajout local isole
 *
 * Lancer : pnpm test (necessite .env.test avec SUPABASE_URL +
 * SUPABASE_ANON_KEY + SUPABASE_SERVICE_ROLE_KEY).
 */

import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { bootstrapHarness, RlsHarness, SKIP_REASON } from './setup';

const describeIfCreds = SKIP_REASON ? describe.skip : describe;

describeIfCreds('RLS Parc machine — isolation par espace', () => {
  let h: RlsHarness;
  const parksToCleanup: string[] = [];
  const suppliersToCleanup: string[] = [];

  beforeAll(async () => {
    h = await bootstrapHarness();
  }, 30_000);

  afterEach(async () => {
    if (parksToCleanup.length > 0) {
      // Les machines partent en cascade (FK on delete cascade).
      await h.admin.from('machine_parks').delete().in('id', parksToCleanup);
      parksToCleanup.length = 0;
    }
    if (suppliersToCleanup.length > 0) {
      await h.admin.from('supplier_directory').delete().in('id', suppliersToCleanup);
      suppliersToCleanup.length = 0;
    }
  });

  /** Cree un parc en service_role (contourne la RLS) pour poser un decor. */
  async function adminCreatePark(tenantId: string, name = 'Parc de test') {
    const { data, error } = await h.admin
      .from('machine_parks')
      .insert({ tenant_id: tenantId, name, labor_rate: 45, energy_rate: 0.18 })
      .select('id')
      .single();
    if (error || !data) throw new Error(`adminCreatePark: ${error?.message}`);
    parksToCleanup.push(data.id);
    return data.id as string;
  }

  async function adminAddMachine(parkId: string, tenantId: string, type = 'massicot') {
    const { data, error } = await h.admin
      .from('machine_park_machines')
      .insert({
        park_id: parkId,
        tenant_id: tenantId,
        type,
        brand: 'Polar',
        model: 'N 115 PLUS',
        format: '115 cm',
      })
      .select('id')
      .single();
    if (error || !data) throw new Error(`adminAddMachine: ${error?.message}`);
    return data.id as string;
  }

  // ───────────────────────────────────────────────────────────────────────
  it("Cas 1 — l'espace A ne lit pas les parcs de l'espace B", async () => {
    await adminCreatePark(h.tenantB.id, 'Parc confidentiel B');

    const { data, error } = await h.anonA
      .from('machine_parks')
      .select('id, tenant_id, name')
      .eq('tenant_id', h.tenantB.id);

    // La RLS filtre : pas d erreur, mais rien a lire.
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("Cas 1-bis — une lecture SANS filtre ne ramene pas non plus les parcs de B", async () => {
    // Le cas precedent filtre explicitement sur B. Celui-ci verifie qu une
    // requete large ne fait pas fuiter par un autre chemin.
    const parkBId = await adminCreatePark(h.tenantB.id, 'Parc large B');

    const { data, error } = await h.anonA.from('machine_parks').select('id');
    expect(error).toBeNull();
    expect((data ?? []).map((r) => r.id)).not.toContain(parkBId);
  });

  // ───────────────────────────────────────────────────────────────────────
  it("Cas 2 — l'espace A ne peut pas creer un parc dans l'espace B", async () => {
    const { error } = await h.anonA
      .from('machine_parks')
      .insert({ tenant_id: h.tenantB.id, name: 'Parc injecte', labor_rate: 45, energy_rate: 0.18 });

    expect(error).not.toBeNull();
  });

  it("Cas 2-bis — l'espace A ne peut pas supprimer un parc de l'espace B", async () => {
    const parkBId = await adminCreatePark(h.tenantB.id);

    await h.anonA.from('machine_parks').delete().eq('id', parkBId);

    // La suppression ne remonte pas d erreur (0 ligne concernee), donc on
    // verifie l EFFET, pas le code retour : le parc doit toujours exister.
    const { data } = await h.admin.from('machine_parks').select('id').eq('id', parkBId);
    expect(data ?? []).toHaveLength(1);
  });

  // ───────────────────────────────────────────────────────────────────────
  it('Cas 3 — un membre cree et relit le parc de son propre espace', async () => {
    const { data, error } = await h.anonA
      .from('machine_parks')
      .insert({ tenant_id: h.tenantA.id, name: 'Mon atelier', labor_rate: 52, energy_rate: 0.2 })
      .select('id, name')
      .single();

    expect(error).toBeNull();
    expect(data?.name).toBe('Mon atelier');
    if (data?.id) parksToCleanup.push(data.id);
  });

  // ───────────────────────────────────────────────────────────────────────
  it("Cas 4 — les machines heritent de l'isolation de leur parc", async () => {
    const parkBId = await adminCreatePark(h.tenantB.id);
    await adminAddMachine(parkBId, h.tenantB.id);

    const { data, error } = await h.anonA
      .from('machine_park_machines')
      .select('id')
      .eq('park_id', parkBId);

    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("Cas 4-bis — l'espace A ne peut pas ajouter une machine a un parc de B", async () => {
    const parkBId = await adminCreatePark(h.tenantB.id);

    const { error } = await h.anonA.from('machine_park_machines').insert({
      park_id: parkBId,
      tenant_id: h.tenantB.id,
      type: 'offset',
      brand: 'Heidelberg',
      model: 'SM 52-4',
      format: '37×52',
    });

    expect(error).not.toBeNull();
  });

  // ───────────────────────────────────────────────────────────────────────
  it("Cas 5 — une machine ne peut pas etre rattachee a un parc d'un autre espace", async () => {
    // La RLS seule ne couvre pas ce cas : un membre des DEUX espaces passerait
    // les deux clauses avec un `tenant_id` incoherent avec `park_id`. C est le
    // trigger `mpm_tenant_guard` qui l interdit, et c est lui qu on teste ici —
    // en service_role, precisement pour prouver qu il tient hors RLS.
    const parkAId = await adminCreatePark(h.tenantA.id);

    const { error } = await h.admin.from('machine_park_machines').insert({
      park_id: parkAId,
      tenant_id: h.tenantB.id, // incoherent avec le parc
      type: 'offset',
      brand: 'Komori',
      model: 'Lithrone',
      format: '52×74',
    });

    expect(error).not.toBeNull();
    expect(error?.message ?? '').toMatch(/[Ii]ncoherence|incohérence/);
  });

  // ───────────────────────────────────────────────────────────────────────
  it('Cas 6 — le referentiel de machines est lisible par tout membre', async () => {
    const { data, error } = await h.anonA
      .from('machine_library')
      .select('id, type, brand')
      .limit(5);

    expect(error).toBeNull();
    expect((data ?? []).length).toBeGreaterThan(0);
  });

  it("Cas 6-bis — un imprimeur ne peut pas modifier le referentiel de machines", async () => {
    // Il est PARTAGE : une ecriture par un tenant s imposerait a tous les
    // autres. Son alimentation releve de l administration de la plateforme.
    const { error } = await h.anonA.from('machine_library').insert({
      id: `test-hack-${Math.random().toString(36).slice(2, 8)}`,
      type: 'offset',
      family: 'Test',
      rank: 1,
      brand: 'Fake',
      model: 'Fake',
    });

    expect(error).not.toBeNull();
  });

  // ───────────────────────────────────────────────────────────────────────
  it('Cas 7 — le referentiel Fournisseur commun est visible de tous', async () => {
    const { data, error } = await h.anonA
      .from('supplier_directory')
      .select('id, kind, name')
      .is('tenant_id', null)
      .limit(5);

    expect(error).toBeNull();
    expect((data ?? []).length).toBeGreaterThan(0);
  });

  it("Cas 7-bis — un fournisseur ajoute par B n'est pas visible de A", async () => {
    const { data: created, error: createError } = await h.admin
      .from('supplier_directory')
      .insert({ kind: 'subcontractor', name: `Sous-traitant prive B ${Date.now()}`, tenant_id: h.tenantB.id })
      .select('id')
      .single();

    expect(createError).toBeNull();
    if (created?.id) suppliersToCleanup.push(created.id);

    const { data } = await h.anonA.from('supplier_directory').select('id').eq('id', created!.id);
    expect(data ?? []).toHaveLength(0);
  });

  it("Cas 7-ter — un imprimeur ne peut pas ajouter au referentiel COMMUN", async () => {
    // `tenant_id: null` = entree commune. La clause `with check` de la policy
    // l interdit : sans elle, n importe quel imprimeur polluerait la liste de
    // tous les autres.
    const { error } = await h.anonA
      .from('supplier_directory')
      .insert({ kind: 'paper', name: `Faux commun ${Date.now()}`, tenant_id: null });

    expect(error).not.toBeNull();
  });
});
