import { LogOut, ShieldCheck } from 'lucide-react';
import type { StorefrontSession } from '@/modules/shop-customers';

type Props = Readonly<{
  session: StorefrontSession;
  ending: boolean;
  onEnd(): void;
}>;

export function StorefrontDelegationBanner({ session, ending, onEnd }: Props) {
  if (session.identity.kind !== 'delegated_shop_customer') return null;
  return (
    <aside className="sticky top-0 z-[100] flex flex-wrap items-center justify-between gap-3 border-b border-amber-300 bg-amber-50 px-4 py-2 text-amber-950 shadow-sm">
      <p className="m-0 flex items-center gap-2 text-sm">
        <ShieldCheck className="h-4 w-4" />
        <span>
          <strong>Mode délégué</strong> — vous consultez cette boutique comme {session.customer.fullName}.
          Vos actions restent attribuées à votre compte Magrit.
        </span>
      </p>
      <button
        type="button"
        disabled={ending}
        onClick={onEnd}
        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-xs font-medium disabled:opacity-50"
      >
        <LogOut className="h-3.5 w-3.5" />
        {ending ? 'Fermeture…' : 'Quitter ce mode'}
      </button>
    </aside>
  );
}
