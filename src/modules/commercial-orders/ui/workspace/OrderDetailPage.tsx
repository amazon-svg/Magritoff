/**
 * OrderDetailPage — E10.16, ecran de detail d une commande.
 *
 * CA1 : numero, statut courant, client et interlocuteur (peut etre vide),
 * dates (creation, derniere transition, livraison prevue — vide dans ce
 * lot), devis d origine. CA2 : lignes au format `PricedLine` (E10.21), tel
 * quel — libelle produit, configuration technique, quantite, prix de vente
 * et remise. CA4 : bouton « Statut » qui ouvre `OrderStatusDialog` (E10.14) —
 * AUCUN panneau d historique separe ici, l historique vit DANS la modale
 * (arbitrage (e), docs/api/CONVENTIONS.md §8.17 decision #6). CA6 :
 * accessible par URL directe `/t/:slug/dashboard/commercial-orders/:orderId`
 * (ecart documente par rapport au chemin `orders/:id` esquisse par le
 * contrat — `orders` est deja pris par le module `orders`, commandes
 * BOUTIQUE, un domaine different ; voir `surface-contributions.ts`). A
 * l epoque d E10.16, aucune grille de commandes n existait (reserve (f)) —
 * E10.18a en ajoute une (`OrdersListPage.tsx`, meme module), dont chaque
 * ligne lie ici. CA7 : LECTURE SEULE — aucun champ editable sur un montant
 * de ligne, aucune mutation de prix nulle part sur cette page.
 *
 * HORS PERIMETRE, EXPLICITEMENT (confirme par le cadrage architecte) :
 *  - CA3, gamme de fabrication Clariprint — capacite absente du depot,
 *    differee et rapprochee d E10.8 (gelee). Aucune section, aucun lien
 *    mort, aucun testid.
 *
 * CA8 (bon de commande PDF, E10.19) — LIVRE PAR CE LOT (E10.19b) :
 * `OrderDocumentPanel` (module `commercial-orders/ui/components`, la
 * ressource vit sous `/commercial-orders/{orderId}/documents`, jamais un
 * module `order-documents` distinct cote UI), quatrieme section, meme
 * gabarit visuel que les trois precedentes. Production sur ACTION EXPLICITE
 * UNIQUEMENT (bouton « Produire le bon de commande »), jamais automatique.
 *
 * CA5 (fichiers, E10.17) — PANNEAU A L ECHELLE DE LA COMMANDE LIVRE PAR CE
 * LOT (E10.17b), qa-review N1 (round 1) : le CA5 amende d E10.16 parlait
 * d un panneau GROUPE PAR ITEM (`order_line_id`) ; le wireframe VALIDE par
 * Arnaud le 09/09/2026 (`.design-handoff/wireframes/E10.17b-panneau-
 * fichiers-commande.md`, valide sans demander ce groupement) ne le demande
 * PAS — ce n est donc pas un ecart de design, mais il faut le dire
 * explicitement plutot que de laisser un commentaire affirmer a tort qu un
 * CA plus large est integralement couvert. `OrderFilesBlock` liste tous les
 * fichiers de la commande dans une seule liste plate (troisieme section,
 * meme gabarit visuel que les deux sections ci-dessus) ; le groupement par
 * item (`order_line_id`) N EST PAS RENDU — l information existe dans
 * `OrderFile.order_line_id` (E10.17a) mais n est pas exploitee ici. Point a
 * tracer cote Notion par le scribe : le CA5 amende d E10.16 n est couvert
 * qu en partie par ce lot. `OrderFilesBlock` est importe par l ENTREE
 * PUBLIQUE du module `order-files` (`@/modules/order-files/ui`), jamais un
 * chemin profond — regle MUX.
 */
import { Link, useParams } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { useTenantPath } from '@/modules/tenants/ui/hooks';
import { TEST_IDS } from '@/shared/presentation/testIds';
import type { ProductionStepDto } from '@/modules/production-steps';
import { OrderFilesBlock } from '@/modules/order-files/ui';
import { OrderUploadLinksPanel } from '@/modules/order-upload-links/ui';
import { OrderDocumentPanel, OrderStatusButton } from '../components';
import { useOrderDetail } from '../hooks/useOrderDetail';
import { contactDisplayName, customerDisplayName, formatOrderDate, sourceQuoteStatusLabel } from './order-detail.helpers';

const COLOR_SWATCH: Record<string, string> = {
  slate: 'bg-slate-400',
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  violet: 'bg-violet-500',
};

export function DashboardOrderDetail() {
  const { orderId } = useParams<{ orderId: string }>();
  const tp = useTenantPath();
  const { order, customer, quote, steps, lastStepChange, loading, error, refresh } = useOrderDetail(
    orderId ?? null,
  );

  if (loading) return <p className="text-sm text-ink-muted">Chargement…</p>;

  if (!order) {
    return (
      <div className="space-y-3">
        <Link to={tp('/dashboard/customers')} className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
          <ArrowLeft className="w-4 h-4" />
          Retour
        </Link>
        <p className="text-sm text-ink-muted">{error ?? 'Commande introuvable.'}</p>
      </div>
    );
  }

  const currentStep: ProductionStepDto | null =
    steps.find((step) => step.id === order.current_production_step_id) ?? null;

  const interlocutor = customer?.contacts.find((contact) => contact.id === order.customer_contact_id) ?? null;

  // CA1 — « derniere transition » : AU JOURNAL (E10.14), jamais sur
  // updated_at (decision #5 du contrat, docs/api/CONVENTIONS.md §8.17).
  // Commande jamais deplacee -> journal vide, on retombe sur created_at/
  // created_by (cas normal, pas une anomalie).
  const lastTransitionAt = lastStepChange?.occurred_at ?? order.created_at;
  const lastTransitionBy = lastStepChange?.actor_label ?? null;

  return (
    <div className="space-y-6" data-testid={TEST_IDS.commercialOrder.detailPage}>
      <Link
        to={tp(`/dashboard/customers/${order.customer_id}`)}
        className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour au client
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink">{order.number}</h1>
          <p className="text-sm text-ink-muted mt-1">
            {order.status === 'validated' ? 'Validée' : order.status}
            {' · '}
            {sourceQuoteStatusLabel(order.source_quote_status)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {currentStep && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-line-2 text-xs font-medium text-ink-2">
              <span className={`w-2 h-2 rounded-full ${COLOR_SWATCH[currentStep.color] ?? 'bg-slate-400'}`} />
              {currentStep.label}
            </span>
          )}
          {/* CA4 — point d appel UNIQUE de OrderStatusDialog (E10.14) : c est
              ce lot qui le cable enfin sur un ecran reel. */}
          <OrderStatusButton orderId={order.id} onChanged={() => void refresh()} />
        </div>
      </div>

      {error && <p className="text-sm text-err-fg">{error}</p>}

      <section className="border border-line rounded-xl p-4 space-y-3" data-testid={TEST_IDS.commercialOrder.customerBlock}>
        <h2 className="text-sm font-bold text-ink-2 uppercase tracking-wider">Client</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-ink-muted uppercase tracking-wider mb-1">Client</p>
            {customer ? (
              <Link to={tp(`/dashboard/customers/${customer.id}`)} className="text-sm text-ink hover:text-brand hover:underline">
                {customerDisplayName(customer)}
              </Link>
            ) : (
              <p className="text-sm text-ink-muted">—</p>
            )}
          </div>
          <div>
            <p className="text-xs text-ink-muted uppercase tracking-wider mb-1">Interlocuteur</p>
            <p className="text-sm text-ink">
              {interlocutor ? (
                <>
                  {contactDisplayName(interlocutor)}
                  <span className="text-ink-muted"> · {interlocutor.email}</span>
                </>
              ) : (
                <span className="text-ink-muted">Non identifié</span>
              )}
            </p>
          </div>
          <div>
            <p className="text-xs text-ink-muted uppercase tracking-wider mb-1">Créée le</p>
            <p className="text-sm text-ink">{formatOrderDate(order.created_at)}</p>
          </div>
          <div>
            <p className="text-xs text-ink-muted uppercase tracking-wider mb-1">Dernière transition</p>
            <p className="text-sm text-ink">
              {formatOrderDate(lastTransitionAt)}
              {lastTransitionBy ? <span className="text-ink-muted"> · {lastTransitionBy}</span> : null}
            </p>
          </div>
          <div>
            {/* Pose UNIQUEMENT par la conversion (interlocuteur ayant decide
                depuis le portail) ; AUCUN chemin d ecriture n existe encore
                pour cette date — reserve (h) du contrat, elle vaut NULL sur
                100% des commandes tant qu une story n aura pas tranche qui
                la saisit et quand. */}
            <p className="text-xs text-ink-muted uppercase tracking-wider mb-1">Livraison prévue</p>
            <p className="text-sm text-ink-muted">{order.expected_delivery_date ?? 'Non renseignée'}</p>
          </div>
          <div>
            <p className="text-xs text-ink-muted uppercase tracking-wider mb-1">Devis d’origine</p>
            {quote ? (
              <Link
                to={tp(`/dashboard/commercial-quotes/${quote.id}`)}
                className="text-sm text-ink hover:text-brand hover:underline"
              >
                Issue du devis {quote.number}
              </Link>
            ) : (
              <p className="text-sm text-ink-muted">—</p>
            )}
          </div>
        </div>
      </section>

      <section className="border border-line rounded-xl p-4 space-y-3">
        <h2 className="text-sm font-bold text-ink-2 uppercase tracking-wider">Lignes</h2>
        {/* CA2 — format PricedLine (E10.21) tel quel, aucun format neuf. CA7 —
            LECTURE SEULE : aucune cellule editable sur un montant. */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid={TEST_IDS.commercialOrder.linesTable}>
            <thead>
              <tr className="text-left text-xs text-ink-muted uppercase tracking-wider border-b border-line">
                <th className="py-2 pr-3">Produit</th>
                <th className="py-2 pr-3">Configuration</th>
                <th className="py-2 pr-3 text-right">Quantité</th>
                <th className="py-2 pr-3 text-right">Remise</th>
                <th className="py-2 pr-3 text-right">Prix de vente</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {order.lines.map((line) => (
                <tr key={line.id} data-testid={TEST_IDS.commercialOrder.lineRow} data-line-id={line.id}>
                  <td className="py-2 pr-3 text-ink">{line.label}</td>
                  <td className="py-2 pr-3 text-ink-muted text-xs max-w-xs truncate" title={JSON.stringify(line.product_config)}>
                    {Object.keys(line.product_config).length > 0
                      ? Object.entries(line.product_config)
                          .slice(0, 3)
                          .map(([key, value]) => `${key}: ${String(value)}`)
                          .join(' · ')
                      : '—'}
                  </td>
                  <td className="py-2 pr-3 text-right text-ink">{line.quantity}</td>
                  <td className="py-2 pr-3 text-right text-ink">
                    {line.discount_rate ? `${(Number(line.discount_rate) * 100).toFixed(2)} %` : '—'}
                  </td>
                  <td className="py-2 pr-3 text-right text-ink font-medium">{line.sale_price} €</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="text-right text-sm text-ink pt-2 border-t border-line">
          Total TTC : <span className="font-bold">{order.totals.total_incl_tax} €</span>
        </div>
      </section>

      {/* CA5 — panneau de fichiers (E10.17b), troisieme section, meme gabarit
          visuel que les deux sections ci-dessus (arbitrage Q1 du 09/09/2026). */}
      <OrderFilesBlock orderId={order.id} />

      {/* CA8 — panneau du bon de commande PDF (E10.19b), quatrieme section,
          meme gabarit visuel. */}
      <OrderDocumentPanel orderId={order.id} />

      {/* E10.20a — panneau "liens de depot", cinquieme section, meme gabarit
          visuel. SOCLE UNIQUEMENT (contrat §8.21 §5) : cree/liste/revoque des
          liens, AUCUN depot possible dans ce lot (E10.20b livrera la page
          publique de depot elle-meme). */}
      <OrderUploadLinksPanel orderId={order.id} />
    </div>
  );
}
