import type { SupabaseClient } from '@supabase/supabase-js';
import { appError, err, ok, type Result, type TenantId } from '../../../kernel';
import type { Database, Json } from '../../../types/database.types';
import type {
  EntitlementError,
  EntitlementService,
} from '../../entitlements';

type PlatformSupabaseClient = SupabaseClient<Database>;

function entitlementError(
  code: EntitlementError['code'],
  message: string,
  retryable = false,
): EntitlementError {
  return appError(code, message, retryable) as EntitlementError;
}

function jsonRecord(value: Json | undefined): Readonly<Record<string, Json | undefined>> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : null;
}

/**
 * Adaptateur pilote explicite. Les features et quotas sont lus dans
 * `tenants.settings.features` et `tenants.settings.quotas`. Toute valeur
 * absente ou mal formée est refusée par défaut.
 */
export class SupabaseTenantSettingsEntitlementService implements EntitlementService {
  constructor(private readonly client: PlatformSupabaseClient) {}

  async hasFeature(
    tenantId: TenantId,
    feature: string,
  ): Promise<Result<boolean, EntitlementError>> {
    const settings = await this.loadSettings(tenantId);
    if (!settings.ok) return settings;

    const features = jsonRecord(settings.value.features);
    return ok(features?.[feature] === true);
  }

  async requireFeature(
    tenantId: TenantId,
    feature: string,
  ): Promise<Result<void, EntitlementError>> {
    const enabled = await this.hasFeature(tenantId, feature);
    if (!enabled.ok) return enabled;
    if (!enabled.value) {
      return err(
        entitlementError(
          'entitlement.feature_unavailable',
          'The requested feature is not enabled for this tenant.',
        ),
      );
    }

    return ok(undefined);
  }

  async getLimit(
    tenantId: TenantId,
    quota: string,
  ): Promise<Result<number | null, EntitlementError>> {
    const settings = await this.loadSettings(tenantId);
    if (!settings.ok) return settings;

    const quotas = jsonRecord(settings.value.quotas);
    const configured = quotas?.[quota];
    return ok(typeof configured === 'number' && Number.isFinite(configured) ? configured : null);
  }

  async consume(
    _tenantId: TenantId,
    _quota: string,
    _amount: number,
  ): Promise<Result<void, EntitlementError>> {
    return err(
      entitlementError(
        'entitlement.provider_unavailable',
        'Atomic quota consumption is not available through the pilot adapter.',
      ),
    );
  }

  private async loadSettings(
    tenantId: TenantId,
  ): Promise<Result<Readonly<Record<string, Json | undefined>>, EntitlementError>> {
    const { data, error } = await this.client
      .from('tenants')
      .select('settings')
      .eq('id', tenantId)
      .maybeSingle();

    if (error) {
      return err(
        entitlementError(
          'entitlement.provider_unavailable',
          'Tenant entitlements could not be loaded.',
          true,
        ),
      );
    }

    const settings = jsonRecord(data?.settings);
    return ok(settings ?? {});
  }
}
