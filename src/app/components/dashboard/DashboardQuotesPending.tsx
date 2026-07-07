/**
 * DashboardQuotesPending (S2.16, option C)
 * ────────────────────────────────────────
 * Sous-menu de « Devis » (à côté de « Gabarits de devis »).
 * Liste les devis au statut « en cours » (draft/sent/pending) pour reprise en
 * un clic vers l'éditeur. Data-driven via QuotesContext + resolvePendingQuotes.
 *
 * Route : dashboard/quotes/pending.
 */

import { FileClock, ArrowRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { useQuotes } from '../../contexts/QuotesContext';
import { useTenantPath } from '../../hooks/useTenantPath';
import { resolvePendingQuotes } from '../../utils/dashboardHomeSections';
import { statusGroupDef } from '../../utils/quoteStatus';
import { TEST_IDS } from '../../lib/testIds';

const T = TEST_IDS.dashboard;

export function DashboardQuotesPending() {
  const { quotes, loading } = useQuotes();
  const navigate = useNavigate();
  const tp = useTenantPath();

  // Tous les devis « en cours », récents d'abord (pas de plafond : page dédiée).
  const pending = resolvePendingQuotes(quotes, quotes.length);

  return (
    <div className="max-w-3xl">
      {/* En-tête */}
      <div className="flex items-center gap-2 mb-5">
        <FileClock className="w-4.5 h-4.5 text-ink-muted" strokeWidth={1.5} aria-hidden="true" />
        <div>
          <h2 className="text-ink m-0" style={{ fontSize: '16px', fontWeight: 500, letterSpacing: '-0.01em' }}>
            Devis en attente
          </h2>
          <p className="text-ink-muted m-0" style={{ fontSize: '12.5px', fontWeight: 400 }}>
            Reprenez vos devis en cours là où vous vous êtes arrêté.
          </p>
        </div>
        <Link
          to={tp('/dashboard/quotes')}
          className="ml-auto text-ink-muted hover:text-ink inline-flex items-center gap-1"
          style={{ fontSize: '12.5px', fontWeight: 400 }}
        >
          Tous les devis <ArrowRight className="w-3 h-3" strokeWidth={1.5} />
        </Link>
      </div>

      {/* Liste / états */}
      <section
        data-testid={T.pendingQuotes}
        className="border border-line rounded-xl overflow-hidden bg-paper"
      >
        {loading ? (
          <div className="py-12 text-center text-ink-muted" style={{ fontSize: '13px' }}>
            Chargement…
          </div>
        ) : pending.length === 0 ? (
          <div className="py-16 text-center text-ink-mute-2">
            <FileClock className="w-10 h-10 mx-auto mb-3 opacity-40" strokeWidth={1.5} />
            <p style={{ fontSize: '13.5px', fontWeight: 400 }}>Aucun devis en attente.</p>
            <Link
              to={tp('/dashboard/quotes')}
              className="text-ink underline inline-block mt-2"
              style={{ fontSize: '12.5px' }}
            >
              Voir la bibliothèque de devis
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col">
            {pending.map((q, i) => {
              const st = statusGroupDef(q.status);
              return (
                <li
                  key={q.id}
                  data-testid={T.pendingQuoteRow}
                  className={`grid grid-cols-[1fr_auto_auto] items-center gap-4 px-5 py-3.5 ${
                    i < pending.length - 1 ? 'border-b border-line' : ''
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Link
                        to={tp(`/dashboard/quotes/${q.id}/edit`)}
                        className="text-ink truncate hover:underline"
                        style={{ fontSize: '13.5px', fontWeight: 400 }}
                      >
                        {q.client_name || <span className="text-ink-mute-2">Client non renseigné</span>}
                      </Link>
                      <span className="text-ink-mute-2 font-mono shrink-0" style={{ fontSize: '11px' }}>
                        {q.reference}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span
                        className={`inline-flex font-mono px-1.5 py-0.5 rounded ${st.cls}`}
                        style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '0.02em' }}
                      >
                        {st.label}
                      </span>
                      <span className="text-ink-muted font-mono" style={{ fontSize: '11px' }}>
                        {new Date(q.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                      </span>
                    </div>
                  </div>
                  <div
                    className="font-mono text-ink"
                    style={{ fontSize: '13px', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}
                  >
                    {(q.total_ttc ?? 0).toFixed(2)}€
                  </div>
                  <button
                    data-testid={T.pendingQuoteResumeBtn}
                    onClick={() => navigate(tp(`/dashboard/quotes/${q.id}/edit`))}
                    className="px-3 py-1.5 rounded-md border border-line bg-paper text-ink-2 hover:bg-bg hover:text-ink"
                    style={{ fontSize: '12.5px', fontWeight: 500 }}
                  >
                    Reprendre
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
