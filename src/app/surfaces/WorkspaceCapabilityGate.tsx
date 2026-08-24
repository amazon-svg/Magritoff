import type { ReactNode } from 'react';
import { Navigate } from 'react-router';
import { useAccessProfile } from '@/modules/roles/ui/runtime';
import { useTenant } from '@/modules/tenants/ui/runtime';

export function WorkspaceCapabilityGate({
  requiredCapabilities,
  requiredTenantRole,
  children,
}: Readonly<{
  requiredCapabilities: readonly string[];
  requiredTenantRole?: 'admin';
  children: ReactNode;
}>) {
  const { currentTenant, currentRole, isSuperAdmin } = useTenant();
  const { loading, hasCapability } = useAccessProfile();

  if (loading) {
    return <div className="py-12 text-center text-sm text-ink-muted">Chargement des droits…</div>;
  }

  const hasRequiredRole = requiredTenantRole === undefined
    || currentRole === requiredTenantRole
    || isSuperAdmin;
  const allowed = hasRequiredRole
    && requiredCapabilities.every((capability) => hasCapability(capability) === true);
  if (!allowed) {
    const slug = currentTenant?.slug;
    return <Navigate to={slug ? `/t/${slug}/dashboard/quotes` : '/tenants'} replace />;
  }
  return <>{children}</>;
}
