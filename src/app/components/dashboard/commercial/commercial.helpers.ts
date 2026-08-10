/**
 * REFONTE-UX (2026-08-08) — Gestion commerciale : types, acces donnees et
 * moteur d application des regles de prix.
 *
 * Frontiere RP#070826 (BK-RP070826-24) : couts de production = Clariprint Data,
 * prix de vente / marges / remises = ici. Les regles s appliquent AU-DESSUS du
 * prix resolu par resolvePrice() pour un contexte client donne (devis fait pour
 * ce client, boutique qui lui est dediee).
 *
 * Schema : supabase/migrations/20260808000100_gescom_price_rules.sql
 */
import { supabase } from '/utils/supabase/client';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ScopeType = 'tenant' | 'group' | 'user';
export type TargetType = 'all' | 'gamme' | 'product';
export type AdjustMode = 'margin_pct' | 'discount_pct' | 'fixed_price';

export interface ClientGroup {
  id: string;
  tenant_id: string;
  name: string;
  created_at: string;
  /** jointure count — renseigne par listClientGroups */
  member_count?: number;
}

export interface ClientPriceRule {
  id: string;
  tenant_id: string;
  name: string;
  scope_type: ScopeType;
  group_id: string | null;
  user_id: string | null;
  target_type: TargetType;
  gamme_slug: string | null;
  product_definition_id: string | null;
  adjust_mode: AdjustMode;
  value: number;
  priority: number;
  active: boolean;
  valid_from: string | null;
  valid_until: string | null;
  created_at: string;
}

export const ADJUST_MODE_LABEL: Record<AdjustMode, string> = {
  margin_pct: 'Marge (+%)',
  discount_pct: 'Remise (−%)',
  fixed_price: 'Prix imposé (€)',
};

export const SCOPE_LABEL: Record<ScopeType, string> = {
  tenant: 'Tous les clients',
  group: 'Groupe de clients',
  user: 'Client précis',
};

export const TARGET_LABEL: Record<TargetType, string> = {
  all: 'Tout le catalogue',
  gamme: 'Une gamme',
  product: 'Un produit',
};

/** Erreur PostgREST quand la table n existe pas encore (migration non jouee). */
export const TABLE_MISSING_CODES = new Set(['42P01', 'PGRST205']);

// ─── Acces donnees ───────────────────────────────────────────────────────────

export async function listPriceRules(tenantId: string) {
  return supabase
    .from('client_price_rules')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: false });
}

export async function listClientGroups(tenantId: string) {
  const res = await supabase
    .from('client_groups')
    .select('*, client_group_members(count)')
    .eq('tenant_id', tenantId)
    .order('name');
  if (res.error) return res;
  const data = (res.data ?? []).map((g: any) => ({
    ...g,
    member_count: g.client_group_members?.[0]?.count ?? 0,
  }));
  return { ...res, data };
}

// ─── Moteur d application ────────────────────────────────────────────────────

export interface CommercialContext {
  /** Client pour lequel le prix est calcule (devis ou boutique dediee). */
  userId?: string | null;
  /** Groupes du client (client_group_members). */
  groupIds?: string[];
  gammeSlug?: string | null;
  productDefinitionId?: string | null;
  /** Date de reference (defaut : maintenant). */
  at?: Date;
}

/**
 * Specificite d une regle — la plus specifique gagne :
 *   cible produit > cible gamme > tout le catalogue
 *   client precis > groupe > tous les clients
 * En cas d egalite, priority croissante puis date de creation.
 */
function ruleSpecificity(r: ClientPriceRule): number {
  const target = r.target_type === 'product' ? 200 : r.target_type === 'gamme' ? 100 : 0;
  const scope = r.scope_type === 'user' ? 20 : r.scope_type === 'group' ? 10 : 0;
  return target + scope;
}

function ruleMatches(r: ClientPriceRule, ctx: CommercialContext): boolean {
  if (!r.active) return false;
  const at = ctx.at ?? new Date();
  if (r.valid_from && new Date(r.valid_from) > at) return false;
  if (r.valid_until && new Date(r.valid_until) < at) return false;

  if (r.scope_type === 'user' && r.user_id !== (ctx.userId ?? null)) return false;
  if (r.scope_type === 'group' && !(ctx.groupIds ?? []).includes(r.group_id ?? '')) return false;

  if (r.target_type === 'gamme' && r.gamme_slug !== (ctx.gammeSlug ?? null)) return false;
  if (
    r.target_type === 'product' &&
    r.product_definition_id !== (ctx.productDefinitionId ?? null)
  )
    return false;

  return true;
}

export interface AppliedPrice {
  /** Prix apres application (unitaire, meme unite que basePrice). */
  price: number;
  /** Regle retenue, null si aucune ne matche (prix de base inchange). */
  applied: ClientPriceRule | null;
}

/**
 * Applique la regle la plus specifique au prix de base.
 * Prix de base = sortie de resolvePrice() (clariprint > library_cached >
 * prix_marche > zero). Retourne le prix ajuste, jamais negatif.
 */
export function applyCommercialRules(
  basePrice: number,
  rules: ClientPriceRule[],
  ctx: CommercialContext,
): AppliedPrice {
  const candidates = rules
    .filter((r) => ruleMatches(r, ctx))
    .sort(
      (a, b) =>
        ruleSpecificity(b) - ruleSpecificity(a) ||
        a.priority - b.priority ||
        (a.created_at < b.created_at ? 1 : -1),
    );
  const rule = candidates[0];
  if (!rule) return { price: basePrice, applied: null };

  let price = basePrice;
  if (rule.adjust_mode === 'margin_pct') price = basePrice * (1 + rule.value / 100);
  else if (rule.adjust_mode === 'discount_pct') price = basePrice * (1 - rule.value / 100);
  else price = rule.value;

  return { price: Math.max(0, price), applied: rule };
}
