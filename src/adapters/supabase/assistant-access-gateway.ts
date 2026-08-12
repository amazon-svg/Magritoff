import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserId } from '../../kernel/ids/index.ts';
import type { AssistantAccessGateway } from '../../modules/diagnostics/application/assistant-access-gateway.ts';
import type { Database } from '../../types/database.types.ts';

export class SupabaseAssistantAccessGateway implements AssistantAccessGateway {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async isTenantMember(actor: UserId, tenantId: string): Promise<boolean> {
    const { data, error } = await this.client.from('tenant_members')
      .select('user_id')
      .eq('tenant_id', tenantId)
      .eq('user_id', actor)
      .maybeSingle();
    if (error) throw new Error(`assistant_access_failed:${error.message}`);
    return data !== null;
  }
}
