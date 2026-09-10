import { AlertTriangle, RefreshCcw } from 'lucide-react';
import { useRouteError } from 'react-router';

export function RouteErrorPage() {
  const error = useRouteError();

  if (import.meta.env.DEV) {
    console.error('[Router] page rendering failed', error);
  }

  return (
    <main className="min-h-screen grid place-items-center bg-bg px-6">
      <section
        role="alert"
        className="w-full max-w-md rounded-xl border border-err-line bg-paper p-6 text-center"
      >
        <AlertTriangle className="mx-auto h-7 w-7 text-err-fg" aria-hidden />
        <h1 className="mt-4 mb-0 text-xl font-semibold text-ink">
          Impossible de charger cette page
        </h1>
        <p className="mt-2 mb-5 text-sm text-ink-muted">
          L’application vient peut-être d’être mise à jour. Rechargez la page
          pour continuer ; votre compte et vos données sont conservés.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper"
        >
          <RefreshCcw className="h-4 w-4" aria-hidden />
          Recharger la page
        </button>
      </section>
    </main>
  );
}
