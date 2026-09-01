/**
 * Regle de selection de l espace de travail (E10.0 §3.4, ratifiee).
 *
 * `SupabaseApiPrincipalVerifier` est la barriere qui decide DE QUEL ESPACE on
 * lit. Tous les autres tests de la facade bouchonnent le `PrincipalVerifier` :
 * la regle elle-meme n etait verifiee nulle part. « Correct a la lecture »
 * n est pas « teste », et c est precisement la regle que le montage devait
 * rendre applicable.
 *
 * Le client Supabase est bouchonne sur ses deux seuls points de contact :
 * `auth.getUser()` (identite) et `rpc('current_user_tenant_ids')` (espaces
 * accessibles, la MEME fonction que celle des policies RLS).
 */
import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  SupabaseApiPrincipalVerifier,
  type ServiceKeyRegistration,
} from '@/adapters/supabase/api-principal-verifier';
import { ProblemError } from '@/modules/_shared/application';
import type { ApiPrincipal } from '@/modules/_shared/application';
import type { Database } from '@/types/database.types';

const USER = 'a1b2c3d4-e5f6-4708-8910-1a2b3c4d5e6f';
const TENANT_A = '7f0d2a1e-1c4b-4f8a-9c3d-5b6e7a8f9012';
const TENANT_B = 'b1c2d3e4-5f60-4a7b-8c9d-0e1f2a3b4c5d';
/** Espace qui n existe nulle part, pour la comparaison de fuite d information. */
const TENANT_INEXISTANT = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

type ClientStub = Readonly<{
  user?: string | null;
  tenants?: readonly string[];
  rpcError?: { message: string } | null;
  /** E10.5 CA4 — reponse de `current_user_is_shop_customer()`. */
  isShopCustomer?: boolean;
}>;

function supabaseStub(options: ClientStub = {}) {
  const rpc = vi.fn(async (fn: string) => {
    if (fn === 'current_user_is_shop_customer') {
      return { data: options.isShopCustomer ?? false, error: null };
    }
    return {
      data: options.rpcError ? null : [...(options.tenants ?? [])],
      error: options.rpcError ?? null,
    };
  });
  const getUser = vi.fn(async () =>
    options.user === null || options.user === undefined
      ? { data: { user: null }, error: { message: 'jwt invalide' } }
      : { data: { user: { id: options.user } }, error: null },
  );
  const client = { auth: { getUser }, rpc } as unknown as SupabaseClient<Database>;
  return { client, rpc, getUser };
}

function verifier(
  options: ClientStub & {
    requestedTenantId?: string | null;
    serviceKeys?: ReadonlyMap<string, ServiceKeyRegistration>;
  } = {},
) {
  const { client, rpc, getUser } = supabaseStub(options);
  const instance = new SupabaseApiPrincipalVerifier(client, {
    requestedTenantId: options.requestedTenantId ?? null,
    ...(options.serviceKeys === undefined ? {} : { serviceKeys: options.serviceKeys }),
  });
  return { instance, rpc, getUser };
}

const bearer = { kind: 'bearer' as const, token: 'jeton' };

/** Rend le Problem tel qu il partirait sur le reseau, pour comparaison exacte. */
async function problemOf(action: Promise<unknown>): Promise<string> {
  try {
    await action;
  } catch (error) {
    expect(error).toBeInstanceOf(ProblemError);
    return JSON.stringify((error as ProblemError).toProblem('req-test'));
  }
  throw new Error('aucun Problem leve alors qu un refus etait attendu');
}

describe('selection de l espace : les cinq cas de la regle ratifiee', () => {
  it('en-tete absent et un seul espace accessible : cet espace', async () => {
    const { instance } = verifier({ user: USER, tenants: [TENANT_A] });

    const principal = (await instance.verify(bearer)) as ApiPrincipal;

    expect(principal).toMatchObject({ kind: 'user', userId: USER, tenantId: TENANT_A });
  });

  it('en-tete absent et plusieurs espaces : 400, et surtout AUCUN espace devine', async () => {
    const { instance } = verifier({ user: USER, tenants: [TENANT_A, TENANT_B] });

    const rendered = JSON.parse(await problemOf(instance.verify(bearer)));

    expect(rendered).toMatchObject({
      status: 400,
      code: 'identity.tenant_selection_required',
    });
    // Le point essentiel : ne pas retomber sur le premier espace de la liste.
    // Deviner montrerait le referentiel d un autre espace que celui consulte.
    expect(rendered.detail).toContain('2 espaces');
    expect(JSON.stringify(rendered)).not.toContain(TENANT_A);
  });

  it('en-tete absent et aucun espace accessible : 403', async () => {
    const { instance } = verifier({ user: USER, tenants: [] });

    expect(JSON.parse(await problemOf(instance.verify(bearer)))).toMatchObject({
      status: 403,
      code: 'identity.tenant_not_resolved',
    });
  });

  it('en-tete present et accessible : CET espace, pas le premier de la liste', async () => {
    const { instance } = verifier({
      user: USER,
      tenants: [TENANT_A, TENANT_B],
      requestedTenantId: TENANT_B,
    });

    const principal = (await instance.verify(bearer)) as ApiPrincipal;

    expect(principal.tenantId).toBe(TENANT_B);
  });

  it('en-tete present et inaccessible : 403', async () => {
    const { instance } = verifier({
      user: USER,
      tenants: [TENANT_A],
      requestedTenantId: TENANT_B,
    });

    expect(JSON.parse(await problemOf(instance.verify(bearer)))).toMatchObject({
      status: 403,
      code: 'identity.tenant_not_resolved',
    });
  });
});

describe('absence de fuite sur l existence d un espace', () => {
  it('refuse un espace existant mais inaccessible exactement comme un espace inexistant', async () => {
    const inaccessible = verifier({
      user: USER,
      tenants: [TENANT_A],
      requestedTenantId: TENANT_B,
    });
    const inexistant = verifier({
      user: USER,
      tenants: [TENANT_A],
      requestedTenantId: TENANT_INEXISTANT,
    });

    const refusInaccessible = await problemOf(inaccessible.instance.verify(bearer));
    const refusInexistant = await problemOf(inexistant.instance.verify(bearer));

    // Octet pour octet : statut, code, titre et detail. Une difference,
    // meme de formulation, renseignerait un appelant sur l existence
    // d espaces qui ne le regardent pas.
    expect(refusInaccessible).toBe(refusInexistant);
  });

  it('ne cite jamais l espace demande dans le refus', async () => {
    const { instance } = verifier({
      user: USER,
      tenants: [TENANT_A],
      requestedTenantId: TENANT_B,
    });

    const rendered = await problemOf(instance.verify(bearer));

    expect(rendered).not.toContain(TENANT_B);
    expect(rendered).not.toContain(TENANT_A);
  });
});

describe('identite et disponibilite', () => {
  it('rend null sur un jeton refuse, sans lever : la facade repondra 401', async () => {
    const { instance, rpc } = verifier({ user: null });

    await expect(instance.verify(bearer)).resolves.toBeNull();
    // Inutile d interroger les espaces d une identite non etablie.
    expect(rpc).not.toHaveBeenCalled();
  });

  it('leve 503 quand la liste des espaces est illisible, sans se rabattre sur un espace', async () => {
    const { instance } = verifier({ user: USER, rpcError: { message: 'connexion perdue' } });

    expect(JSON.parse(await problemOf(instance.verify(bearer)))).toMatchObject({
      status: 503,
      code: 'identity.tenant_not_resolved',
    });
  });

  it('resout les espaces par la meme fonction que les policies RLS', async () => {
    const { instance, rpc } = verifier({ user: USER, tenants: [TENANT_A] });

    await instance.verify(bearer);

    // Si la facade et la base divergeaient sur ce qui est accessible, la
    // premiere autoriserait ce que la seconde refuse — ou l inverse.
    expect(rpc).toHaveBeenCalledWith('current_user_tenant_ids');
  });

  it('CA4 (E10.5) — un compte client boutique recoit 403 auth.scope_forbidden, jamais une selection d espace', async () => {
    const { instance, rpc } = verifier({ user: USER, isShopCustomer: true });

    expect(JSON.parse(await problemOf(instance.verify(bearer)))).toMatchObject({
      status: 403,
      code: 'auth.scope_forbidden',
    });
    // Le refus est pose AVANT toute lecture des espaces accessibles : un
    // compte client boutique n a pas a interroger current_user_tenant_ids().
    expect(rpc).not.toHaveBeenCalledWith('current_user_tenant_ids');
  });

  it('CA4 (E10.5) — un utilisateur Magrit ordinaire (pas un compte client boutique) n est pas affecte', async () => {
    const { instance } = verifier({ user: USER, tenants: [TENANT_A], isShopCustomer: false });

    const principal = (await instance.verify(bearer)) as ApiPrincipal;

    expect(principal).toMatchObject({ kind: 'user', userId: USER, tenantId: TENANT_A });
  });

  it('ignore un en-tete vide ou fait d espaces comme s il etait absent', async () => {
    for (const requestedTenantId of ['', '   ']) {
      const { instance } = verifier({ user: USER, tenants: [TENANT_A], requestedTenantId });
      const principal = (await instance.verify(bearer)) as ApiPrincipal;
      expect(principal.tenantId).toBe(TENANT_A);
    }
  });
});

describe('cle de service', () => {
  const registration: ServiceKeyRegistration = {
    serviceId: 'studio',
    tenantId: TENANT_A,
    scopes: ['customers:read'],
  };
  const keys = new Map([['cle-studio', registration]]);

  it('porte son propre espace et ses scopes, sans interroger les memberships', async () => {
    const { instance, rpc, getUser } = verifier({ serviceKeys: keys });

    const principal = (await instance.verify({
      kind: 'service_key',
      key: 'cle-studio',
    })) as ApiPrincipal;

    expect(principal).toMatchObject({
      kind: 'service',
      serviceId: 'studio',
      tenantId: TENANT_A,
      scopes: ['customers:read'],
    });
    expect(rpc).not.toHaveBeenCalled();
    expect(getUser).not.toHaveBeenCalled();
  });

  it('ignore l en-tete de selection : une cle est emise POUR un espace', async () => {
    const { instance } = verifier({ serviceKeys: keys, requestedTenantId: TENANT_B });

    const principal = (await instance.verify({
      kind: 'service_key',
      key: 'cle-studio',
    })) as ApiPrincipal;

    expect(principal.tenantId).toBe(TENANT_A);
  });

  it('rend null sur une cle inconnue', async () => {
    const { instance } = verifier({ serviceKeys: keys });

    await expect(
      instance.verify({ kind: 'service_key', key: 'cle-inventee' }),
    ).resolves.toBeNull();
  });

  it('rend null quand aucune cle n est emise : la facade reste fermee aux tiers', async () => {
    const { instance } = verifier({});

    await expect(
      instance.verify({ kind: 'service_key', key: 'cle-studio' }),
    ).resolves.toBeNull();
  });
});
