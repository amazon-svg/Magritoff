import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserId } from '../../kernel/ids/index.ts';
import type { PlatformAdminGateway } from '../../modules/diagnostics/application/platform-admin-gateway.ts';
import type { Database } from '../../types/database.types.ts';

/**
 * BCP-0c — evalue `is_super_admin()` sous le jeton de l appelant (`client` est
 * lie a l en-tete `Authorization` de la requete, comme partout ailleurs dans
 * la facade). L acteur passe en parametre n est pas transmis au RPC : la
 * fonction SQL lit `auth.uid()` du JWT courant, exactement comme
 * `SupabaseCatalogRepository.assertPimAdmin` (`catalog-repository.ts:72`).
 * Il reste dans la signature pour la symetrie avec les autres gateways du
 * module (`AssistantAccessGateway.isTenantMember`) et pour que les tests
 * puissent distinguer un acteur d un autre sur un faux.
 */
export class SupabasePlatformAdminGateway implements PlatformAdminGateway {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async isPlatformAdmin(_actor: UserId): Promise<boolean> {
    const { data, error } = await this.client.rpc('is_super_admin');
    if (error) throw new Error(`platform_admin_check_failed:${error.message}`);
    return data === true;
  }
}
