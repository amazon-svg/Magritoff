import { Loader2, RefreshCw, TriangleAlert } from 'lucide-react';

interface Props {
  retrying?: boolean;
  onRetry(): void;
}

export function StorefrontUnavailable({ retrying = false, onRetry }: Props) {
  return (
    <main
      className="min-h-screen grid place-items-center bg-bg px-6"
      style={{ fontFamily: 'var(--font-ui)' }}
    >
      <section className="w-full max-w-lg rounded-2xl border border-line bg-paper px-7 py-9 text-center">
        <TriangleAlert className="mx-auto h-8 w-8 text-err-fg" strokeWidth={1.6} aria-hidden="true" />
        <h1 className="mt-4 mb-0 text-xl font-semibold text-ink">
          Boutique temporairement indisponible
        </h1>
        <p className="mx-auto mt-3 mb-0 max-w-md text-sm leading-6 text-ink-muted">
          Votre accès n’est pas remis en cause. Magrit n’a pas pu vérifier la
          session ou charger la boutique pour le moment.
        </p>
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-paper disabled:opacity-50"
        >
          {retrying
            ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.7} aria-hidden="true" />
            : <RefreshCw className="h-4 w-4" strokeWidth={1.7} aria-hidden="true" />}
          Réessayer
        </button>
      </section>
    </main>
  );
}
