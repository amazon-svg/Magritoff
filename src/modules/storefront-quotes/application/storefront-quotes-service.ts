/**
 * Service applicatif du module Devis du portail client (stories E10.10b-1,
 * E10.10b-2).
 *
 * Delibrement mince : aucun calcul, aucune regle metier — l autorisation
 * (chaine `commercial_quotes.customer_id -> customers -> customer_contacts ->
 * shop_customer_accounts`, E10.5), le statut visible, l arithmetique des
 * totaux et la garde de decision (session deleguee, statut, peremption,
 * transition atomique) vivent tous dans les fonctions `security definer`
 * des migrations 20260906170000/20260907000000. Ce service existe pour
 * suivre la convention de dossiers du depot (`api/` + `application/` +
 * adaptateur + routes), pas pour porter de la logique.
 *
 * SEULE exception : la publication de `quote.accepted`/`quote.rejected`
 * (E10.10b-2, contrat) — ECRITE dans `outbox_events` apres une decision
 * reussie, hors de la transaction SQL (meme limite deja acceptee pour
 * `quote.created`/`quote.sent`, E10.3/E10.10a) : PostgREST n offre pas de
 * transaction multi-requetes, donc pas de moyen d ecrire l evenement et le
 * statut en une seule instruction depuis ce cote de la facade.
 */
import type { TenantId } from '../../../kernel/ids/index.ts';
import type { OutboxPublisher } from '../../_shared/application/index.ts';
import type { StorefrontQuoteDecision, StorefrontQuoteDetailDto, StorefrontQuoteDto } from '../api/contracts.ts';
import type {
  ListStorefrontQuotesCriteria,
  StorefrontQuotesRepository,
} from './storefront-quotes-repository.ts';

export type StorefrontQuotesServiceDependencies = Readonly<{
  repository: StorefrontQuotesRepository;
  outbox: OutboxPublisher;
}>;

export class StorefrontQuotesService {
  private readonly repository: StorefrontQuotesRepository;
  private readonly outbox: OutboxPublisher;

  constructor(dependencies: StorefrontQuotesServiceDependencies) {
    this.repository = dependencies.repository;
    this.outbox = dependencies.outbox;
  }

  async list(
    sessionToken: string,
    criteria: ListStorefrontQuotesCriteria,
  ): Promise<readonly StorefrontQuoteDto[]> {
    return this.repository.list(sessionToken, criteria);
  }

  async getDetail(sessionToken: string, quoteId: string): Promise<StorefrontQuoteDetailDto | null> {
    return this.repository.findById(sessionToken, quoteId);
  }

  /**
   * E10.10b-2 — ACCEPTE ou REFUSE le devis `quoteId`. Les gardes de statut,
   * de session deleguee, de peremption et l atomicite de la transition sont
   * ENTIEREMENT portees par le repository (fonction SQL). Publie
   * `quote.accepted`/`quote.rejected` (`QuoteDecisionPayload`, contrat
   * decision #6) APRES une decision reussie — jamais l identite du compte
   * boutique dans la charge utile (contrat : « un abonne du bus est un
   * systeme TIERS »), et `tenantId` derive du principal, pas de la reponse
   * du repository qui n en porte aucun (representation client, liste
   * blanche).
   */
  async decide(
    tenantId: TenantId,
    sessionToken: string,
    quoteId: string,
    decision: StorefrontQuoteDecision,
  ): Promise<StorefrontQuoteDetailDto | null> {
    const result = await this.repository.decide(sessionToken, quoteId, decision);
    if (result === null) return null;

    await this.outbox.publish({
      name: decision === 'accepted' ? 'quote.accepted' : 'quote.rejected',
      tenantId,
      aggregateType: 'quote',
      aggregateId: result.detail.id,
      payload: {
        quote_id: result.detail.id,
        customer_id: result.customerId,
        number: result.detail.number,
      },
    });

    return result.detail;
  }
}
