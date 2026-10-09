import { useState } from 'react';
import { Button } from '@/shared/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetDescription, SheetTrigger } from '@/shared/ui/sheet';
import { useIsMobile } from '@/shared/ui/use-mobile';
import { Navigate, NavLink, Outlet, useLocation } from 'react-router';
import {
  Menu, User, Settings, MessageSquare, FileText, ShoppingBag, Users,
  CreditCard, Package, Store, Shield, LayoutTemplate, Building, Layers, Workflow,
  FileClock, BadgePercent, Percent, Factory, Image as ImageIcon, FolderKanban, Bell, type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/modules/account/ui/runtime';
import { usePlan } from '@/modules/plans/ui/hooks';
import { useIsAdmin } from '@/modules/roles/ui/hooks';
import { useTenant } from '@/modules/tenants/ui/runtime';
import { PLAN_LABEL } from '@/modules/plans/ui/helpers';
import { MagritLogo } from '@/shared/presentation/MagritLogo';
import { TEST_IDS } from '@/shared/presentation/testIds';
import { workspaceSurface } from '@/surfaces/workspace';
import { useAccessProfile } from '@/modules/roles/ui/runtime';

const WORKSPACE_ICONS: Readonly<Record<string, LucideIcon>> = Object.freeze({
  user: User,
  settings: Settings,
  'message-square': MessageSquare,
  'file-text': FileText,
  'shopping-bag': ShoppingBag,
  users: Users,
  'credit-card': CreditCard,
  package: Package,
  store: Store,
  shield: Shield,
  'layout-template': LayoutTemplate,
  building: Building,
  layers: Layers,
  workflow: Workflow,
  'file-clock': FileClock,
  'badge-percent': BadgePercent,
  percent: Percent,
  factory: Factory,
  image: ImageIcon,
  'folder-kanban': FolderKanban,
  bell: Bell,
});

const WORKSPACE_GROUPS = [
  { id: 'commercial', title: 'Gestion commerciale', testId: TEST_IDS.nav.sidebarAtelierLink },
  { id: 'catalog', title: 'Catalogue' },
  { id: 'production', title: 'Production' },
  { id: 'settings', title: 'Paramètres', testId: TEST_IDS.nav.sidebarConfigLink },
] as const;

const WORKSPACE_ROUTES_BY_ID = new Map(workspaceSurface.routes.map((route) => [route.id, route]));

type WorkspaceNavItem = Readonly<{
  to: string;
  end?: boolean;
  label: string;
  icon: LucideIcon;
  sub?: boolean;
  testId?: string;
}>;

type WorkspaceVisibility = Readonly<{
  isTenantAdmin: boolean;
  canManageMembers: boolean;
  canManageSpaces: boolean;
  isMagritAdmin: boolean;
  canUse: (feature: 'shops' | 'library') => boolean;
  hasCapability: (capability: string) => boolean;
}>;

function composeWorkspaceGroups(basePath: string, visibility: WorkspaceVisibility) {
  return WORKSPACE_GROUPS.map((group) => ({
    ...group,
    items: workspaceSurface.navigation
      .filter((item) => item.groupId === group.id && isNavigationVisible(item.id, visibility))
      .map((item): WorkspaceNavItem => {
        const route = WORKSPACE_ROUTES_BY_ID.get(item.routeId);
        const icon = WORKSPACE_ICONS[item.iconId];
        if (!route || !icon) {
          throw new Error(`Contribution workspace incomplète pour ${item.id}.`);
        }
        return {
          to: `${basePath}/${route.path}`,
          end: item.exact,
          label: item.label,
          icon,
          sub: item.nested,
          testId: item.testId,
        };
      }),
  })).filter((group) => group.items.length > 0);
}

function isNavigationVisible(id: string, visibility: WorkspaceVisibility): boolean {
  const item = workspaceSurface.navigation.find((candidate) => candidate.id === id);
  const route = item ? WORKSPACE_ROUTES_BY_ID.get(item.routeId) : undefined;
  if (route?.requiredTenantRole === 'admin' && !visibility.isTenantAdmin) return false;
  if (route && !(route.requiredCapabilities ?? []).every(visibility.hasCapability)) return false;
  if (id === 'shops.workspace.navigation') return visibility.canUse('shops');
  if (id === 'libraries.workspace.navigation') return visibility.canUse('library');
  if (id === 'catalog.workspace.pim-navigation' || id === 'mockups.workspace.navigation') {
    return visibility.isMagritAdmin;
  }
  if (id === 'tenants.workspace.spaces-navigation') return visibility.canManageSpaces;
  if ([
    'commercial.workspace.navigation',
    'catalog.workspace.gammes-navigation',
    'machine-parks.workspace.navigation',
    'tenants.workspace.settings-navigation',
    'roles.workspace.navigation',
  ].includes(id)) return visibility.canManageMembers;
  return true;
}

// Design source : .design-handoff/designs/04 - Admin dashboard.html
// Layout : Linear-dense — sidebar 220px + main, typo Helvetica Neue 300/400/500.
export function DashboardLayout() {
  const isMobile = useIsMobile();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { user, loading } = useAuth();
  const { plan, canUse } = usePlan();
  const isAdmin = useIsAdmin();
  const { currentTenant, currentRole, isSuperAdmin } = useTenant();
  const location = useLocation();
  const { hasCapability } = useAccessProfile();

  // Raccourci : tenantSlug extrait du path courant pour construire les `to` absolus.
  // On prefere absolus pour que la NavLink active-match fonctionne sans surprise.
  const tenantSlug = currentTenant?.slug ?? '';
  const basePath = `/t/${tenantSlug}/dashboard`;

  const canManageMembers = currentRole === 'admin' || isSuperAdmin;
  const canManageSpaces = canManageMembers && !!currentTenant && !currentTenant.parent_tenant_id;

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

  const GROUPS = composeWorkspaceGroups(basePath, {
    isTenantAdmin: canManageMembers,
    canManageMembers,
    canManageSpaces,
    isMagritAdmin: isAdmin || isSuperAdmin,
    canUse,
    hasCapability: (capability) => hasCapability(capability) === true,
  });

  // Breadcrumb extrait du path courant : "dashboard / segment"
  const segs = location.pathname.split('/').filter(Boolean);
  const activeLabel = GROUPS
    .flatMap((g) => g.items)
    .find((i) => i.to === location.pathname)?.label
    ?? (location.pathname.startsWith(`${basePath}/shops/`)
      ? 'Boutiques / Réglages'
      : segs.slice(1).map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(' / '))
    ?? 'Atelier';

  const displayName =
    (user.user_metadata?.full_name as string | undefined)?.trim() ||
    user.email?.split('@')[0] ||
    'Utilisateur';

  const sidebar = <>
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
            className="ml-auto font-mono text-ink-muted px-1.5 py-0.5 rounded bg-paper border border-line"
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
              data-testid={group.testId}
              className="font-mono uppercase text-ink-muted px-2.5 py-1.5"
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
                  data-testid={item.testId}
                  to={item.to}
                  end={item.end}
                  onClick={() => setMobileNavOpen(false)}
                  className={({ isActive }) =>
                    `flex min-h-11 md:min-h-0 items-center gap-2.5 py-1.5 rounded-md transition-colors ${
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
              className="truncate text-ink-muted font-mono"
              style={{ fontSize: '10.5px', letterSpacing: '0.02em' }}
            >
              {user.email}
            </p>
          </div>
        </div>
  </>;

  return (
    <Sheet open={isMobile && mobileNavOpen} onOpenChange={setMobileNavOpen}>
    <div
      className="min-h-[calc(100vh-56px)] bg-bg text-ink grid grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)]"
      style={{
        fontFamily: 'var(--font-ui)',
        fontWeight: 300,
      }}
    >
      {isMobile ? (
        <SheetContent side="left" className="w-full max-w-sm overflow-y-auto bg-bg px-3 py-4 text-ink">
          <SheetTitle className="sr-only">Navigation du back-office</SheetTitle>
          <SheetDescription className="sr-only">Choisissez une rubrique de votre espace.</SheetDescription>
          <div data-testid={TEST_IDS.nav.sidebar} className="flex min-h-full flex-col">{sidebar}</div>
        </SheetContent>
      ) : (
        <aside data-testid={TEST_IDS.nav.sidebar} className="sticky top-[56px] flex h-[calc(100vh-56px)] flex-col overflow-y-auto border-r border-line bg-bg px-2.5 py-3">{sidebar}</aside>
      )}


      {/* ── MAIN ─────────────────────────────────────────────────────────── */}
      <main className="flex flex-col bg-paper min-w-0">
        {/* Topbar discret : breadcrumb mono */}
        <div className="flex min-w-0 items-center gap-3 px-4 py-3 sm:px-7 border-b border-line">
          {isMobile && <SheetTrigger asChild><Button variant="outline" size="icon" className="min-h-11 min-w-11" aria-label="Ouvrir le menu du back-office"><Menu /></Button></SheetTrigger>}
          <span
            className="min-w-0 break-words font-mono text-ink-muted"
            style={{ fontSize: '11px', fontWeight: 400, letterSpacing: '0.04em' }}
          >
            Magrit / <span className="text-ink" style={{ fontWeight: 500 }}>{activeLabel}</span>
          </span>
        </div>

        {/* Content panel — padding par defaut pour pages existantes.
            Les pages peuvent override avec leur propre layout si besoin. */}
        <div className="flex-1 min-w-0 px-4 py-6 sm:px-7">
          <Outlet />
        </div>
      </main>
    </div>
    </Sheet>
  );
}
