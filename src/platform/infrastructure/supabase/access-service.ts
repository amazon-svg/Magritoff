import type { SupabaseClient } from '@supabase/supabase-js';
import { appError, err, ok, type Result } from '../../../kernel';
import type { Database, Json } from '../../../types/database.types';
import type {
  AccessDecision,
  AccessError,
  AccessService,
  ResourceRef,
} from '../../access';
import type { ActorContext } from '../../../kernel';

type PlatformSupabaseClient = SupabaseClient<Database>;

type CapabilityRole = Readonly<{
  tenant_id: string;
  archived_at: string | null;
  capabilities: Json;
}>;

function accessError(
  code: AccessError['code'],
  message: string,
  retryable = false,
): AccessError {
  return appError(code, message, retryable) as AccessError;
}

function asCapabilityRole(value: unknown): CapabilityRole | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.tenant_id !== 'string') return null;
  if (candidate.archived_at !== null && typeof candidate.archived_at !== 'string') return null;

  return {
    tenant_id: candidate.tenant_id,
    archived_at: candidate.archived_at as string | null,
    capabilities: candidate.capabilities as Json,
  };
}

function enabledCapabilityNames(value: Json): readonly string[] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return [];
  return Object.entries(value)
    .filter((entry): entry is [string, true] => entry[1] === true)
    .map(([name]) => name);
}

export class SupabaseAccessService implements AccessService {
  constructor(private readonly client: PlatformSupabaseClient) {}

  async can(
    actor: ActorContext,
    capability: string,
    resource?: ResourceRef,
  ): Promise<AccessDecision> {
    if (resource && resource.tenantId !== actor.tenantId) {
      return { allowed: false, reason: 'wrong_tenant' };
    }

    const evaluation = await this.evaluate(actor, capability);
    if (!evaluation.ok) {
      return { allowed: false, reason: 'provider_unavailable' };
    }

    return evaluation.value
      ? { allowed: true, reason: 'role' }
      : { allowed: false, reason: 'missing_capability' };
  }

  async require(
    actor: ActorContext,
    capability: string,
    resource?: ResourceRef,
  ): Promise<Result<void, AccessError>> {
    if (resource && resource.tenantId !== actor.tenantId) {
      return err(accessError('access.wrong_tenant', 'The resource belongs to another tenant.'));
    }

    const evaluation = await this.evaluate(actor, capability);
    if (!evaluation.ok) return evaluation;
    if (!evaluation.value) {
      return err(accessError('access.missing_capability', 'The required capability is missing.'));
    }

    return ok(undefined);
  }

  async listCapabilities(
    actor: ActorContext,
  ): Promise<Result<readonly string[], AccessError>> {
    const { data, error } = await this.client
      .from('tenant_role_assignments')
      .select('tenant_role_definitions!inner(tenant_id, archived_at, capabilities)')
      .eq('user_id', actor.userId)
      .is('revoked_at', null)
      .eq('tenant_role_definitions.tenant_id', actor.tenantId)
      .is('tenant_role_definitions.archived_at', null);

    if (error) {
      return err(
        accessError(
          'access.provider_unavailable',
          'Capabilities could not be loaded.',
          true,
        ),
      );
    }

    const capabilities = new Set<string>();
    for (const assignment of data ?? []) {
      const relation = assignment.tenant_role_definitions;
      const candidates = Array.isArray(relation) ? relation : [relation];
      for (const candidate of candidates) {
        const role = asCapabilityRole(candidate);
        if (!role || role.tenant_id !== actor.tenantId || role.archived_at !== null) continue;
        for (const capability of enabledCapabilityNames(role.capabilities)) {
          capabilities.add(capability);
        }
      }
    }

    return ok([...capabilities].sort());
  }

  private async evaluate(
    actor: ActorContext,
    capability: string,
  ): Promise<Result<boolean, AccessError>> {
    const { data, error } = await this.client.rpc('user_has_capability', {
      p_tenant_id: actor.tenantId,
      p_capability: capability,
    });

    if (error || typeof data !== 'boolean') {
      return err(
        accessError(
          'access.provider_unavailable',
          'Capability evaluation is temporarily unavailable.',
          true,
        ),
      );
    }

    return ok(data);
  }
}
