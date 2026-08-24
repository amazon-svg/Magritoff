import { Loader2, Lock, UserPlus } from 'lucide-react';
import type { StorefrontSession } from '@/modules/shop-customers';
import { TEST_IDS } from '@/shared/presentation/testIds';
import { useStorefrontIdentityForm } from '@/modules/shop-customers/ui/hooks/useStorefrontIdentityForm';

type Props = Readonly<{
  shopSlug: string;
  contactEmail?: string | null;
  allowRegistration?: boolean;
  onAuthenticated(session: StorefrontSession): void;
}>;

const inputClass = 'w-full rounded-md border border-line-2 bg-paper px-3 py-2 text-[13px] text-ink focus:outline-none focus:ring-2 focus:ring-accent';

export function StorefrontLoginForm({ shopSlug, contactEmail, allowRegistration = false, onAuthenticated }: Props) {
  const {
    mode, setMode, fullName, setFullName, email, setEmail, password, setPassword,
    busy, error, recoveryRequested, submit,
  } = useStorefrontIdentityForm(shopSlug, onAuthenticated);

  return (
    <form className="grid grid-cols-1 gap-3 text-left" onSubmit={submit}>
      <div>
        <p className="m-0 text-sm font-semibold text-ink">
          {mode === 'registration' ? 'Créer votre compte boutique' : mode === 'recovery' ? 'Mot de passe oublié' : 'Connexion à cette boutique'}
        </p>
        <p className="mt-1 mb-0 text-xs text-ink-muted">
          Ce compte est indépendant de votre accès Magrit et de ses espaces.
        </p>
      </div>
      {recoveryRequested && mode === 'recovery' ? (
        <div role="status" className="rounded-md bg-ok-bg px-3 py-3 text-sm text-ok-fg">
          Si un compte actif correspond à cet email dans cette boutique, un lien valable une heure vient d’être envoyé.
        </div>
      ) : <>
      {allowRegistration && (
        <div className="grid grid-cols-2 rounded-md border border-line p-1" role="tablist" aria-label="Accès à la boutique">
          <button type="button" role="tab" aria-selected={mode === 'login'} data-testid={TEST_IDS.shop.checkoutLoginTab} onClick={() => setMode('login')} className={`rounded px-3 py-1.5 text-xs font-medium ${mode === 'login' ? 'bg-ink text-paper' : 'text-ink-muted'}`}>
            Se connecter
          </button>
          <button type="button" role="tab" aria-selected={mode === 'registration'} data-testid={TEST_IDS.shop.checkoutRegisterTab} onClick={() => setMode('registration')} className={`rounded px-3 py-1.5 text-xs font-medium ${mode === 'registration' ? 'bg-ink text-paper' : 'text-ink-muted'}`}>
            Créer un compte
          </button>
        </div>
      )}
      {mode === 'registration' && (
        <label className="flex flex-col gap-1 text-sm font-medium text-ink-2">
          Nom complet
          <input type="text" required minLength={1} maxLength={200} value={fullName} onChange={(event) => setFullName(event.target.value)} className={inputClass} autoComplete="name" data-testid={TEST_IDS.shop.checkoutFullNameInput} />
        </label>
      )}
      <label className="flex flex-col gap-1 text-sm font-medium text-ink-2">
        Email
        <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} autoComplete="email" data-testid={TEST_IDS.shop.checkoutEmailInput} />
      </label>
      {mode !== 'recovery' && <label className="flex flex-col gap-1 text-sm font-medium text-ink-2">
        Mot de passe
        <input type="password" required minLength={8} maxLength={1024} value={password} onChange={(event) => setPassword(event.target.value)} className={inputClass} autoComplete={mode === 'registration' ? 'new-password' : 'current-password'} data-testid={TEST_IDS.shop.checkoutPasswordInput} />
      </label>}
      {error && <p role="alert" className="m-0 rounded-md bg-err-bg px-3 py-2 text-sm text-err-fg">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" data-testid={TEST_IDS.shop.checkoutAuthBtn} disabled={busy} className="inline-flex items-center gap-2 rounded-md bg-ink px-4 py-2 text-[13px] font-medium text-paper disabled:opacity-50">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : mode === 'registration' ? <UserPlus className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
          {mode === 'registration' ? 'Créer et continuer' : mode === 'recovery' ? 'Recevoir le lien' : 'Se connecter'}
        </button>
        {contactEmail && (
          <a data-testid={TEST_IDS.shop.checkoutRequestAccess} href={`mailto:${contactEmail}?subject=${encodeURIComponent('Demande d’accès à la boutique')}`} className="text-[12.5px] text-ink-muted hover:text-ink hover:underline">
            Demander un accès
          </a>
        )}
      </div>
      </>}
      {mode === 'login' && (
        <button type="button" onClick={() => setMode('recovery')} className="w-fit text-[12.5px] text-ink-muted hover:text-ink hover:underline">
          Mot de passe oublié ?
        </button>
      )}
      {mode === 'recovery' && (
        <button type="button" onClick={() => setMode('login')} className="w-fit text-[12.5px] text-ink-muted hover:text-ink hover:underline">
          Revenir à la connexion
        </button>
      )}
    </form>
  );
}
