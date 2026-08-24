import { CheckCircle2, Loader2, LockKeyhole } from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router';
import { useStorefrontCredentialSetup } from '@/modules/shop-customers/ui/hooks/useStorefrontCredentialSetup';

export function StorefrontPasswordResetPage() {
  const { slug = '' } = useParams();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const { password, setPassword, confirmation, setConfirmation, busy, done, error, submit } =
    useStorefrontCredentialSetup({ token, kind: 'recovery' });
  return <main className="min-h-screen bg-bg px-4 py-12 grid place-items-center">
    <section className="w-full max-w-md rounded-2xl border border-line bg-paper p-6 shadow-sm">
      <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-xl bg-ink text-paper">{done ? <CheckCircle2 className="h-5 w-5" /> : <LockKeyhole className="h-5 w-5" />}</div>
      {done ? <><h1 className="text-2xl font-semibold text-ink">Mot de passe modifié</h1><p className="mt-2 text-sm text-ink-muted">Toutes les anciennes sessions de ce compte boutique ont été fermées.</p><Link to={`/shop/${encodeURIComponent(slug)}`} className="mt-6 inline-flex w-full justify-center rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-paper">Se connecter à la boutique</Link></>
        : <><h1 className="text-2xl font-semibold text-ink">Nouveau mot de passe boutique</h1><p className="mt-2 text-sm text-ink-muted">Ce changement concerne uniquement votre compte dans cette boutique.</p><form className="mt-6 space-y-4" onSubmit={submit}>
          <label className="block text-sm font-medium text-ink-2">Nouveau mot de passe<input required minLength={8} maxLength={1024} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1.5 w-full rounded-lg border border-line-2 bg-paper px-3 py-2.5 text-ink" /></label>
          <label className="block text-sm font-medium text-ink-2">Confirmer le mot de passe<input required minLength={8} maxLength={1024} type="password" autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} className="mt-1.5 w-full rounded-lg border border-line-2 bg-paper px-3 py-2.5 text-ink" /></label>
          {error && <p role="alert" className="rounded-lg bg-err-bg px-3 py-2 text-sm text-err-fg">{error}</p>}
          <button type="submit" disabled={busy || !token} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-paper disabled:opacity-50">{busy && <Loader2 className="h-4 w-4 animate-spin" />}Enregistrer</button>
        </form></>}
    </section>
  </main>;
}
