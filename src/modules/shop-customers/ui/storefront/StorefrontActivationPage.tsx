import { Loader2, LockKeyhole } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { useStorefrontCredentialSetup } from '@/modules/shop-customers/ui/hooks/useStorefrontCredentialSetup';

export function StorefrontActivationPage() {
  const navigate = useNavigate();
  const { slug = '' } = useParams();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const { password, setPassword, confirmation, setConfirmation, busy: submitting, error, submit } =
    useStorefrontCredentialSetup({
      token,
      kind: 'activation',
      onActivated: () => navigate(`/shop/${encodeURIComponent(slug)}`, { replace: true }),
    });

  return (
    <main className="min-h-screen bg-bg px-4 py-12 grid place-items-center">
      <section className="w-full max-w-md rounded-2xl border border-line bg-paper p-6 shadow-sm">
        <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-xl bg-ink text-paper">
          <LockKeyhole className="h-5 w-5" />
        </div>
        <>
            <h1 className="text-2xl font-semibold text-ink">Activer votre compte boutique</h1>
            <p className="mt-2 text-sm text-ink-muted">
              Choisissez un mot de passe propre à cette boutique. Il n’est pas partagé avec votre compte Magrit ni avec une autre boutique.
            </p>
            <form className="mt-6 space-y-4" onSubmit={submit}>
              <label className="block text-sm font-medium text-ink-2">
                Mot de passe
                <input
                  required
                  minLength={8}
                  maxLength={1024}
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-line-2 bg-paper px-3 py-2.5 text-ink"
                />
              </label>
              <label className="block text-sm font-medium text-ink-2">
                Confirmer le mot de passe
                <input
                  required
                  minLength={8}
                  maxLength={1024}
                  type="password"
                  autoComplete="new-password"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-line-2 bg-paper px-3 py-2.5 text-ink"
                />
              </label>
              {error && <p role="alert" className="rounded-lg bg-err-bg px-3 py-2 text-sm text-err-fg">{error}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-paper disabled:opacity-50"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Activer mon compte
              </button>
            </form>
        </>
      </section>
    </main>
  );
}
