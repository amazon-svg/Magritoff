import { AlertTriangle, RotateCcw } from 'lucide-react';

export function TenantLoadError({ retry }: { retry: () => Promise<void> }) {
  return (
    <div className="min-h-[calc(100vh-56px)] grid place-items-center bg-bg px-6">
      <section className="w-full max-w-md rounded-xl border border-err-line bg-paper p-6 text-center">
        <AlertTriangle className="mx-auto h-7 w-7 text-err-fg" />
        <h1 className="mt-4 mb-0 text-xl font-semibold text-ink">Espaces temporairement indisponibles</h1>
        <p className="mt-2 mb-5 text-sm text-ink-muted">
          Votre session est toujours active, mais Magrit n’a pas pu charger vos espaces. Aucun nouvel espace n’est nécessaire.
        </p>
        <button
          type="button"
          onClick={() => void retry()}
          className="inline-flex items-center gap-2 rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper"
        >
          <RotateCcw className="h-4 w-4" />
          Réessayer
        </button>
      </section>
    </div>
  );
}
