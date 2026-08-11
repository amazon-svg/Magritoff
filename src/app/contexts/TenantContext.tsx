/**
 * TenantContext (v3 multi-tenant)
 * ───────────────────────────────
 * Context global qui expose :
 *   - la liste des tenants auxquels l'utilisateur a acces
 *   - le tenant COURANT (resolu depuis l'URL /t/:slug, fallback last_tenant_id
 *     dans user_preferences, sinon premier tenant disponible)
 *   - le role de l'user dans le tenant courant
 *   - un flag isSuperAdmin (membership dans le tenant systeme 'magrit-root')
 *   - des helpers pour changer de tenant, creer un tenant / sous-tenant,
 *     inviter, accepter une invitation
 *
 * Toutes les requetes data (contextes Clients, Libraries, Shops, Quotes...)
 * doivent desormais filtrer par `tenant.id`. Le provider expose aussi une
 * fonction `withTenant(payload)` qui merge `tenant_id` dans n'importe quel
 * objet d'insert Supabase — shortcut pour eviter d'oublier.
 *
 * Design note : le tenant courant est la SOURCE DE VERITE. Si l'URL ne
 * correspond a aucun tenant accessible, on redirige vers le picker /tenants.
 */

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from 'react';
import { useNavigate, useParams } from 'react-router';
import { legacyTenantCommands } from '../../adapters/supabase/legacy-tenant-commands';
import { useAuth } from './AuthContext';
import { useSessionBootstrap } from './SessionBootstrapContext';

// ─── Types ────────────────────────────────────────────────────────────────

export type TenantRole = 'owner' | 'admin' | 'member' | 'partner';
export type TenantPlan = 'freemium' | 'pro' | 'enterprise';
export type AccessScope = 'magrit_full' | 'shop_only';

export interface MemberPermissions {
  can_quote: boolean;
  can_order: boolean;
  can_invite: boolean;
}

export const DEFAULT_PERMISSIONS: MemberPermissions = {
  can_quote: true,
  can_order: true,
  can_invite: false,
};

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  parent_tenant_id: string | null;
  plan: TenantPlan;
  is_system_tenant: boolean;
  settings: Record<string, any>;
  created_at: string;
  /** SIREN FR ou tax id international, optionnel (E6.1) */
  siren?: string | null;
  /** Reponse INSEE (raison sociale, code NAF, actif…) — bouchon pour l'instant */
  siren_data?: Record<string, any>;
  /** True si le SIREN a ete valide a la creation du tenant */
  verified?: boolean;
  verified_at?: string | null;
  /** Regime fiscal TVA (R0 Spike H, migration 20260511_02). Defaut DB : 'metropole_fr'. */
  tax_regime?: import('../utils/tax').TaxRegime | null;
}

export interface TenantWithMembership extends Tenant {
  /** role du user courant dans ce tenant */
  myRole: TenantRole;
  /** scope d'acces : magrit_full (dashboard complet) ou shop_only (boutique seule) */
  accessScope: AccessScope;
  /** liste de boutiques accessibles si scope=shop_only (vide si magrit_full) */
  allowedShopIds: string[];
  /** permissions fines */
  permissions: MemberPermissions;
  /** acces "herite" (ex: je suis admin du parent donc je vois le child) */
  inheritedFromParent: boolean;
}

interface TenantContextType {
  /** tenants auxquels l'user a acces (direct + enfants heritesvia parent) */
  tenants: TenantWithMembership[];
  /** tenant actuellement selectionne (routing / dernier actif) */
  currentTenant: TenantWithMembership | null;
  /** role du user dans le tenant courant (null si pas encore resolu) */
  currentRole: TenantRole | null;
  /** true si l'user est superadmin Magrit (membre de magrit-root) */
  isSuperAdmin: boolean;
  loading: boolean;

  /** Changer de tenant programmatiquement (navigate vers /t/:slug) */
  switchTenant: (slug: string) => void;

  /** Creer un nouveau tenant racine (signup). E6.1 : siren + siren_data optionnels.
   *  E9.6 : gammeSlugs = liste de gammes du PIM a activer immediatement (wizard
   *  d onboarding). Insert bulk dans tenant_gamme_subscriptions apres creation. */
  createTenant: (input: {
    slug: string;
    name: string;
    siren?: string;
    sirenData?: Record<string, any>;
    gammeSlugs?: string[];
  }) => Promise<string | null>;

  /** Creer un sous-tenant (filiale OU espace client B2B) sous un tenant parent */
  createSubTenant: (input: {
    parentTenantId: string;
    slug: string;
    name: string;
  }) => Promise<string | null>;

  /** Accepter une invitation via token recu par email */
  acceptInvitation: (
    token: string
  ) => Promise<{ tenantId: string | null; errorCode?: string; errorMessage?: string }>;

  /** Merge tenant_id dans un objet d'insert Supabase. Raccourci courant. */
  withTenant: <T extends Record<string, any>>(payload: T) => T & { tenant_id: string };

  /** Force un reload de la liste (apres invite, apres creation...) */
  reload: () => Promise<void>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────────────────

export function TenantProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { tenantSlug } = useParams<{ tenantSlug?: string }>();
  const navigate = useNavigate();
  const bootstrap = useSessionBootstrap();
  const dataForUser = bootstrap.data?.user.id === user?.id ? bootstrap.data : null;
  const tenants = (dataForUser?.tenants ?? []) as TenantWithMembership[];
  const isSuperAdmin = dataForUser?.isSuperAdmin ?? false;
  const reload = bootstrap.reload;

  // ─── Tenant courant (depuis l'URL, fallback last_tenant, fallback premier) ──
  const fallbackSlug = tenants.find(
    (tenant) => tenant.id === dataForUser?.preferences.last_tenant_id,
  )?.slug ?? null;

  const currentTenant = useMemo(() => {
    if (tenantSlug) {
      const t = tenants.find((t) => t.slug === tenantSlug);
      if (t) return t;
    }
    if (fallbackSlug) {
      const t = tenants.find((t) => t.slug === fallbackSlug);
      if (t) return t;
    }
    return tenants[0] ?? null;
  }, [tenants, tenantSlug, fallbackSlug]);

  const currentRole = currentTenant?.myRole ?? null;

  // ─── Persiste last_tenant_id quand on change de tenant ─────────────────
  useEffect(() => {
    if (
      !user ||
      !currentTenant ||
      currentTenant.id === dataForUser?.preferences.last_tenant_id
    ) return;
    void bootstrap.updateCurrentTenant(currentTenant.id).catch((error) => {
      console.error('[TenantContext] current tenant update failed', error);
    });
  }, [bootstrap.updateCurrentTenant, currentTenant?.id, dataForUser?.preferences.last_tenant_id, user]);

  // ─── Actions ────────────────────────────────────────────────────────────

  const switchTenant = useCallback(
    (slug: string) => {
      navigate(`/t/${slug}`);
    },
    [navigate]
  );

  const createTenant = useCallback(
    async ({
      slug,
      name,
      siren,
      sirenData,
      gammeSlugs,
    }: {
      slug: string;
      name: string;
      siren?: string;
      sirenData?: Record<string, any>;
      gammeSlugs?: string[];
    }): Promise<string | null> => {
      let tenantId: string;
      try {
        tenantId = await legacyTenantCommands.createTenant({ slug, name, parentTenantId: null });
      } catch (error) {
        console.error('[TenantContext] createTenant error:', error);
        return null;
      }
      // E6.1 — Si un SIREN a ete fourni et valide, on enregistre les infos
      // INSEE et on marque le tenant comme verifie. Update post-creation pour
      // ne pas modifier la signature de la RPC partagee.
      if (siren && sirenData) {
        try {
          await legacyTenantCommands.markTenantVerified(tenantId, siren, sirenData);
        } catch (error) {
          console.error('[TenantContext] tenant verification failed:', error);
        }
      }
      // E9.6 — Si l user a selectionne des gammes au wizard, insert bulk
      // dans tenant_gamme_subscriptions. Best-effort : un echec ici ne
      // bloque pas la creation du tenant (l user peut toujours activer
      // les gammes depuis /dashboard/gammes apres coup).
      if (gammeSlugs && gammeSlugs.length > 0) {
        try {
          await legacyTenantCommands.activateGammes(tenantId, gammeSlugs);
        } catch (error) {
          console.error(
            '[TenantContext] gammes subscriptions failed (tenant cree quand meme):',
            error,
          );
        }
      }
      await reload();
      return tenantId;
    },
    [reload]
  );

  const createSubTenant = useCallback(
    async ({
      parentTenantId,
      slug,
      name,
    }: {
      parentTenantId: string;
      slug: string;
      name: string;
    }): Promise<string | null> => {
      let tenantId: string;
      try {
        tenantId = await legacyTenantCommands.createTenant({ slug, name, parentTenantId });
      } catch (error) {
        console.error('[TenantContext] createSubTenant error:', error);
        return null;
      }
      await reload();
      return tenantId;
    },
    [reload]
  );

  const acceptInvitation = useCallback(
    async (
      token: string
    ): Promise<{ tenantId: string | null; errorCode?: string; errorMessage?: string }> => {
      try {
        const tenantId = await legacyTenantCommands.acceptInvitation(token);
        await reload();
        return { tenantId };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('[TenantContext] acceptInvitation error:', message);
        // Fix 2026-05-27 : propage le code d'erreur pour distinguer
        // EMAIL_MISMATCH (mauvais compte connecte) d'une invitation
        // reellement invalide/expiree. Le RPC prefixe 'EMAIL_MISMATCH:'.
        const errorCode = message.includes('EMAIL_MISMATCH') ? 'EMAIL_MISMATCH' : 'INVALID';
        return { tenantId: null, errorCode, errorMessage: message };
      }
    },
    [reload]
  );

  const withTenant = useCallback(
    <T extends Record<string, any>>(payload: T): T & { tenant_id: string } => {
      if (!currentTenant) {
        throw new Error(
          '[TenantContext] withTenant() appele sans tenant courant. ' +
            "L'appelant doit attendre que TenantContext soit charge."
        );
      }
      return { ...payload, tenant_id: currentTenant.id };
    },
    [currentTenant]
  );

  const value: TenantContextType = {
    tenants,
    currentTenant,
    currentRole,
    isSuperAdmin,
    // Fix race 2026-05-27 : effectiveLoading reste true tant que les tenants
    // du user courant ne sont pas charges (vs loading brut qui retombe a
    // false entre user-change et reload).
    loading: authLoading || (!!user && bootstrap.loading),
    switchTenant,
    createTenant,
    createSubTenant,
    acceptInvitation,
    withTenant,
    reload,
  };

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return ctx;
}
