import { FormEvent, KeyboardEvent, useRef, useState } from 'react';
import { ArrowUp, Paperclip } from 'lucide-react';
import { MagritLogo } from '@/shared/presentation/MagritLogo';

const PROMPT_EXAMPLES = [
  { label: 'Cartes de visite', description: '500 cartes avec pelliculage mat' },
  { label: 'Flyers', description: '1000 flyers A5 recto verso' },
  { label: 'Brochure', description: '24 pages format A4' },
  { label: 'Affiches', description: '250 affiches A2 brillant' },
] as const;

export function MagritConfiguratorHome({
  onSubmit,
}: Readonly<{
  onSubmit: (query: string) => void;
}>) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    const value = query.trim();
    if (value) onSubmit(value);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  const selectExample = (value: string) => {
    setQuery(value);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  return (
    <main
      className="flex min-h-[calc(100vh-7rem)] items-center justify-center bg-[#fbfbfb] px-6 py-12"
      data-testid="magrit-configurator-home"
    >
      <div className="flex w-full max-w-3xl -translate-y-6 flex-col items-center text-center">
        <MagritLogo size={92} />
        <h1 className="mt-7 text-4xl font-light tracking-[-0.045em] text-ink sm:text-6xl">
          Le papier pense.
        </h1>
        <p className="mt-3 max-w-2xl text-base font-light leading-7 text-ink-muted sm:text-lg">
          Décrivez votre projet d’impression — Magrit explore le catalogue et construit votre produit.
        </p>

        <form
          className="mt-9 w-full rounded-2xl border border-line bg-white p-4 text-left shadow-[0_16px_45px_rgba(15,23,42,0.08)]"
          onSubmit={submit}
        >
          <label className="sr-only" htmlFor="magrit-configurator-prompt">
            Décrivez votre projet d’impression
          </label>
          <textarea
            ref={inputRef}
            id="magrit-configurator-prompt"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={3}
            autoFocus
            placeholder="Décrivez votre projet d’impression…"
            className="w-full resize-none border-0 bg-transparent px-1 text-base text-ink outline-none placeholder:text-ink-mute-2"
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <button
              type="button"
              className="inline-flex min-h-9 items-center gap-2 rounded-full px-3 text-sm text-ink-muted hover:bg-bg"
              aria-label="Joindre un document — prochainement"
              disabled
            >
              <Paperclip className="size-4" />
              Joindre
            </button>
            <button
              type="submit"
              disabled={!query.trim()}
              className="inline-flex min-h-10 items-center gap-2 rounded-full bg-ink px-5 text-sm font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-35"
            >
              Envoyer
              <ArrowUp className="size-4" />
            </button>
          </div>
        </form>

        <div className="mt-6 grid w-full grid-cols-1 gap-2 sm:grid-cols-2" aria-label="Exemples de demandes">
          {PROMPT_EXAMPLES.map((example) => (
            <button
              key={example.label}
              type="button"
              onClick={() => selectExample(`${example.label} — ${example.description}`)}
              className="rounded-xl border border-line bg-white/80 px-4 py-3 text-left transition hover:-translate-y-px hover:border-ink-mute-2 hover:shadow-sm"
            >
              <strong className="block text-sm font-medium text-ink">{example.label}</strong>
              <span className="mt-1 block text-xs text-ink-muted">{example.description}</span>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
