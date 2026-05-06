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
  useState,
} from 'react';
import { useNavigate, useParams } from 'react-router';
import { supabase } from '/utils/supabase/client';
import { useAuth } from './AuthContext';

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
  acceptInvitation: (token: string) => Promise<string | null>;

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

  const [tenants, setTenants] = useState<TenantWithMembership[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // ─── Chargement de la liste des tenants de l'user ──────────────────────
  const reload = useCallback(async () => {
    if (!user) {
      setTenants([]);
      setIsSuperAdmin(false);
      setLoading(false);
      return;
    }
    setLoading(true);

    // 1. Tenants dont je suis membre direct
    const { data: memberships, error: memErr } = await supabase
      .from('tenant_members')
      .select('role, access_scope, allowed_shop_ids, permissions, tenant:tenants!inner(*)')
      .eq('user_id', user.id);

    if (memErr) {
      console.error('[TenantContext] memberships error:', memErr.message);
      setTenants([]);
      setLoading(false);
      return;
    }

    const direct: TenantWithMembership[] = (memberships || []).map((m: any) => ({
      ...(m.tenant as Tenant),
      myRole: m.role as TenantRole,
      accessScope: (m.access_scope as AccessScope) ?? 'magrit_full',
      allowedShopIds: (m.allowed_shop_ids as string[]) ?? [],
      permissions: { ...DEFAULT_PERMISSIONS, ...(m.permissions ?? {}) },
      inheritedFromParent: false,
    }));

    // 2. Sous-tenants visibles par heritage (parent dont je suis owner/admin/member)
    //    Exclut les tenants ou je suis 'partner' (pas d'heritage descendant).
    const inheritableParentIds = direct
      .filter((t) => t.myRole !== 'partner')
      .map((t) => t.id);

    let inherited: TenantWithMembership[] = [];
    if (inheritableParentIds.length > 0) {
      const { data: children } = await supabase
        .from('tenants')
        .select('*')
        .in('parent_tenant_id', inheritableParentIds);
      const directIds = new Set(direct.map((t) => t.id));
      inherited = (children || [])
        .filter((c: any) => !directIds.has(c.id))
        .map((c: any) => {
          // Le role effectif = role sur le parent. Heritage = magrit_full
          // par defaut (admin du parent doit pouvoir tout voir).
          const parent = direct.find((t) => t.id === c.parent_tenant_id);
          return {
            ...(c as Tenant),
            myRole: parent?.myRole ?? 'member',
            accessScope: 'magrit_full' as AccessScope,
            allowedShopIds: [],
            permissions: { ...DEFAULT_PERMISSIONS, can_invite: true },
            inheritedFromParent: true,
          };
        });
    }

    const all = [...direct, ...inherited];
    setTenants(all);

    // 3. isSuperAdmin : membre de magrit-root avec role owner/admin
    setIsSuperAdmin(
      direct.some(
        (t) => t.is_system_tenant && (t.myRole === 'owner' || t.myRole === 'admin')
      )
    );

    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!authLoading) reload();
  }, [authLoading, reload]);

  // ─── Tenant courant (depuis l'URL, fallback last_tenant, fallback premier) ──
  const [fallbackSlug, setFallbackSlug] = useState<string | null>(null);
  useEffect(() => {
    if (!user) return;
    supabase
      .from('user_preferences')
      .select('last_tenant_id')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.last_tenant_id) {
          const match = tenants.find((t) => t.id === data.last_tenant_id);
          setFallbackSlug(match?.slug ?? null);
        }
      });
  }, [user, tenants]);

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
    if (!user || !currentTenant) return;
    supabase
      .from('user_preferences')
      .upsert(
        { user_id: user.id, last_tenant_id: currentTenant.id },
        { onConflict: 'user_id' }
      )
      .then(() => {});
  }, [user, currentTenant?.id]);

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
      const { data, error } = await supabase.rpc('create_tenant_with_owner', {
        p_slug: slug,
        p_name: name,
        p_parent_tenant_id: null,
      });
      if (error) {
        console.error('[TenantContext] createTenant error:', error.message);
        return null;
      }
      const tenantId = data as string;
      // E6.1 — Si un SIREN a ete fourni et valide, on enregistre les infos
      // INSEE et on marque le tenant comme verifie. Update post-creation pour
      // ne pas modifier la signature de la RPC partagee.
      if (siren && sirenData) {
        await supabase
          .from('tenants')
          .update({
            siren,
            siren_data: sirenData,
            verified: true,
            verified_at: new Date().toISOString(),
          })
          .eq('id', tenantId);
      }
      // E9.6 — Si l user a selectionne des gammes au wizard, insert bulk
      // dans tenant_gamme_subscriptions. Best-effort : un echec ici ne
      // bloque pas la creation du tenant (l user peut toujours activer
      // les gammes depuis /dashboard/gammes apres coup).
      if (gammeSlugs && gammeSlugs.length > 0) {
        const rows = gammeSlugs.map((gamme_slug) => ({
          tenant_id: tenantId,
          gamme_slug,
          active: true,
        }));
        const { error: gammesErr } = await supabase
          .from('tenant_gamme_subscriptions')
          .upsert(rows, { onConflict: 'tenant_id,gamme_slug' });
        if (gammesErr) {
          console.error(
            '[TenantContext] gammes subscriptions failed (tenant cree quand meme):',
            gammesErr.message,
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
      const { data, error } = await supabase.rpc('create_tenant_with_owner', {
        p_slug: slug,
        p_name: name,
        p_parent_tenant_id: parentTenantId,
      });
      if (error) {
        console.error('[TenantContext] createSubTenant error:', error.message);
        return null;
      }
      await reload();
      return data as string;
    },
    [reload]
  );

  const acceptInvitation = useCallback(
    async (token: string): Promise<string | null> => {
      const { data, error } = await supabase.rpc('accept_tenant_invitation', {
        p_token: token,
      });
      if (error) {
        console.error('[TenantContext] acceptInvitation error:', error.message);
        return null;
      }
      await reload();
      return data as string;
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
    loading: loading || authLoading,
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
