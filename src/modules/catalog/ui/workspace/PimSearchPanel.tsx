import { useMemo } from 'react';
import { Loader2, Search } from 'lucide-react';
import { usePIM } from '@/modules/catalog/ui/runtime/PIMContext';
import { normalizeSearchText } from '@/modules/catalog/ui/helpers/catalogSearch';
import type { Gamme, ProductDefinition } from '@/modules/catalog/ui/helpers/productEnrichment';

type PimSearchHit = Readonly<{
  definition: ProductDefinition;
  gamme: Gamme | null;
  score: number;
}>;

const MAX_RESULTS = 24;
const SEARCH_STOP_WORDS = new Set([
  'avec', 'dans', 'des', 'les', 'pour', 'sur', 'une', 'livre', 'livree',
]);

export function PimSearchPanel({
  query,
  compact = false,
  onQueryChange,
}: Readonly<{
  query: string;
  compact?: boolean;
  onQueryChange: (query: string) => void;
}>) {
  const { definitions, gammes, loading } = usePIM();
  const results = useMemo(
    () => searchPimDefinitions(query, definitions, gammes),
    [definitions, gammes, query],
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#fbfbfb]" data-testid="pim-search-panel">
      <div className="border-b border-line bg-white p-3">
        <label className="sr-only" htmlFor="pim-workspace-search">Rechercher dans le PIM</label>
        <div className="flex min-h-11 items-center gap-3 rounded-xl border border-line bg-bg px-3 focus-within:border-ink-mute-2 focus-within:bg-white">
          <Search className="size-4 shrink-0 text-ink-muted" aria-hidden="true" />
          <input
            id="pim-workspace-search"
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Rechercher dans le PIM…"
            className="min-w-0 flex-1 border-0 bg-transparent py-2 text-sm text-ink outline-none placeholder:text-ink-mute-2"
          />
          {!loading && query.trim() && (
            <span className="shrink-0 text-xs text-ink-muted">
              {results.length} résultat{results.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-ink-muted" role="status">
            <Loader2 className="size-4 animate-spin" />
            Chargement du PIM…
          </div>
        ) : !query.trim() ? (
          <PimSearchEmpty title="Recherchez un produit" detail="Utilisez un nom, une gamme ou un mot-clé métier." />
        ) : results.length === 0 ? (
          <PimSearchEmpty title="Aucun résultat PIM" detail="Modifiez la recherche ou poursuivez la configuration dans Studio." />
        ) : (
          <div
            className={`grid grid-cols-1 gap-3 ${compact ? '' : 'xl:grid-cols-2'}`}
            aria-live="polite"
          >
            {results.map(({ definition, gamme }) => (
              <article key={definition.id} className="overflow-hidden rounded-xl border border-line bg-white shadow-sm">
                {!compact && (definition.image_url || gamme?.image_url) && (
                  <img
                    src={definition.image_url ?? gamme?.image_url ?? ''}
                    alt=""
                    className="aspect-[16/7] w-full object-cover"
                  />
                )}
                <div className={compact ? 'p-3.5' : 'p-4'}>
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.13em] text-ink-muted">
                    {gamme?.name ?? definition.gamme_slug}
                  </span>
                  <h3 className={`${compact ? 'text-sm' : 'text-base'} mt-1.5 font-medium leading-snug text-ink`}>
                    {definition.name ?? definition.h1_template ?? gamme?.name ?? 'Produit PIM'}
                  </h3>
                  {(definition.short_description_template || definition.commercial_pitch) && (
                    <p className={`${compact ? 'line-clamp-2 text-xs leading-4' : 'line-clamp-3 text-sm leading-5'} mt-2 text-ink-muted`}>
                      {definition.short_description_template ?? definition.commercial_pitch}
                    </p>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PimSearchEmpty({ title, detail }: Readonly<{ title: string; detail: string }>) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-line bg-white px-6 text-center">
      <Search className="size-6 text-ink-mute-2" aria-hidden="true" />
      <h3 className="mt-3 text-sm font-medium text-ink">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-ink-muted">{detail}</p>
    </div>
  );
}

export function searchPimDefinitions(
  query: string,
  definitions: ProductDefinition[],
  gammes: Gamme[],
): PimSearchHit[] {
  const words = Array.from(new Set(
    normalizeSearchText(query)
      .split(' ')
      .filter((word) => word.length >= 3 && !SEARCH_STOP_WORDS.has(word)),
  ));
  if (words.length === 0) return [];
  const gammeBySlug = new Map(gammes.map((gamme) => [gamme.slug, gamme]));
  const frenchDefinitions = definitions.filter((definition) => definition.locale.toLowerCase().startsWith('fr'));
  const source = frenchDefinitions.length > 0 ? frenchDefinitions : definitions;

  const hits = source.flatMap((definition) => {
    const gamme = gammeBySlug.get(definition.gamme_slug) ?? null;
    const primary = normalizeSearchText([
      definition.name,
      definition.keywords?.join(' '),
      gamme?.name,
      definition.gamme_slug,
    ].filter(Boolean).join(' '));
    const secondary = normalizeSearchText([
      definition.short_description_template,
      definition.description_template,
      definition.commercial_pitch,
    ].filter(Boolean).join(' '));
    const score = words.reduce((total, word) => {
      if (primary.includes(word)) return total + 3;
      if (secondary.includes(word)) return total + 1;
      return total;
    }, 0);
    return score > 0 ? [{ definition, gamme, score }] : [];
  });
  const bestScore = Math.max(0, ...hits.map((hit) => hit.score));
  const relevanceFloor = words.length === 1 ? 1 : Math.max(2, Math.ceil(bestScore * 0.4));

  return hits
    .filter((hit) => hit.score >= relevanceFloor)
    .sort((left, right) => right.score - left.score || (left.definition.name ?? '').localeCompare(right.definition.name ?? '', 'fr'))
    .slice(0, MAX_RESULTS);
}
