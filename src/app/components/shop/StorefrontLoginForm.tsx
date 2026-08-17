import { useState, type FormEvent } from 'react';
import { Loader2, Lock } from 'lucide-react';
import { Link } from 'react-router';
import type { StorefrontSession } from '../../../modules/shop-customers';
import { useStorefrontIdentityApi } from '../../contexts/ModuleClientsContext';
import { TEST_IDS } from '../../lib/testIds';

type Props = Readonly<{
  shopSlug: string;
  contactEmail?: string | null;
  onAuthenticated(session: StorefrontSession): void;
}>;

const inputClass = 'w-full rounded-md border border-line-2 bg-paper px-3 py-2 text-[13px] text-ink focus:outline-none focus:ring-2 focus:ring-accent';

export function StorefrontLoginForm({ shopSlug, contactEmail, onAuthenticated }: Props) {
  const api = useStorefrontIdentityApi();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onAuthenticated(await api.authenticate(shopSlug, { email, password }));
    } catch {
      setError('Connexion impossible : vérifiez votre email et votre mot de passe.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="grid grid-cols-1 gap-3 text-left" onSubmit={submit}>
      <div>
        <p className="m-0 text-sm font-semibold text-ink">Connexion à cette boutique</p>
        <p className="mt-1 mb-0 text-xs text-ink-muted">
          Ce compte est indépendant de votre accès Magrit et de ses espaces.
        </p>
      </div>
      <label className="flex flex-col gap-1 text-sm font-medium text-ink-2">
        Email
        <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} autoComplete="email" data-testid={TEST_IDS.shop.checkoutEmailInput} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-ink-2">
        Mot de passe
        <input type="password" required minLength={8} maxLength={1024} value={password} onChange={(event) => setPassword(event.target.value)} className={inputClass} autoComplete="current-password" data-testid={TEST_IDS.shop.checkoutPasswordInput} />
      </label>
      {error && <p role="alert" className="m-0 rounded-md bg-err-bg px-3 py-2 text-sm text-err-fg">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" data-testid={TEST_IDS.shop.checkoutAuthBtn} disabled={busy} className="inline-flex items-center gap-2 rounded-md bg-ink px-4 py-2 text-[13px] font-medium text-paper disabled:opacity-50">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
          Se connecter
        </button>
        {contactEmail && (
          <a data-testid={TEST_IDS.shop.checkoutRequestAccess} href={`mailto:${contactEmail}?subject=${encodeURIComponent('Demande d’accès à la boutique')}`} className="text-[12.5px] text-ink-muted hover:text-ink hover:underline">
            Demander un accès
          </a>
        )}
        <Link to="/tenants" className="text-[12.5px] text-ink-muted hover:text-ink hover:underline">
          Accéder à mes espaces Magrit
        </Link>
      </div>
    </form>
  );
}
