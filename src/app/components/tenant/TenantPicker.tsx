/**
 * TenantPicker
 * ────────────
 * Page /tenants : liste des tenants accessibles + raccourci "creer un tenant".
 *
 * Premier ecran apres login quand l'user est membre de plusieurs tenants (ex:
 * un commercial d'une imprimerie ET un admin d'un sous-tenant client). Cliquer
 * sur un tenant redirige vers /t/:slug.
 *
 * Affiche aussi une section dediee aux sous-tenants visibles par heritage
 * (l'admin d'un tenant racine voit les sous-tenants de ses enfants).
 */

import { Link, Navigate } from 'react-router';
import { Building2, Plus, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { MagritLogo } from '../brand/MagritLogo';
import { TEST_IDS } from '../../lib/testIds';

export function TenantPicker() {
  const { user, loading: authLoading } = useAuth();
  const { tenants, isSuperAdmin, loading } = useTenant();

  if (authLoading || loading) {
    return (
      <div
        className="min-h-[calc(100vh-56px)] grid place-items-center bg-bg text-ink-muted"
        style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 300 }}
      >
        Chargement…
      </div>
    );
  }

  if (!user) {
    // L'app expose deja un modal de login via UnauthBanner. En attendant, on
    // reste sur la page (pas de redirection aggressive tant qu'auth est un module
    // a part entiere).
    return (
      <div className="min-h-[calc(100vh-56px)] grid place-items-center">
        <div className="text-center">
          <MagritLogo size={64} />
          <p
            className="mt-4 text-ink-muted"
            style={{ fontSize: '14px', fontWeight: 300 }}
          >
            Connectez-vous pour acceder a vos espaces.
          </p>
        </div>
      </div>
    );
  }

  // Aucun tenant → onboarding
  if (tenants.length === 0) {
    return <Navigate to="/tenants/new" replace />;
  }

  const directTenants = tenants.filter((t) => !t.inheritedFromParent);
  const inheritedTenants = tenants.filter((t) => t.inheritedFromParent);

  return (
    <div
      data-testid={TEST_IDS.nav.tenantSwitcher}
      className="min-h-[calc(100vh-56px)] bg-bg px-6 py-10"
      style={{ fontFamily: 'var(--font-ui)' }}
    >
      <div className="max-w-4xl mx-auto">
        <div className="flex items-baseline justify-between gap-4 mb-8">
          <div>
            <h1
              className="text-ink m-0"
              style={{
                fontWeight: 200,
                fontSize: '42px',
                letterSpacing: '-0.03em',
                lineHeight: 1.05,
              }}
            >
              Mes espaces
            </h1>
            <p
              className="mt-2 text-ink-muted max-w-xl"
              style={{ fontSize: '15px', fontWeight: 300, lineHeight: 1.5 }}
            >
              Selectionnez l'espace sur lequel travailler. Chaque espace a ses
              propres devis, clients, boutiques et bibliotheques.
            </p>
          </div>
          <Link
            to="/tenants/new"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-ink text-paper hover:bg-black shrink-0"
            style={{ fontSize: '13.5px', fontWeight: 500 }}
          >
            <Plus className="w-4 h-4" strokeWidth={1.8} />
            Nouvel espace
          </Link>
        </div>

        {isSuperAdmin && (
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-md bg-warn-bg text-warn-fg mb-6"
            style={{ fontSize: '12.5px', fontWeight: 500 }}
          >
            <ShieldCheck className="w-3.5 h-3.5" strokeWidth={1.8} />
            Mode superadmin Magrit actif — vous avez acces a tous les tenants.
          </div>
        )}

        <Section title="Mes espaces directs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {directTenants.map((t) => (
              <TenantCard key={t.id} tenant={t} />
            ))}
          </div>
        </Section>

        {inheritedTenants.length > 0 && (
          <Section
            title="Sous-espaces"
            subtitle="Espaces crees sous un de vos tenants parents (vous y avez acces par heritage)"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {inheritedTenants.map((t) => (
                <TenantCard key={t.id} tenant={t} />
              ))}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-8">
      <div className="flex items-baseline justify-between mb-3">
        <h2
          className="text-ink m-0"
          style={{
            fontWeight: 300,
            fontSize: '20px',
            letterSpacing: '-0.02em',
          }}
        >
          {title}
        </h2>
        {subtitle && (
          <span className="text-ink-mute-2" style={{ fontSize: '12px', fontWeight: 300 }}>
            {subtitle}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function TenantCard({
  tenant,
}: {
  tenant: ReturnType<typeof useTenant>['tenants'][number];
}) {
  return (
    <Link
      to={`/t/${tenant.slug}`}
      className="block p-4 rounded-md border border-line bg-paper hover:border-line-2 transition-colors"
    >
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-md bg-bg border border-line grid place-items-center shrink-0"
          aria-hidden
        >
          <Building2 className="w-5 h-5 text-ink-muted" strokeWidth={1.5} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span
              className="text-ink truncate"
              style={{ fontSize: '14.5px', fontWeight: 500 }}
            >
              {tenant.name}
            </span>
            {tenant.is_system_tenant && (
              <span
                className="inline-flex items-center px-1.5 py-0.5 rounded bg-brand text-brand-ink font-mono"
                style={{ fontSize: '9.5px', letterSpacing: '0.04em', fontWeight: 600 }}
              >
                SYSTEM
              </span>
            )}
          </div>
          <div
            className="font-mono text-ink-mute-2"
            style={{ fontSize: '11.5px', letterSpacing: '0.02em' }}
          >
            /{tenant.slug} · {tenant.myRole.toUpperCase()}
            {tenant.inheritedFromParent && ' · herite'}
          </div>
        </div>
      </div>
    </Link>
  );
}
