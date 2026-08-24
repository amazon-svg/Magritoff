import type { ReactNode } from 'react';
import { Navigate } from 'react-router';
import { useAccessProfile } from '@/modules/roles/ui/runtime';
import { useTenant } from '@/modules/tenants/ui/runtime';

export function WorkspaceCapabilityGate({
  requiredCapabilities,
  children,
}: Readonly<{ requiredCapabilities: readonly string[]; children: ReactNode }>) {
  const { currentTenant } = useTenant();
  const { loading, hasCapability } = useAccessProfile();

  if (loading) {
    return <div className="py-12 text-center text-sm text-ink-muted">Chargement des droits…</div>;
  }

  const allowed = requiredCapabilities.every((capability) => hasCapability(capability) === true);
  if (!allowed) {
    const slug = currentTenant?.slug;
    return <Navigate to={slug ? `/t/${slug}/dashboard/quotes` : '/tenants'} replace />;
  }
  return <>{children}</>;
}
