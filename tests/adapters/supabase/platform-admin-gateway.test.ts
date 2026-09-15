/**
 * qa-review (BCP-0c, rejet du merge de `266f304e`) — `SupabasePlatformAdminGateway`
 * decidait REELLEMENT l acces aux deux routes de diagnostic (docs/api/CONVENTIONS.md
 * §8.25, point 2.3ter), et n etait couvert par aucun test. Ce fichier verifie :
 *   - le RPC appele est EXACTEMENT `is_super_admin`, sans aucun argument
 *     (mutation M3d : renommer le RPC ou lui passer un parametre) ;
 *   - `data: true` -> `true` ;
 *   - `data: false` -> `false` (mutation M3b : `return true` inconditionnel) ;
 *   - `data: null` -> `false` (mutation M3c : `return data !== false`, qui
 *     laisserait passer `null`) ;
 *   - une `error` LEVE une exception, jamais `true` (mutation M3a :
 *     `if (error) return true`).
 */
import { describe, expect, it, vi } from 'vitest';
import { SupabasePlatformAdminGateway } from '@/adapters/supabase/platform-admin-gateway';
import { parseId, type UserId } from '@/kernel/ids';

function actorId(raw: string): UserId {
  const parsed = parseId<'UserId'>(raw);
  if (!parsed.ok) throw new Error('acteur invalide');
  return parsed.value;
}

const ACTOR = actorId('11111111-1111-4111-8111-111111111111');

function fakeClient(result: { data: unknown; error: { message: string } | null }) {
  const rpc = vi.fn(async (..._args: unknown[]) => result);
  return { client: { rpc } as any, rpc };
}

describe('SupabasePlatformAdminGateway', () => {
  it('appelle EXACTEMENT is_super_admin, sans aucun argument (M3d)', async () => {
    const { client, rpc } = fakeClient({ data: true, error: null });
    await new SupabasePlatformAdminGateway(client).isPlatformAdmin(ACTOR);

    expect(rpc).toHaveBeenCalledTimes(1);
    // `toHaveBeenCalledWith('is_super_admin')` echoue si un second argument
    // (params) est passe, ou si le nom du RPC change.
    expect(rpc).toHaveBeenCalledWith('is_super_admin');
  });

  it('data: true -> true', async () => {
    const { client } = fakeClient({ data: true, error: null });
    await expect(new SupabasePlatformAdminGateway(client).isPlatformAdmin(ACTOR)).resolves.toBe(true);
  });

  it('data: false -> false (tue "return true" inconditionnel, M3b)', async () => {
    const { client } = fakeClient({ data: false, error: null });
    await expect(new SupabasePlatformAdminGateway(client).isPlatformAdmin(ACTOR)).resolves.toBe(false);
  });

  it('data: null -> false (tue "return data !== false", M3c)', async () => {
    const { client } = fakeClient({ data: null, error: null });
    await expect(new SupabasePlatformAdminGateway(client).isPlatformAdmin(ACTOR)).resolves.toBe(false);
  });

  it('une error leve une exception, jamais true (tue "if (error) return true", M3a)', async () => {
    const { client } = fakeClient({ data: null, error: { message: 'rpc indisponible' } });
    await expect(new SupabasePlatformAdminGateway(client).isPlatformAdmin(ACTOR)).rejects.toThrow();
  });
});
