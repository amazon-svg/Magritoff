import { Navigate, NavLink, Outlet, useLocation } from 'react-router';
import {
  User, Settings, MessageSquare, FileText, ShoppingBag, Users,
  CreditCard, Package, Store, Shield, LayoutTemplate, Building, Layers,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { usePlan } from '../../hooks/usePlan';
import { useIsAdmin } from '../../hooks/useIsAdmin';
import { useTenant } from '../../contexts/TenantContext';
import { PLAN_LABEL } from '../../utils/plans';
import { MagritLogo } from '../brand/MagritLogo';

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

  const canManageMembers = currentRole === 'owner' || currentRole === 'admin';
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
  };
  const GROUPS: Array<{ title: string; items: Item[] }> = [
    {
      title: 'Atelier',
      items: [
        { to: `${basePath}`, end: true, label: 'Profil', icon: User, show: true },
        { to: `${basePath}/history`, label: 'Historique', icon: MessageSquare, show: true },
        { to: `${basePath}/quotes`, label: 'Devis', icon: FileText, show: true },
        {
          to: `${basePath}/quote-templates`,
          label: 'Gabarits de devis',
          icon: LayoutTemplate,
          show: true,
          sub: true,
        },
        { to: `${basePath}/orders`, label: 'Commandes', icon: ShoppingBag, show: true },
        { to: `${basePath}/users`, label: 'Utilisateurs', icon: Users, show: true },
        { to: `${basePath}/shops`, label: 'Boutiques', icon: Store, show: canUse('shops') },
        {
          to: `${basePath}/library`,
          label: 'Bibliothèques',
          icon: Package,
          show: canUse('library'),
          sub: true,
        },
      ],
    },
    {
      title: 'Équipe',
      items: [
        { to: `${basePath}/spaces`, label: 'Sous-espaces', icon: Building, show: canManageSpaces ?? false },
      ],
    },
    {
      title: 'Config',
      items: [
        { to: `${basePath}/plan`, label: 'Plan & abonnement', icon: CreditCard, show: true },
        { to: `${basePath}/preferences`, label: 'Préférences', icon: Settings, show: true },
      ],
    },
    {
      title: 'Admin PIM',
      items: [
        {
          to: `${basePath}/admin/pim`,
          label: 'PIM global',
          icon: Shield,
          show: isAdmin || isSuperAdmin,
        },
        {
          to: `${basePath}/gammes`,
          label: 'Gammes actives',
          icon: Layers,
          show: canManageMembers ?? false,
          sub: true,
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
    ?? 'Profil';

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
        className="border-r border-line bg-bg flex flex-col min-h-[calc(100vh-56px)] px-2.5 py-3"
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
