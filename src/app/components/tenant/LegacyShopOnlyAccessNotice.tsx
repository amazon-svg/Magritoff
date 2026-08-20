/**
 * État transitoire réservé aux anciennes memberships `shop_only`.
 *
 * Une identité Magrit historique ne constitue plus une session storefront.
 * Cette vue ferme donc l'accès au catalogue jusqu'à l'activation d'un compte
 * boutique autonome par l'administrateur de la boutique.
 */

import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { TEST_IDS } from '../../lib/testIds';

export function LegacyShopOnlyAccessNotice() {
  const { signOut } = useAuth();

  return (
    <div
      data-testid={TEST_IDS.tenant.legacyShopOnlyNotice}
      className="min-h-screen grid place-items-center bg-bg px-6"
      style={{ fontFamily: 'var(--font-ui)' }}
    >
      <div className="w-full max-w-lg rounded-md border border-line bg-paper p-8 text-center">
        <ShieldAlert className="mx-auto mb-4 h-10 w-10 text-warn-fg" strokeWidth={1.5} />
        <h1 className="m-0 text-2xl font-medium text-ink">Activation boutique nécessaire</h1>
        <p className="mt-3 text-sm leading-6 text-ink-muted">
          Votre ancien accès a été conservé pendant la migration, mais il ne
          permet plus d’ouvrir automatiquement une boutique. Demandez à
          l’administrateur de la boutique de vous transmettre un lien
          d’activation pour votre compte client.
        </p>
        <p className="mt-3 text-xs leading-5 text-ink-mute-2">
          Le compte boutique est indépendant de votre ancien accès Magrit.
        </p>
        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-6 inline-flex items-center justify-center rounded-md border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-bg"
        >
          Se déconnecter
        </button>
      </div>
    </div>
  );
}
