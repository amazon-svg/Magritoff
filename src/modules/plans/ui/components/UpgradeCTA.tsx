import { Link } from 'react-router';
import { Lock, Sparkles } from 'lucide-react';
import { useTenantPath } from '@/modules/tenants/ui/hooks';

interface Props {
  feature: string;
}

export function UpgradeCTA({ feature }: Props) {
  const tp = useTenantPath();
  return (
    <div className="max-w-lg mx-auto text-center py-12">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-100 text-warn-fg mb-4">
        <Lock className="w-6 h-6" />
      </div>
      <h2 className="text-xl font-bold text-ink mb-2">{feature}</h2>
      <p className="text-sm text-ink-muted mb-6">
        Cette fonctionnalité est réservée aux abonnements <strong>Pro</strong> et{' '}
        <strong>Enterprise</strong>.
      </p>
      <Link
        to={tp('/dashboard/plan')}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand text-white rounded-lg hover:bg-brand/90 font-medium"
      >
        <Sparkles className="w-4 h-4" />
        Passer au plan Pro
      </Link>
    </div>
  );
}
