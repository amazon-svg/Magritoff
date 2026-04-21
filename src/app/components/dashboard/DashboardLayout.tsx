import { Navigate, NavLink, Outlet } from 'react-router';
import { User, Settings, MessageSquare, FileText, ShoppingBag, Users, CreditCard, Package, Store, Shield } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { usePlan } from '../../hooks/usePlan';
import { useIsAdmin } from '../../hooks/useIsAdmin';
import { PLAN_LABEL } from '../../utils/plans';

export function DashboardLayout() {
  const { user, loading } = useAuth();
  const { plan, canUse } = usePlan();
  const isAdmin = useIsAdmin();

  if (loading) {
    return <div className="px-6 py-12 text-center text-gray-500">Chargement...</div>;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  const NAV = [
    { to: '/dashboard', end: true, label: 'Profil', icon: User, show: true },
    { to: '/dashboard/plan', label: 'Plan & abonnement', icon: CreditCard, show: true },
    { to: '/dashboard/preferences', label: 'Préférences', icon: Settings, show: true },
    { to: '/dashboard/history', label: 'Historique', icon: MessageSquare, show: true },
    { to: '/dashboard/quotes', label: 'Devis', icon: FileText, show: true },
    { to: '/dashboard/orders', label: 'Commandes', icon: ShoppingBag, show: true },
    { to: '/dashboard/clients', label: 'Clients', icon: Users, show: true },
    { to: '/dashboard/library', label: 'Bibliothèque', icon: Package, show: canUse('library') },
    { to: '/dashboard/shops', label: 'Boutiques', icon: Store, show: canUse('shops') },
    { to: '/dashboard/admin/pim', label: 'Admin PIM', icon: Shield, show: isAdmin },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
        <span className="text-xs font-semibold bg-gray-900 text-white px-3 py-1 rounded-full">
          Plan {PLAN_LABEL[plan]}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6">
        <aside className="bg-white border border-gray-200 rounded-xl p-2 h-fit">
          <nav className="flex flex-col">
            {NAV.filter((item) => item.show).map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'
                  }`
                }
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <section className="bg-white border border-gray-200 rounded-xl p-6 min-h-[400px]">
          <Outlet />
        </section>
      </div>
    </div>
  );
}
