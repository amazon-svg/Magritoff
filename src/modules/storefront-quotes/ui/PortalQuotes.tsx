/**
 * E10.10b-1 — onglet « Mes devis » du portail client.
 *
 * LECTURE SEULE : liste les devis mis a disposition du client (statuts
 * sent/accepted/rejected/converted, jamais draft), et permet de deplier le
 * detail d un devis (lignes, totaux). Aucun calcul ici — chaque montant
 * affiche est celui rendu par l API (`GET /storefront-quotes`,
 * `GET /storefront-quotes/{quoteId}`), filtrage `show_discounts` deja
 * applique cote serveur.
 *
 * Accepter/refuser un devis n est PAS de ce lot (E10.10b-2, à cadrer) : cette
 * page ne montre que la lecture.
 */
import { useCallback, useState } from 'react';
import { TEST_IDS } from '@/shared/presentation/testIds';
import { useStorefrontQuotesList } from '@/modules/storefront-quotes/ui/hooks/useStorefrontQuotesList';
import type { StorefrontQuoteDetailDto, StorefrontQuoteDto } from '@/modules/storefront-quotes';

interface Props {
  hasStorefrontSession?: boolean;
}

const STATUS_LABELS: Readonly<Record<StorefrontQuoteDto['status'], string>> = {
  sent: 'Envoyé',
  accepted: 'Accepté',
  rejected: 'Refusé',
  converted: 'Transformé en commande',
};

export function PortalQuotes({ hasStorefrontSession = false }: Props) {
  const { quotes, loading, error, getDetail } = useStorefrontQuotesList(hasStorefrontSession);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<StorefrontQuoteDetailDto | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const toggle = useCallback(
    async (quoteId: string) => {
      if (expandedId === quoteId) {
        setExpandedId(null);
        setDetail(null);
        return;
      }
      setExpandedId(quoteId);
      setDetail(null);
      setDetailError(null);
      setDetailLoading(true);
      try {
        setDetail(await getDetail(quoteId));
      } catch (cause) {
        console.warn('[PortalQuotes] lecture du devis impossible:', cause);
        setDetailError(cause instanceof Error ? cause.message : 'Erreur de chargement');
      } finally {
        setDetailLoading(false);
      }
    },
    [expandedId, getDetail],
  );

  return (
    <div className="max-w-5xl mx-auto px-9 py-12" style={{ fontFamily: 'var(--font-ui)' }}>
      <h2 className="text-ink m-0 mb-2" style={{ fontSize: '28px', fontWeight: 300, letterSpacing: '-0.025em' }}>
        Mes devis
      </h2>
      <p className="text-ink-muted m-0 mb-8" style={{ fontSize: '13.5px' }}>
        Les devis qui vous ont été adressés dans cette boutique.
      </p>

      {loading ? (
        <p className="text-ink-muted" style={{ fontSize: '13.5px' }}>Chargement…</p>
      ) : error ? (
        <p className="text-red-600" style={{ fontSize: '13.5px' }}>{error}</p>
      ) : quotes.length === 0 ? (
        <div data-testid={TEST_IDS.shop.accountQuotesEmpty} className="text-center py-16">
          <div aria-hidden="true" style={{ fontSize: '32px', marginBottom: '12px' }}>📄</div>
          <h3 className="text-ink m-0 mb-2" style={{ fontSize: '16px', fontWeight: 500 }}>
            Aucun devis pour le moment
          </h3>
          <p className="text-ink-muted m-0" style={{ fontSize: '13.5px' }}>
            Les devis que votre imprimeur vous adresse apparaîtront ici.
          </p>
        </div>
      ) : (
        <ul data-testid={TEST_IDS.shop.accountQuotesList} className="flex flex-col gap-3 list-none m-0 p-0">
          {quotes.map((quote) => (
            <li key={quote.id}>
              <button
                type="button"
                data-testid={TEST_IDS.shop.accountQuoteRow}
                data-quote-id={quote.id}
                onClick={() => void toggle(quote.id)}
                className="w-full text-left rounded-xl border border-line bg-paper px-5 py-4 hover:bg-bg transition-colors"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <span className="text-ink" style={{ fontSize: '14px', fontWeight: 500 }}>
                      {quote.number}
                    </span>
                    <span className="ml-3 text-ink-muted" style={{ fontSize: '12.5px' }}>
                      {STATUS_LABELS[quote.status]}
                      {quote.expired ? ' · Expiré' : ''}
                    </span>
                  </div>
                  <span className="text-ink" style={{ fontSize: '14px', fontWeight: 500 }}>
                    {formatEuro(quote.totals.total_incl_tax)}
                  </span>
                </div>
                <div className="text-ink-mute-2 mt-1" style={{ fontSize: '12px' }}>
                  Émis le {formatDate(quote.issued_at)}
                  {quote.valid_until ? ` · Valable jusqu'au ${formatDate(quote.valid_until)}` : ''}
                </div>
              </button>

              {expandedId === quote.id && (
                <div
                  data-testid={TEST_IDS.shop.accountQuoteDetail}
                  data-quote-id={quote.id}
                  className="rounded-xl border border-t-0 border-line bg-bg px-5 py-4 -mt-1 rounded-t-none"
                >
                  {detailLoading ? (
                    <p className="text-ink-muted m-0" style={{ fontSize: '13px' }}>Chargement du détail…</p>
                  ) : detailError ? (
                    <p className="text-red-600 m-0" style={{ fontSize: '13px' }}>{detailError}</p>
                  ) : detail ? (
                    <table className="w-full" style={{ fontSize: '13px' }}>
                      <tbody>
                        {detail.lines.map((line) => (
                          <tr key={line.id} className="border-b border-line-2 last:border-0">
                            <td className="py-2 text-ink">
                              {line.label} × {line.quantity}
                            </td>
                            <td className="py-2 text-right text-ink-muted">
                              {line.price_before_discount !== null && line.price_before_discount !== line.price ? (
                                <span className="line-through mr-2">{formatEuro(line.price_before_discount)}</span>
                              ) : null}
                              <span className="text-ink">{formatEuro(line.price)}</span>
                            </td>
                          </tr>
                        ))}
                        <tr>
                          <td className="pt-3 text-ink-muted">Total HT</td>
                          <td className="pt-3 text-right text-ink">{formatEuro(detail.totals.net_total)}</td>
                        </tr>
                        <tr>
                          <td className="text-ink-muted">TVA ({formatRate(detail.totals.vat_rate)})</td>
                          <td className="text-right text-ink">{formatEuro(detail.totals.vat_amount)}</td>
                        </tr>
                        <tr>
                          <td className="pt-1 text-ink" style={{ fontWeight: 500 }}>Total TTC</td>
                          <td className="pt-1 text-right text-ink" style={{ fontWeight: 500 }}>
                            {formatEuro(detail.totals.total_incl_tax)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  ) : null}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatEuro(value: string): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '—';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(parsed);
}

function formatRate(value: string): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '—';
  return new Intl.NumberFormat('fr-FR', { style: 'percent', maximumFractionDigits: 2 }).format(parsed);
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { dateStyle: 'long' });
  } catch {
    return iso;
  }
}
