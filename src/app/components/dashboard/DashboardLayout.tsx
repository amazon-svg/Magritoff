import { Navigate, NavLink, Outlet, useLocation } from 'react-router';
import {
  User, Settings, MessageSquare, FileText, ShoppingBag, Users,
  CreditCard, Package, Store, Shield, LayoutTemplate, Building, Layers, Workflow,
  FileClock, BadgePercent, Factory, Image as ImageIcon,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { usePlan } from '../../hooks/usePlan';
import { useIsAdmin } from '../../hooks/useIsAdmin';
import { useTenant } from '../../contexts/TenantContext';
import { PLAN_LABEL } from '../../utils/plans';
import { MagritLogo } from '../brand/MagritLogo';
import { TEST_IDS } from '../../lib/testIds';
import { workspaceSurface } from '../../../surfaces/workspace';

const ACCOUNT_NAVIGATION = workspaceSurface.navigation.find(
  ({ id }) => id === 'account.workspace.navigation',
);
const ACCOUNT_ROUTE = workspaceSurface.routes.find(
  ({ id }) => id === ACCOUNT_NAVIGATION?.routeId,
);
if (!ACCOUNT_NAVIGATION || !ACCOUNT_ROUTE) {
  throw new Error('La contribution workspace du module account est incomplète.');
}
const ORDERS_NAVIGATION = workspaceSurface.navigation.find(({ id }) => id === 'orders.workspace.navigation');
const ORDERS_ROUTE = workspaceSurface.routes.find(({ id }) => id === ORDERS_NAVIGATION?.routeId);
if (!ORDERS_NAVIGATION || !ORDERS_ROUTE) throw new Error('La contribution workspace du module orders est incomplète.');
const SHOPS_NAVIGATION = workspaceSurface.navigation.find(({ id }) => id === 'shops.workspace.navigation');
const SHOPS_ROUTE = workspaceSurface.routes.find(({ id }) => id === SHOPS_NAVIGATION?.routeId);
if (!SHOPS_NAVIGATION || !SHOPS_ROUTE) throw new Error('La contribution workspace du module shops est incomplète.');
const QUOTES_NAVIGATION = workspaceSurface.navigation.find(({ id }) => id === 'quotes.workspace.navigation');
const QUOTES_ROUTE = workspaceSurface.routes.find(({ id }) => id === QUOTES_NAVIGATION?.routeId);
const PENDING_QUOTES_NAVIGATION = workspaceSurface.navigation.find(({ id }) => id === 'quotes.workspace.pending-navigation');
const PENDING_QUOTES_ROUTE = workspaceSurface.routes.find(({ id }) => id === PENDING_QUOTES_NAVIGATION?.routeId);
if (!QUOTES_NAVIGATION || !QUOTES_ROUTE || !PENDING_QUOTES_NAVIGATION || !PENDING_QUOTES_ROUTE) throw new Error('La contribution workspace du module quotes est incomplète.');
const QUOTE_TEMPLATES_NAVIGATION = workspaceSurface.navigation.find(({ id }) => id === 'quote-templates.workspace.navigation');
const QUOTE_TEMPLATES_ROUTE = workspaceSurface.routes.find(({ id }) => id === QUOTE_TEMPLATES_NAVIGATION?.routeId);
if (!QUOTE_TEMPLATES_NAVIGATION || !QUOTE_TEMPLATES_ROUTE) throw new Error('La contribution workspace du module quote-templates est incomplète.');
const LIBRARIES_NAVIGATION = workspaceSurface.navigation.find(({ id }) => id === 'libraries.workspace.navigation');
const LIBRARIES_ROUTE = workspaceSurface.routes.find(({ id }) => id === LIBRARIES_NAVIGATION?.routeId);
if (!LIBRARIES_NAVIGATION || !LIBRARIES_ROUTE) throw new Error('La contribution workspace du module libraries est incomplète.');
const CATALOG_PIM_NAVIGATION = workspaceSurface.navigation.find(({ id }) => id === 'catalog.workspace.pim-navigation');
const CATALOG_PIM_ROUTE = workspaceSurface.routes.find(({ id }) => id === CATALOG_PIM_NAVIGATION?.routeId);
const CATALOG_GAMMES_NAVIGATION = workspaceSurface.navigation.find(({ id }) => id === 'catalog.workspace.gammes-navigation');
const CATALOG_GAMMES_ROUTE = workspaceSurface.routes.find(({ id }) => id === CATALOG_GAMMES_NAVIGATION?.routeId);
if (!CATALOG_PIM_NAVIGATION || !CATALOG_PIM_ROUTE || !CATALOG_GAMMES_NAVIGATION || !CATALOG_GAMMES_ROUTE) throw new Error('La contribution workspace du module catalog est incomplète.');
const COMMERCIAL_NAVIGATION = workspaceSurface.navigation.find(({ id }) => id === 'commercial.workspace.navigation');
const COMMERCIAL_ROUTE = workspaceSurface.routes.find(({ id }) => id === COMMERCIAL_NAVIGATION?.routeId);
if (!COMMERCIAL_NAVIGATION || !COMMERCIAL_ROUTE) throw new Error('La contribution workspace du module commercial est incomplète.');
const MEMBERS_NAVIGATION = workspaceSurface.navigation.find(({ id }) => id === 'members.workspace.navigation');
const MEMBERS_ROUTE = workspaceSurface.routes.find(({ id }) => id === MEMBERS_NAVIGATION?.routeId);
if (!MEMBERS_NAVIGATION || !MEMBERS_ROUTE) throw new Error('La contribution workspace du module members est incomplète.');
const TENANT_SETTINGS_NAVIGATION = workspaceSurface.navigation.find(({ id }) => id === 'tenants.workspace.settings-navigation');
const TENANT_SETTINGS_ROUTE = workspaceSurface.routes.find(({ id }) => id === TENANT_SETTINGS_NAVIGATION?.routeId);
const TENANT_SPACES_NAVIGATION = workspaceSurface.navigation.find(({ id }) => id === 'tenants.workspace.spaces-navigation');
const TENANT_SPACES_ROUTE = workspaceSurface.routes.find(({ id }) => id === TENANT_SPACES_NAVIGATION?.routeId);
if (!TENANT_SETTINGS_NAVIGATION || !TENANT_SETTINGS_ROUTE || !TENANT_SPACES_NAVIGATION || !TENANT_SPACES_ROUTE) throw new Error('La contribution workspace du module tenants est incomplète.');
const ROLES_NAVIGATION = workspaceSurface.navigation.find(({ id }) => id === 'roles.workspace.navigation');
const ROLES_ROUTE = workspaceSurface.routes.find(({ id }) => id === ROLES_NAVIGATION?.routeId);
if (!ROLES_NAVIGATION || !ROLES_ROUTE) throw new Error('La contribution workspace du module roles est incomplète.');
const CONVERSATIONS_NAVIGATION = workspaceSurface.navigation.find(({ id }) => id === 'conversations.workspace.navigation');
const CONVERSATIONS_ROUTE = workspaceSurface.routes.find(({ id }) => id === CONVERSATIONS_NAVIGATION?.routeId);
if (!CONVERSATIONS_NAVIGATION || !CONVERSATIONS_ROUTE) throw new Error('La contribution workspace du module conversations est incomplète.');
const MACHINE_PARKS_NAVIGATION = workspaceSurface.navigation.find(({ id }) => id === 'machine-parks.workspace.navigation');
const MACHINE_PARKS_ROUTE = workspaceSurface.routes.find(({ id }) => id === MACHINE_PARKS_NAVIGATION?.routeId);
if (!MACHINE_PARKS_NAVIGATION || !MACHINE_PARKS_ROUTE) throw new Error('La contribution workspace du module machine-parks est incomplète.');
const MOCKUPS_NAVIGATION = workspaceSurface.navigation.find(({ id }) => id === 'mockups.workspace.navigation');
const MOCKUPS_ROUTE = workspaceSurface.routes.find(({ id }) => id === MOCKUPS_NAVIGATION?.routeId);
if (!MOCKUPS_NAVIGATION || !MOCKUPS_ROUTE) throw new Error('La contribution workspace du module mockups est incomplète.');

// E7.7 — mapping label de NavLink -> data-testid pour les cas de test.
// Couvre les liens cles des cahiers de tests P01 (sidebar nav).
const NAV_LINK_TESTIDS: Record<string, string> = {
  // REFONTE-UX (2026-08-08) — le lien Profil devient Mon compte (Parametres),
  // le testid historique est conserve pour les cahiers de tests P01.
  'Mon compte': TEST_IDS.nav.sidebarProfileLink,
  'Utilisateurs': TEST_IDS.nav.sidebarUsersLink,
};

// E7.7 — mapping titre de groupe -> data-testid (groupes structurels Linear-like).
const NAV_GROUP_TESTIDS: Record<string, string> = {
  // REFONTE-UX v2 (2026-08-08) — l Atelier a fusionne dans Gestion commerciale
  // (point 6) et Config est devenu Parametres ; testids historiques conserves
  // pour les cahiers de tests P01.
  'Gestion commerciale': TEST_IDS.nav.sidebarAtelierLink,
  'Paramètres': TEST_IDS.nav.sidebarConfigLink,
};

// Design source : .design-handoff/designs/04 - Admin dashboard.html
// Layout : Linear-dense — sidebar 220px + main, typo Helvetica Neue 300/400/500.
export function DashboardLayout() {
  const { user, loading } = useAuth();
  const { plan, canUse } = usePlan();
  const isAdmin = useIsAdmin();
  const { currentTenant, currentRole, isSuperAdmin } = useTenant();
  const location = useLocation();

  // Raccourci : tenantSlug extrait du path courant pour construire les `to` absolus.
  // On prefere absolus pour que la NavLink active-match fonctionne sans surprise.
  const tenantSlug = currentTenant?.slug ?? '';
  const basePath = `/t/${tenantSlug}/dashboard`;

  const canManageMembers = currentRole === 'owner' || currentRole === 'admin' || isSuperAdmin;
  const canManageSpaces =
    canManageMembers && currentTenant && !currentTenant.parent_tenant_id;

  if (loading) {
    return (
      <div
        className="min-h-screen grid place-items-center bg-bg text-ink-muted"
        style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 300 }}
      >
        Chargement…
      </div>
    );
  }
  if (!user) return <Navigate to="/" replace />;

  // Groupes de navigation Linear-like
  // `sub: true` → item indente visuellement, signale un sous-menu (ex: gabarits sous devis).
  type Item = {
    to: string;
    end?: boolean;
    label: string;
    icon: any;
    show: boolean;
    sub?: boolean;
    testId?: string;
  };
  // REFONTE-UX v2 (2026-08-08, retours Arnaud) — navigation en 4 groupes :
  //   Gestion commerciale = toute l activite client, de bout en bout (point 6 :
  //     les entrees de l ancien Atelier — devis, commandes, historique —
  //     rejoignent la gestion commerciale) + prix & marges + boutiques + users
  //   Catalogue   = referentiel produits (point 3 : le PIM vit ici) + gammes
  //     + bibliotheques + galerie des visuels Magrit (point 5 : conservee)
  //   Production  = parcs machine (RP#070826)
  //   Parametres  = espace + sous-espaces + roles + plan + mon compte
  const GROUPS: Array<{ title: string; items: Item[] }> = [
    {
      title: 'Gestion commerciale',
      items: [
        { to: `${basePath}/${QUOTES_ROUTE.path}`, end: true, label: QUOTES_NAVIGATION.label, icon: FileText, show: true },
        {
          to: `${basePath}/${PENDING_QUOTES_ROUTE.path}`,
          label: PENDING_QUOTES_NAVIGATION.label,
          icon: FileClock,
          show: true,
          sub: true,
        },
        {
          to: `${basePath}/${QUOTE_TEMPLATES_ROUTE.path}`,
          label: QUOTE_TEMPLATES_NAVIGATION.label,
          icon: LayoutTemplate,
          show: true,
          sub: true,
        },
        { to: `${basePath}/${ORDERS_ROUTE.path}`, label: ORDERS_NAVIGATION.label, icon: ShoppingBag, show: true },
        { to: `${basePath}/${CONVERSATIONS_ROUTE.path}`, label: CONVERSATIONS_NAVIGATION.label, icon: MessageSquare, show: true },
        {
          to: `${basePath}/${COMMERCIAL_ROUTE.path}`,
          label: COMMERCIAL_NAVIGATION.label,
          icon: BadgePercent,
          show: canManageMembers ?? false,
        },
        { to: `${basePath}/${SHOPS_ROUTE.path}`, label: SHOPS_NAVIGATION.label, icon: Store, show: canUse('shops') },
        { to: `${basePath}/${MEMBERS_ROUTE.path}`, label: MEMBERS_NAVIGATION.label, icon: Users, show: true, testId: MEMBERS_NAVIGATION.testId },
      ],
    },
    {
      title: 'Catalogue',
      items: [
        {
          to: `${basePath}/${CATALOG_PIM_ROUTE.path}`,
          label: CATALOG_PIM_NAVIGATION.label,
          icon: Shield,
          show: isAdmin || isSuperAdmin,
        },
        { to: `${basePath}/${CATALOG_GAMMES_ROUTE.path}`, label: CATALOG_GAMMES_NAVIGATION.label, icon: Layers, show: canManageMembers ?? false },
        { to: `${basePath}/${LIBRARIES_ROUTE.path}`, label: LIBRARIES_NAVIGATION.label, icon: Package, show: canUse('library') },
        {
          to: `${basePath}/${MOCKUPS_ROUTE.path}`,
          label: MOCKUPS_NAVIGATION.label,
          icon: ImageIcon,
          show: isAdmin || isSuperAdmin,
          sub: true,
        },
      ],
    },
    {
      title: 'Production',
      items: [
        { to: `${basePath}/${MACHINE_PARKS_ROUTE.path}`, label: MACHINE_PARKS_NAVIGATION.label, icon: Factory, show: canManageMembers ?? false },
      ],
    },
    {
      title: 'Paramètres',
      items: [
        { to: `${basePath}/${TENANT_SETTINGS_ROUTE.path}`, label: TENANT_SETTINGS_NAVIGATION.label, icon: Settings, show: canManageMembers ?? false },
        {
          to: `${basePath}/${TENANT_SPACES_ROUTE.path}`,
          label: TENANT_SPACES_NAVIGATION.label,
          icon: Building,
          show: canManageSpaces ?? false,
          sub: true,
        },
        // S-ORDER-ROLES-3-UI T4 — garde via useUserCapability('can_manage_roles')
        // cote composant ; on filtre aussi cote nav.
        { to: `${basePath}/${ROLES_ROUTE.path}`, label: ROLES_NAVIGATION.label, icon: Workflow, show: canManageMembers ?? false },
        { to: `${basePath}/plan`, label: 'Plan & abonnement', icon: CreditCard, show: true },
        {
          to: `${basePath}/${ACCOUNT_ROUTE.path}`,
          label: ACCOUNT_NAVIGATION.label,
          icon: User,
          show: true,
          testId: ACCOUNT_NAVIGATION.testId,
        },
      ],
    },
  ].map((g) => ({ ...g, items: g.items.filter((i) => i.show) }))
    .filter((g) => g.items.length > 0);

  // Breadcrumb extrait du path courant : "dashboard / segment"
  const segs = location.pathname.split('/').filter(Boolean);
  const activeLabel = GROUPS
    .flatMap((g) => g.items)
    .find((i) => i.to === location.pathname)?.label
    ?? segs.slice(1).map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(' / ')
    ?? 'Atelier';

  const displayName =
    (user.user_metadata?.full_name as string | undefined)?.trim() ||
    user.email?.split('@')[0] ||
    'Utilisateur';

  return (
    <div
      className="min-h-[calc(100vh-56px)] bg-bg text-ink grid"
      style={{
        fontFamily: 'var(--font-ui)',
        fontWeight: 300,
        gridTemplateColumns: '220px 1fr',
      }}
    >
      {/* ── SIDEBAR 220px ──────────────────────────────────────────────── */}
      <aside
        data-testid={TEST_IDS.nav.sidebar}
        // CORRECTIF 2026-08-08 (retour Arnaud : « le menu parc machine a
        // disparu ») — la fusion Atelier → Gestion commerciale a allonge le
        // premier groupe et les groupes du bas (Production, Parametres)
        // passaient sous le pli sans possibilite de defiler. La colonne est
        // desormais epinglee et defile independamment du contenu.
        className="border-r border-line bg-bg flex flex-col sticky top-[56px] h-[calc(100vh-56px)] overflow-y-auto px-2.5 py-3"
      >
        {/* Brand header */}
        <div className="flex items-center gap-2 px-2.5 py-2 mb-2">
          <MagritLogo size={22} radius={6} />
          <span
            className="text-ink"
            style={{ fontSize: '14px', fontWeight: 500, letterSpacing: '-0.005em' }}
          >
            Magrit
          </span>
          <span
            className="ml-auto font-mono text-ink-mute-2 px-1.5 py-0.5 rounded bg-paper border border-line"
            style={{ fontSize: '10.5px', fontWeight: 500, letterSpacing: '0.04em' }}
            title={`Plan ${PLAN_LABEL[plan]}`}
          >
            {PLAN_LABEL[plan].toUpperCase()}
          </span>
        </div>

        {/* Nav groups */}
        {GROUPS.map((group, gi) => (
          <div key={group.title} className={gi > 0 ? 'mt-4' : ''}>
            <div
              data-testid={NAV_GROUP_TESTIDS[group.title]}
              className="font-mono uppercase text-ink-mute-2 px-2.5 py-1.5"
              style={{
                fontSize: '10.5px',
                letterSpacing: '0.08em',
                fontWeight: 500,
              }}
            >
              {group.title}
            </div>
            <nav className="flex flex-col gap-px">
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  data-testid={item.testId ?? NAV_LINK_TESTIDS[item.label]}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 py-1.5 rounded-md transition-colors ${
                      item.sub ? 'pl-7 pr-2.5' : 'px-2.5'
                    } ${
                      isActive
                        ? 'bg-line text-ink'
                        : 'text-ink-2 hover:bg-line/60 hover:text-ink'
                    }`
                  }
                  style={{ fontSize: item.sub ? '13px' : '13.5px', fontWeight: 400 }}
                >
                  <item.icon
                    className={`shrink-0 ${item.sub ? 'w-3.5 h-3.5' : 'w-4 h-4'}`}
                    strokeWidth={1.5}
                  />
                  <span className="truncate">{item.label}</span>
                </NavLink>
              ))}
            </nav>
          </div>
        ))}

        {/* Footer : avatar user */}
        <div className="mt-auto pt-3 border-t border-line flex items-center gap-2.5 px-2.5 py-2">
          <div
            className="w-6 h-6 rounded-full bg-line-2 grid place-items-center text-ink"
            style={{ fontSize: '11px', fontWeight: 500 }}
          >
            {displayName[0]?.toUpperCase() ?? 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-ink" style={{ fontSize: '12.5px', fontWeight: 400 }}>
              {displayName}
            </p>
            <p
              className="truncate text-ink-mute-2 font-mono"
              style={{ fontSize: '10.5px', letterSpacing: '0.02em' }}
            >
              {user.email}
            </p>
          </div>
        </div>
      </aside>

      {/* ── MAIN ─────────────────────────────────────────────────────────── */}
      <main className="flex flex-col bg-paper min-w-0">
        {/* Topbar discret : breadcrumb mono */}
        <div className="flex items-center gap-3 px-7 py-3 border-b border-line">
          <span
            className="font-mono text-ink-mute-2"
            style={{ fontSize: '11px', fontWeight: 400, letterSpacing: '0.04em' }}
          >
            Magrit / <span className="text-ink" style={{ fontWeight: 500 }}>{activeLabel}</span>
          </span>
        </div>

        {/* Content panel — padding par defaut pour pages existantes.
            Les pages peuvent override avec leur propre layout si besoin. */}
        <div className="flex-1 min-w-0 px-7 py-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
