/**
 * Implementation Supabase du referentiel des etapes de production (story
 * E10.13).
 *
 * Le tenant est toujours passe explicitement par l appelant (route), jamais
 * lu depuis la session Supabase — meme discipline que
 * `SupabasePriceRulesRepository`.
 *
 * Creation, suppression et reordonnancement DELEGUENT ENTIEREMENT aux
 * fonctions Postgres `security definer` (`api_create_production_step`,
 * `api_delete_production_step`, `api_reorder_production_steps`, migration
 * `20260908020000`) : plafond de 50 sous verrou, reindexation, exhaustivite
 * du reordonnancement sont FAITS DANS LA MEME TRANSACTION cote base.
 * `updateProductionStep` (PATCH) est le SEUL geste d ecriture qui passe par
 * un `UPDATE` direct, garde par la RLS (`production_steps_write`) — aucune
 * fonction dediee (contrat, §3).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { TenantId, UserId } from '../../kernel/ids/index.ts';
import { toIsoTimestamp } from '../../modules/_shared/application/index.ts';
import type {
  CreateProductionStepCommand,
  ProductionStepColor,
  ProductionStepDto,
  UpdateProductionStepCommand,
} from '../../modules/production-steps/api/contracts.ts';
import {
  ProductionStepInUseError,
  ProductionStepLabelConflictError,
  ProductionStepLimitReachedError,
  ProductionStepNotFoundError,
  ProductionStepPositionsMismatchError,
  type ListProductionStepsResult,
  type ProductionStepsRepository,
} from '../../modules/production-steps/application/production-steps-repository.ts';

export class SupabaseProductionStepsRepository implements ProductionStepsRepository {
  constructor(private readonly client: SupabaseClient<any>) {}

  async list(tenantId: TenantId): Promise<ListProductionStepsResult> {
    const { data, error } = await this.client
      .from('production_steps')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('position', { ascending: true });
    if (error) throw new Error(error.message);
    return { all: (data ?? []).map(toProductionStepDto) };
  }

  async findById(tenantId: TenantId, stepId: string): Promise<ProductionStepDto | null> {
    const { data, error } = await this.client
      .from('production_steps')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', stepId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? toProductionStepDto(data) : null;
  }

  async create(
    tenantId: TenantId,
    actor: UserId,
    command: CreateProductionStepCommand,
  ): Promise<ProductionStepDto> {
    void actor; // trace : la fonction lit auth.uid() de la session, pas ce parametre.
    const { data, error } = await this.client.rpc('api_create_production_step', {
      p_tenant_id: tenantId,
      p_label: command.label,
      p_color: command.color ?? null,
      p_is_terminal: command.is_terminal,
    });
    if (error) throw mapProductionStepError(error);
    return toProductionStepDto(data);
  }

  async update(
    tenantId: TenantId,
    stepId: string,
    command: UpdateProductionStepCommand,
  ): Promise<ProductionStepDto> {
    const patch: Record<string, unknown> = {};
    if ('label' in command) patch['label'] = command.label;
    if ('color' in command) patch['color'] = command.color;
    if ('is_terminal' in command) patch['is_terminal'] = command.is_terminal;
    if ('is_active' in command) patch['is_active'] = command.is_active;

    const { data, error } = await this.client
      .from('production_steps')
      .update(patch)
      .eq('tenant_id', tenantId)
      .eq('id', stepId)
      .select()
      .maybeSingle();
    if (error) throw mapProductionStepError(error);
    if (!data) throw new ProductionStepNotFoundError();
    return toProductionStepDto(data);
  }

  async remove(tenantId: TenantId, actor: UserId, stepId: string): Promise<void> {
    void actor;
    const { error } = await this.client.rpc('api_delete_production_step', {
      p_tenant_id: tenantId,
      p_step_id: stepId,
    });
    if (error) throw mapProductionStepError(error);
  }

  async reorder(
    tenantId: TenantId,
    actor: UserId,
    stepIds: readonly string[],
  ): Promise<readonly ProductionStepDto[]> {
    void actor;
    const { error } = await this.client.rpc('api_reorder_production_steps', {
      p_tenant_id: tenantId,
      p_step_ids: [...stepIds],
    });
    if (error) throw mapProductionStepError(error);

    const { all } = await this.list(tenantId);
    return all;
  }

  /**
   * E10.13 — meme fonction SQL que `SupabasePriceRulesRepository.
   * actorHasCapability()` (E10.6), appelee directement ici plutot que par une
   * dependance croisee entre modules (convention du depot).
   */
  async actorHasCapability(tenantId: TenantId, actorId: UserId, capability: string): Promise<boolean> {
    void actorId; // trace : `user_has_capability` lit `auth.uid()` de la session, pas ce parametre.
    const { data, error } = await this.client.rpc('user_has_capability', {
      p_tenant_id: tenantId,
      p_capability: capability,
    });
    if (error) throw new Error(error.message);
    return Boolean(data);
  }
}

function isProductionStepColor(value: unknown): value is ProductionStepColor {
  return value === 'slate' || value === 'blue' || value === 'green' || value === 'amber' || value === 'red' || value === 'violet';
}

function toProductionStepDto(row: Record<string, any>): ProductionStepDto {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    label: row.label,
    position: Number(row.position),
    color: isProductionStepColor(row.color) ? row.color : 'slate',
    is_terminal: Boolean(row.is_terminal),
    is_active: Boolean(row.is_active),
    created_at: toIsoTimestamp(row.created_at),
    updated_at: toIsoTimestamp(row.updated_at),
  };
}

/**
 * Traduit une erreur Postgres (contrainte violee ou message d exception
 * `raise exception 'code: detail'` d une fonction `api_*`) en erreur de
 * domaine. Meme discipline que `mapQuoteConversionError`
 * (`commercial-orders-repository.ts`) pour les fonctions, complete par la
 * traduction des codes Postgres (`23505` unicite, `23503` cle etrangere) pour
 * l `UPDATE` direct de `update()`.
 */
function mapProductionStepError(error: { code?: string; message: string }): Error {
  const message = error.message ?? '';

  if (message.includes('permission_denied')) {
    // La route retraduit ce cas en 403 identity.role_required via le SERVICE
    // (`assertCanManageProductionSteps`, appele AVANT toute ecriture) : cette
    // branche n est donc normalement jamais atteinte en pratique, mais reste
    // une defense en profondeur si un appelant contournait le service.
    return new Error(`permission_denied: ${message}`);
  }
  if (message.includes('production_step.limit_reached')) {
    return new ProductionStepLimitReachedError(message);
  }
  if (message.includes('production_step.not_found')) {
    return new ProductionStepNotFoundError(message);
  }
  if (message.includes('production_step.in_use')) {
    return new ProductionStepInUseError(message);
  }
  if (message.includes('production_step.positions_mismatch')) {
    return new ProductionStepPositionsMismatchError(message);
  }
  if (error.code === '23505') {
    return new ProductionStepLabelConflictError(message);
  }
  if (error.code === '23503') {
    return new ProductionStepInUseError(message);
  }
  return new Error(message || 'Operation impossible sur le referentiel des etapes de production.');
}
