/**
 * Edge function `park-api` — domaine « Parc machine ».
 *
 * Implemente le contrat documente dans `docs/API_PARC_MACHINE.md` (v1.0).
 * C est la couche serveur exigee par R1 : le navigateur ne touche jamais aux
 * tables `machine_parks`, `machine_park_machines`, `machine_library` ni
 * `supplier_directory`.
 *
 * ─── Modele d autorisation, et pourquoi celui-la ────────────────────────────
 *
 * Cette fonction n utilise PAS la cle de service. Elle cree un client Supabase
 * porteur du JWT DE L APPELANT, si bien que les politiques RLS s appliquent a
 * chacune de ses requetes. Consequence recherchee : meme un defaut de logique
 * ici ne peut pas faire fuiter le parc d un imprimeur vers un autre — c est la
 * base qui refuse, pas le code de cette fonction.
 *
 * Le prix a payer est assume : l API ne peut rien faire que l utilisateur ne
 * puisse faire. Aucun besoin d elevation n existe dans ce domaine.
 *
 * ─── Le schema est la source de verite ──────────────────────────────────────
 *
 * Les schemas viennent de `src/server/park/contract.ts`, LE MEME fichier que
 * celui importe par le front. Il n y a donc pas deux definitions du parc a
 * tenir d accord, et la regle BK-17 (`parkIsCalculable`) n a qu une seule
 * implementation. `zod` se resout via `supabase/functions/import_map.json`.
 */

import { createClient, SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import {
  HTTP_STATUS_BY_ERROR_CODE,
  listMachineLibraryQuerySchema,
  listParksQuerySchema,
  listSuppliersQuerySchema,
  machineParkInputSchema,
  parkIsCalculable,
  replaceParksBodySchema,
  upsertParkBodySchema,
  type LibraryMachine,
  type MachinePark,
  type MachineParkInput,
  type ParkErrorCode,
  type SupplierRef,
} from '../../../src/server/park/contract.ts';

const JSON_HEADERS = { ...corsHeaders, 'Content-Type': 'application/json' };

function ok(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function fail(code: ParkErrorCode, message: string): Response {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status: HTTP_STATUS_BY_ERROR_CODE[code],
    headers: JSON_HEADERS,
  });
}

/** Premier message d erreur Zod, en clair — le contrat promet un message affichable. */
function firstIssue(error: { issues: Array<{ path: PropertyKey[]; message: string }> }): string {
  const issue = error.issues[0];
  if (!issue) return 'Données invalides.';
  const where = issue.path.length ? `« ${issue.path.join('.')} » : ` : '';
  return `${where}${issue.message}`;
}

// ─── Traduction base <-> contrat ─────────────────────────────────────────────
// Les colonnes sont en snake_case, le contrat en camelCase. La conversion est
// explicite et localisee ici : c est le seul endroit ou les deux vocabulaires
// se rencontrent.

interface ParkRow {
  id: string;
  name: string;
  paper_suppliers: string[] | null;
  transport_suppliers: string[] | null;
  inks: unknown;
  labor_rate: number | string;
  energy_rate: number | string;
  wizard_variant: string | null;
  wizard_clicks: number | null;
  completed_at: string | null;
}

interface MachineRow {
  id: string;
  park_id: string;
  library_id: string | null;
  type: string;
  brand: string;
  model: string;
  format: string;
  colors: number | null;
  varnish: boolean;
  location: string | null;
  subcontractor: string | null;
  transport_cost: number | string | null;
  fixed_cost: number | string | null;
  hourly_rate: number | string | null;
  active: boolean;
  params: Record<string, number> | null;
  position: number;
}

/**
 * `numeric` de PostgreSQL revient en CHAINE via PostgREST — c est voulu cote
 * base (aucune perte de precision), mais le contrat annonce des nombres.
 * La conversion doit donc etre faite ici, et pas laissee au front : sinon
 * `laborRate` vaudrait "45" et toute arithmetique le concatenerait.
 */
function num(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function toMachine(row: MachineRow) {
  return {
    id: row.id,
    libraryId: row.library_id,
    type: row.type as never,
    brand: row.brand,
    model: row.model,
    format: row.format,
    colors: row.colors,
    varnish: row.varnish,
    location: row.location as never,
    subcontractor: row.subcontractor,
    transportCost: num(row.transport_cost),
    fixedCost: num(row.fixed_cost),
    hourlyRate: num(row.hourly_rate),
    active: row.active,
    params: row.params,
  };
}

function toPark(row: ParkRow, machineRows: MachineRow[]): MachinePark {
  const machines = machineRows
    .filter((m) => m.park_id === row.id)
    .sort((a, b) => a.position - b.position)
    .map(toMachine);

  return {
    id: row.id,
    name: row.name,
    machines,
    paperSuppliers: row.paper_suppliers ?? [],
    transportSuppliers: row.transport_suppliers ?? [],
    inks: Array.isArray(row.inks) ? (row.inks as MachinePark['inks']) : [],
    laborRate: num(row.labor_rate) ?? 0,
    energyRate: num(row.energy_rate) ?? 0,
    wizardVariant: (row.wizard_variant as 'A' | 'B' | null) ?? null,
    wizardClicks: row.wizard_clicks,
    completedAt: row.completed_at,
    // Conclusion calculee ICI, jamais recue du client (cf. contrat §2.4).
    calculable: parkIsCalculable({ machines }),
  };
}

const PARK_COLUMNS =
  'id, name, paper_suppliers, transport_suppliers, inks, labor_rate, energy_rate, wizard_variant, wizard_clicks, completed_at';
const MACHINE_COLUMNS =
  'id, park_id, library_id, type, brand, model, format, colors, varnish, location, subcontractor, transport_cost, fixed_cost, hourly_rate, active, params, position';

// ─── Lectures ────────────────────────────────────────────────────────────────

async function readParks(
  db: SupabaseClient,
  tenantId: string,
  parkId?: string,
): Promise<{ parks: MachinePark[] } | Response> {
  let parkQuery = db
    .from('machine_parks')
    .select(PARK_COLUMNS)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true });

  if (parkId) parkQuery = parkQuery.eq('id', parkId);

  const { data: parkRows, error: parkError } = await parkQuery;
  if (parkError) {
    console.error('[park-api] lecture des parcs', parkError.message);
    return fail('internal', 'Impossible de lire les parcs machine.');
  }

  const rows = (parkRows ?? []) as ParkRow[];
  if (rows.length === 0) return { parks: [] };

  const { data: machineRows, error: machineError } = await db
    .from('machine_park_machines')
    .select(MACHINE_COLUMNS)
    .in('park_id', rows.map((p) => p.id));

  if (machineError) {
    console.error('[park-api] lecture des machines', machineError.message);
    return fail('internal', 'Impossible de lire les machines des parcs.');
  }

  return { parks: rows.map((r) => toPark(r, (machineRows ?? []) as MachineRow[])) };
}

// ─── Ecritures ───────────────────────────────────────────────────────────────

/**
 * Cree ou remplace INTEGRALEMENT un parc.
 *
 * Le remplacement des machines se fait par suppression puis reinsertion, et
 * non par rapprochement ligne a ligne. Motif : le contrat annonce un
 * remplacement complet (§4.2), et les identifiants de machine n ont aucune
 * signification metier — rien ne s y accroche, aucun historique n en depend.
 * Un rapprochement couterait de la complexite pour conserver des uuid que
 * personne ne regarde.
 *
 * ⚠️ LIMITE ASSUMEE, a lever si le domaine grandit : PostgREST n ouvre pas de
 * transaction sur plusieurs requetes. Entre le `delete` et l `insert` des
 * machines, il existe une fenetre ou le parc est vu sans ses machines. Sur un
 * ecran de parametrage utilise par une poignee de personnes, la consequence
 * est nulle. Si un jour un calcul de prix lit ces tables en continu, il faudra
 * une fonction SQL transactionnelle — le contrat, lui, ne changera pas.
 */
async function upsertPark(
  db: SupabaseClient,
  tenantId: string,
  input: MachineParkInput,
  userId: string | null,
): Promise<Response> {
  const parkPayload = {
    tenant_id: tenantId,
    name: input.name,
    paper_suppliers: input.paperSuppliers,
    transport_suppliers: input.transportSuppliers,
    inks: input.inks,
    labor_rate: input.laborRate,
    energy_rate: input.energyRate,
    wizard_variant: input.wizardVariant ?? null,
    wizard_clicks: input.wizardClicks ?? null,
    completed_at: input.completedAt ?? null,
  };

  let parkId = input.id ?? null;

  if (parkId) {
    // `eq('tenant_id')` en plus de l id : la RLS le garantit deja, mais un
    // filtre explicite evite de dependre d elle pour la justesse du resultat.
    const { data, error } = await db
      .from('machine_parks')
      .update(parkPayload)
      .eq('id', parkId)
      .eq('tenant_id', tenantId)
      .select('id')
      .maybeSingle();

    if (error) {
      console.error('[park-api] mise a jour du parc', error.message);
      return fail('internal', 'Impossible d enregistrer le parc.');
    }
    // Ni trouve, ni autorise : la meme reponse dans les deux cas, distinguer
    // reviendrait a reveler l existence du parc d un autre imprimeur.
    if (!data) return fail('not_found', 'Ce parc machine est introuvable.');
  } else {
    const { data, error } = await db
      .from('machine_parks')
      .insert({ ...parkPayload, created_by: userId })
      .select('id')
      .single();

    if (error) {
      console.error('[park-api] creation du parc', error.message);
      return fail('internal', 'Impossible de créer le parc.');
    }
    parkId = data.id as string;
  }

  const { error: deleteError } = await db
    .from('machine_park_machines')
    .delete()
    .eq('park_id', parkId)
    .eq('tenant_id', tenantId);

  if (deleteError) {
    console.error('[park-api] purge des machines', deleteError.message);
    return fail('internal', 'Impossible de mettre à jour les machines du parc.');
  }

  if (input.machines.length > 0) {
    const machinePayload = input.machines.map((m, index) => ({
      park_id: parkId,
      tenant_id: tenantId,
      library_id: m.libraryId ?? null,
      type: m.type,
      brand: m.brand,
      model: m.model,
      format: m.format,
      colors: m.colors ?? null,
      varnish: m.varnish ?? false,
      location: m.location ?? null,
      subcontractor: m.subcontractor ?? null,
      transport_cost: m.transportCost ?? null,
      fixed_cost: m.fixedCost ?? null,
      hourly_rate: m.hourlyRate ?? null,
      active: m.active ?? true,
      params: m.params ?? null,
      position: index,
    }));

    const { error: insertError } = await db
      .from('machine_park_machines')
      .insert(machinePayload);

    if (insertError) {
      console.error('[park-api] insertion des machines', insertError.message);
      return fail('internal', 'Impossible d enregistrer les machines du parc.');
    }
  }

  const result = await readParks(db, tenantId, parkId!);
  if (result instanceof Response) return result;
  const park = result.parks[0];
  if (!park) return fail('internal', 'Le parc a été enregistré mais reste illisible.');
  return ok({ park });
}

// ─── Routage ─────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authorization = req.headers.get('Authorization') ?? '';
  if (!authorization.toLowerCase().startsWith('bearer ')) {
    return fail('unauthenticated', 'Authentification requise.');
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) {
    console.error('[park-api] configuration absente : SUPABASE_URL / SUPABASE_ANON_KEY');
    return fail('internal', 'Service indisponible.');
  }

  // Le jeton de l appelant est repasse tel quel : la RLS s applique.
  const db = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });

  const { data: userData } = await db.auth.getUser();
  if (!userData?.user) return fail('unauthenticated', 'Session expirée, reconnectez-vous.');
  const userId = userData.user.id;

  const url = new URL(req.url);
  // Le chemin recu est `/park-api/<reste>` : on retire le nom de la fonction.
  const segments = url.pathname.split('/').filter(Boolean);
  const fnIndex = segments.indexOf('park-api');
  const route = fnIndex >= 0 ? segments.slice(fnIndex + 1) : segments;
  const [resource, resourceId] = route;

  try {
    // ── Referentiel de machines ────────────────────────────────────────────
    if (resource === 'machine-library') {
      if (req.method !== 'GET') return fail('method_not_allowed', 'Méthode non autorisée.');

      const parsed = listMachineLibraryQuerySchema.safeParse({
        type: url.searchParams.get('type') ?? undefined,
      });
      if (!parsed.success) return fail('invalid_payload', firstIssue(parsed.error));

      let query = db
        .from('machine_library')
        .select('id, type, family, rank, brand, model, format, colors, varnish, price_defaults')
        .eq('active', true)
        .order('type')
        .order('family')
        .order('rank');

      if (parsed.data.type) query = query.eq('type', parsed.data.type);

      const { data, error } = await query;
      if (error) {
        console.error('[park-api] lecture du referentiel machines', error.message);
        return fail('internal', 'Impossible de lire la bibliothèque de machines.');
      }

      const machines: LibraryMachine[] = (data ?? []).map((row: Record<string, unknown>) => ({
        id: row.id as string,
        type: row.type as LibraryMachine['type'],
        family: row.family as string,
        rank: row.rank as number,
        brand: row.brand as string,
        model: row.model as string,
        format: row.format as string,
        colors: (row.colors as number | null) ?? undefined,
        varnish: (row.varnish as boolean) || undefined,
        priceDefaults: (row.price_defaults as Record<string, number> | null) ?? undefined,
      }));

      return ok({ machines });
    }

    // ── Referentiel Fournisseur unifie (BK-07) ─────────────────────────────
    if (resource === 'suppliers') {
      if (req.method !== 'GET') return fail('method_not_allowed', 'Méthode non autorisée.');

      const parsed = listSuppliersQuerySchema.safeParse({
        kind: url.searchParams.get('kind') ?? undefined,
        tenantId: url.searchParams.get('tenantId') ?? undefined,
      });
      if (!parsed.success) return fail('invalid_payload', firstIssue(parsed.error));

      let query = db
        .from('supplier_directory')
        .select('id, kind, name, tenant_id')
        .order('name');

      if (parsed.data.kind) query = query.eq('kind', parsed.data.kind);
      // Le referentiel commun, plus eventuellement les ajouts de cet imprimeur.
      // La RLS filtre deja, ce `or` evite de ramener les entrees d autres
      // espaces auxquels l appelant aurait acces par ailleurs.
      if (parsed.data.tenantId) {
        query = query.or(`tenant_id.is.null,tenant_id.eq.${parsed.data.tenantId}`);
      } else {
        query = query.is('tenant_id', null);
      }

      const { data, error } = await query;
      if (error) {
        console.error('[park-api] lecture du referentiel fournisseurs', error.message);
        return fail('internal', 'Impossible de lire les fournisseurs.');
      }

      const suppliers: SupplierRef[] = (data ?? []).map((row: Record<string, unknown>) => ({
        id: row.id as string,
        kind: row.kind as SupplierRef['kind'],
        name: row.name as string,
        scope: row.tenant_id ? 'tenant' : 'shared',
      }));

      return ok({ suppliers });
    }

    // ── Parcs ──────────────────────────────────────────────────────────────
    if (resource === 'parks') {
      if (req.method === 'GET') {
        const parsed = listParksQuerySchema.safeParse({
          tenantId: url.searchParams.get('tenantId') ?? undefined,
        });
        if (!parsed.success) return fail('invalid_payload', firstIssue(parsed.error));

        const result = await readParks(db, parsed.data.tenantId, resourceId);
        if (result instanceof Response) return result;

        if (resourceId) {
          const park = result.parks[0];
          if (!park) return fail('not_found', 'Ce parc machine est introuvable.');
          return ok({ park });
        }
        return ok({ parks: result.parks });
      }

      if (req.method === 'POST') {
        const parsed = upsertParkBodySchema.safeParse(await req.json().catch(() => null));
        if (!parsed.success) return fail('invalid_payload', firstIssue(parsed.error));
        return await upsertPark(db, parsed.data.tenantId, parsed.data.park, userId);
      }

      if (req.method === 'PUT') {
        const parsed = replaceParksBodySchema.safeParse(await req.json().catch(() => null));
        if (!parsed.success) return fail('invalid_payload', firstIssue(parsed.error));

        const { tenantId, parks } = parsed.data;

        // Suppression des parcs absents de la collection envoyee. `cascade`
        // emporte leurs machines.
        const keptIds = parks.map((p) => p.id).filter((id): id is string => Boolean(id));
        let purge = db.from('machine_parks').delete().eq('tenant_id', tenantId);
        if (keptIds.length > 0) purge = purge.not('id', 'in', `(${keptIds.join(',')})`);

        const { error: purgeError } = await purge;
        if (purgeError) {
          console.error('[park-api] purge de la collection', purgeError.message);
          return fail('internal', 'Impossible de remplacer la collection de parcs.');
        }

        for (const park of parks) {
          const response = await upsertPark(db, tenantId, park, userId);
          if (!response.ok) return response;
        }

        const result = await readParks(db, tenantId);
        if (result instanceof Response) return result;
        return ok({ parks: result.parks });
      }

      if (req.method === 'DELETE') {
        const parsed = listParksQuerySchema.safeParse({
          tenantId: url.searchParams.get('tenantId') ?? undefined,
        });
        if (!parsed.success) return fail('invalid_payload', firstIssue(parsed.error));
        if (!resourceId) return fail('invalid_payload', 'Identifiant de parc manquant.');

        const { error } = await db
          .from('machine_parks')
          .delete()
          .eq('id', resourceId)
          .eq('tenant_id', parsed.data.tenantId);

        if (error) {
          console.error('[park-api] suppression du parc', error.message);
          return fail('internal', 'Impossible de supprimer le parc.');
        }
        // Idempotent par contrat : supprimer un parc deja supprime reussit.
        return ok({ deleted: true });
      }

      return fail('method_not_allowed', 'Méthode non autorisée.');
    }

    return fail('not_found', 'Route inconnue.');
  } catch (e) {
    console.error('[park-api] erreur non rattrapee', e);
    return fail('internal', 'Une erreur inattendue est survenue.');
  }
});

// Validation de forme : le schema du parc est bien celui du contrat partage.
// (Reference conservee pour que l import ne soit pas elague par le bundler.)
void machineParkInputSchema;
