/**
 * Service applicatif du module Devis commerciaux (stories E10.3, E10.9).
 *
 * Orchestration pure : aucune dependance a Supabase ni au HTTP. Les erreurs
 * metier sont des types dedies ; c est la route qui les traduit en Problem
 * RFC 7807, avec le request_id qu elle seule connait.
 *
 * ── E10.9 — pourquoi ce service calcule le prix, pas le repository ─────────
 * Le contrat interdit tout calcul de prix hors `PricingEngine` (E10.21) ; la
 * regle appliquee vient de `PriceRulesService.resolve()` (E10.6/E10.7). Les
 * DEUX sont des dependances de CE service : le repository ne fait qu inserer/
 * mettre a jour des colonnes DEJA calculees (`PricedQuoteLineWrite`,
 * `QuoteLineWriteUpdate`) — jamais une formule cote adaptateur Supabase.
 *
 * ── product_range_id : toujours absent (choix documente) ───────────────────
 * Aucun `project_item.quote_payload` ne porte a ce jour de `product_range_id`
 * exploitable : la resolution de regle de prix se fait donc avec
 * `productRangeId: null`, ce qui restreint les regles candidates aux portees
 * `global`/`customer` (jamais `range`/`customer_range`, qui exigent une
 * gamme) et rend la marge par defaut de gamme (E10.6 CA4) inatteignable —
 * memes bornes que le backfill SQL de la migration
 * `20260904000100_gescom_e10_9_quote_line_discounts.sql`. Un futur porteur de
 * `product_range_id` dans `product_config` (hors perimetre de cette story)
 * beneficiera normalement des regles `range`/`customer_range` sans reprise de
 * ce service.
 */
import type { TenantId, UserId } from '../../../kernel/ids/index.ts';
import type { OutboxPublisher } from '../../_shared/application/index.ts';
import type { ProjectsRepository } from '../../projects/application/projects-repository.ts';
import type { PriceRulesService } from '../../pricing/application/price-rules-service.ts';
import type { PricingEngine } from '../../pricing/application/pricing-engine.ts';
import type {
  QuoteDocumentsService,
  QuoteForDocumentGeneration,
  RenderedDocumentForSend,
} from '../../quote-documents/application/quote-documents-service.ts';
import {
  computeQuoteLineWarnings,
  deriveLineCommercials,
  MarginNotDerivableError,
  NegativeSalePriceError,
  salePriceFromMarginRate,
} from './quote-line-pricing.ts';
import {
  moneyNonNegativeSchema,
  type CreateQuoteFromProjectCommand,
  type CreateQuoteLineCommand,
  type QuoteAuditEntryDto,
  type QuoteDetailDto,
  type QuoteDto,
  type QuoteLineAuditEntryDto,
  type QuoteLineDto,
  type QuoteLineWarningDto,
  type SendQuoteCommand,
  type UpdateQuoteCommand,
  type UpdateQuoteLineCommand,
} from '../api/contracts.ts';
import {
  QuoteLineInvalidMarginRateError,
  QuoteLineInvalidQuantityError,
  QuoteLineMarginNotDerivableError,
  QuoteLineNotFoundError,
  QuoteLineProjectItemInvalidError,
  QuoteNotFoundError,
  type CommercialQuotesRepository,
  type ListQuoteHeaderAuditParams,
  type ListQuoteLineAuditParams,
  type ListQuotesParams,
  type ListQuotesResult,
  type PricedQuoteLineWrite,
  type QuoteLineWriteUpdate,
} from './commercial-quotes-repository.ts';

/**
 * L acteur n a pas le droit metier `can_manage_pricing` (E10.11) requis pour
 * lire le journal d audit des lignes (`identity.role_required`, contrat
 * `listQuoteAuditEntries`). Un `admin` du tenant recoit ce droit par
 * derivation (`public.user_has_capability`, 20260814000200_admin_unique.sql
 * :130-157 — `owner` n existe plus comme valeur de `tenant_members.role`
 * depuis cette meme migration) : il ne perd donc jamais l acces qu il avait
 * deja sous l ancienne garde « role `admin` » (E10.9).
 */
export class QuoteAuditAccessDeniedError extends Error {
  constructor(message = "Le droit can_manage_pricing est requis pour consulter le journal d audit.") {
    super(message);
    this.name = 'QuoteAuditAccessDeniedError';
  }
}

export type ListQuoteLineAuditResultDto = Readonly<{ rows: readonly QuoteLineAuditEntryDto[] }>;
export type ListQuoteHeaderAuditResultDto = Readonly<{ rows: readonly QuoteAuditEntryDto[] }>;

/**
 * Entree resolue et VALIDEE d `addLine` (E10.9) : pour une ligne liee, porte
 * deja `label`/`productConfig`/`productionPrice`/`chiffrageQuantity` extraits
 * de l element de projet (verifie appartenir au projet source), pour eviter
 * une seconde lecture du referentiel Projets une fois la validation faite.
 */
type ResolvedAddLineInput =
  | Readonly<{
      kind: 'project_item';
      projectItemId: string;
      label: string;
      productConfig: Readonly<Record<string, unknown>>;
      productionPrice: string;
      chiffrageQuantity: number;
      quantity: number;
    }>
  | Readonly<{
      kind: 'free';
      label: string;
      quantity: number;
      productionPrice: string;
    }>;

export type CommercialQuotesServiceDependencies = Readonly<{
  repository: CommercialQuotesRepository;
  outbox: OutboxPublisher;
  /** E10.9 — validation `project_item_id` DU PROJET SOURCE du devis (CA, addLine). */
  projects: ProjectsRepository;
  /** E10.6/E10.7 — resolution de la regle de prix applicable au client du devis. */
  priceRules: PriceRulesService;
  /** E10.21 — seul point d entree du calcul de prix. */
  pricingEngine: PricingEngine;
  /**
   * E10.10b-4c — generation du PDF joint a l e-mail d envoi. Appelee UNE
   * SEULE FOIS, au PREMIER envoi (jamais sur un renvoi), AVANT
   * `repository.sendQuote()` : c est cet ORDRE, et lui seul, qui garantit
   * qu un devis reste `draft` en cas d echec de production (contrat §8.18
   * §5/§7 reserve (j)) sans transaction distribuee — si la generation
   * echoue, la transition d etat n est simplement jamais appelee.
   */
  documents: QuoteDocumentsService;
  /** Injectable pour les tests : date de resolution des regles de prix (`YYYY-MM-DD`) ET instant d envoi/generation. */
  now?: () => Date;
}>;

export class CommercialQuotesService {
  private readonly repository: CommercialQuotesRepository;
  private readonly outbox: OutboxPublisher;
  private readonly projects: ProjectsRepository;
  private readonly priceRules: PriceRulesService;
  private readonly pricingEngine: PricingEngine;
  private readonly documents: QuoteDocumentsService;
  private readonly now: () => Date;

  constructor(dependencies: CommercialQuotesServiceDependencies) {
    this.repository = dependencies.repository;
    this.outbox = dependencies.outbox;
    this.projects = dependencies.projects;
    this.priceRules = dependencies.priceRules;
    this.pricingEngine = dependencies.pricingEngine;
    this.documents = dependencies.documents;
    this.now = dependencies.now ?? (() => new Date());
  }

  list(tenantId: TenantId, params: ListQuotesParams): Promise<ListQuotesResult> {
    return this.repository.list(tenantId, params);
  }

  async getDetail(tenantId: TenantId, quoteId: string): Promise<QuoteDetailDto> {
    const detail = await this.repository.findDetailById(tenantId, quoteId);
    if (!detail) throw new QuoteNotFoundError();
    return detail;
  }

  async getSummary(tenantId: TenantId, quoteId: string): Promise<QuoteDto> {
    const quote = await this.repository.findById(tenantId, quoteId);
    if (!quote) throw new QuoteNotFoundError();
    return quote;
  }

  /**
   * CA2-CA5 — cree un devis depuis des elements coches d un projet et publie
   * `quote.created`. Le repository porte l atomicite reelle (numerotation +
   * insertion du devis et de ses lignes dans une seule transaction, CA5) ;
   * ce service n ajoute que l evenement de sortie, hors de cette transaction
   * (meme limite deja acceptee pour `project.created`, voir
   * docs/api/CONVENTIONS.md §8.2 M2).
   */
  async createFromProjectItems(
    tenantId: TenantId,
    actor: UserId,
    command: CreateQuoteFromProjectCommand,
  ): Promise<QuoteDetailDto> {
    const created = await this.repository.createFromProjectItems(tenantId, actor, command);
    await this.outbox.publish({
      name: 'quote.created',
      tenantId,
      aggregateType: 'quote',
      aggregateId: created.id,
      payload: {
        quote_id: created.id,
        project_id: created.project_id,
        customer_id: created.customer_id,
        number: created.number,
      },
    });
    return created;
  }

  async update(tenantId: TenantId, quoteId: string, command: UpdateQuoteCommand): Promise<QuoteDto> {
    const current = await this.repository.findById(tenantId, quoteId);
    if (!current) throw new QuoteNotFoundError();
    return this.repository.update(tenantId, quoteId, command);
  }

  async remove(tenantId: TenantId, quoteId: string): Promise<void> {
    const exists = await this.repository.findById(tenantId, quoteId);
    if (!exists) throw new QuoteNotFoundError();
    return this.repository.remove(tenantId, quoteId);
  }

  // ---------------------------------------------------------------------------
  // E10.10a — envoi/renvoi, duplication, journal d audit d entete.
  // ---------------------------------------------------------------------------

  /**
   * ENVOIE (`draft` -> `sent`) ou RENVOIE (`sent` -> `sent`) un devis. La
   * concurrence optimiste (`If-Match`, CA9) est verifiee par la ROUTE avant
   * cet appel — meme discipline que `updateQuote`/`reorderLines`. Le reste de
   * la transition (statut, horodatage, audit) est porte ATOMIQUEMENT par le
   * repository (fonction Postgres, PostgREST n offrant pas de transaction
   * multi-requetes). `quote.sent` est publie APRES, hors de cette transaction
   * (meme limite deja acceptee pour `quote.created`) : `is_resend` distingue
   * les deux cas pour le seul consommateur qui en a besoin aujourd hui
   * (E10.10b, portail client).
   *
   * qa-review B2 (BLOQUANT, corrige) — la branche de generation n est prise
   * QUE si `exists.status === 'draft'` (premier envoi STRICT), plus jamais
   * sur `!isResend` (qui incluait a tort `accepted`/`rejected`/`converted` :
   * un rejeu de `sendQuote` sur un devis deja ACCEPTE aurait REGENERE le
   * document — sur les donnees et le fond D AUJOURD HUI — et
   * `store()`/`upsert:true` l aurait ECRASE avant que l unicite EN BASE
   * n ait la moindre chance de refuser quoi que ce soit).
   *
   * qa-review B4 (arbitrage architecte) — `valid_until` est RESOLUE, au
   * PREMIER envoi, via `repository.resolveValidUntilForSend()` (lecteur SQL,
   * AUCUNE ECRITURE) AVANT la generation, et la MEME valeur est transmise a
   * la fois au moteur de generation (le PDF l imprime) et a
   * `repository.sendQuote()` (qui l applique TELLE QUELLE, sans la
   * recalculer) : document et ligne portent alors la meme date par
   * construction, jamais par coincidence.
   *
   * qa-review B4-bis (BLOQUANT, corrige) — LA GENERATION NE PERSISTE PLUS
   * RIEN AVANT LE SUCCES DE L ENVOI. `documents.renderForFirstSend()` produit
   * le PDF EN MEMOIRE ; `repository.sendQuote()` est appele ENSUITE ; le
   * document n est stocke (`documents.persistRendered()`) QU APRES que
   * l envoi a REELEMENT reussi. Avant ce correctif, le document etait stocke
   * AVANT l envoi : un echec ulterieur (`If-Match` perimee, garde de statut,
   * transition concurrente) laissait un document ORPHELIN sur un devis
   * RESTE `draft` — donc modifiable — et un rejeu sur une ligne corrigee
   * pouvait faire recevoir au client le PDF de la version PERIMEE (la
   * contrainte d unicite `quote_id` aurait reutilise la ligne existante).
   * Produire en memoire puis persister seulement apres succes rend ce
   * scenario STRUCTURELLEMENT impossible.
   *
   * Regle d echec asymetrique du contrat (§8.18 §5/§7 reserve (j)),
   * INCHANGEE par ce qui precede :
   *  - aucun gabarit eligible (`renderForFirstSend` rend `null`) -> l envoi
   *    continue SANS piece jointe, cas NOMINAL de tout tenant sans gabarit ;
   *  - un gabarit ETAIT eligible et la production echoue
   *    (`QuoteDocumentGenerationFailedError`) -> cette methode se termine EN
   *    ERREUR ICI, `repository.sendQuote()` n est JAMAIS appele, le devis
   *    reste `draft` PAR CONSTRUCTION.
   * Un RENVOI ne regenere jamais (contrat : "generation unique, jamais
   * regeneree") — la branche de generation n est prise qu au PREMIER envoi.
   */
  async send(
    tenantId: TenantId,
    actor: UserId,
    quoteId: string,
    command: SendQuoteCommand,
  ): Promise<QuoteDetailDto> {
    const exists = await this.repository.findById(tenantId, quoteId);
    if (!exists) throw new QuoteNotFoundError();
    const isFirstSend = exists.status === 'draft';
    const isResend = exists.status === 'sent';

    let resolvedValidUntil: string | null = null;
    let rendered: RenderedDocumentForSend | null = null;

    if (isFirstSend) {
      const detail = await this.repository.findDetailById(tenantId, quoteId);
      // Devis introuvable entre les deux lectures : course rarissime, laissee
      // a `repository.sendQuote()` ci-dessous, qui la retraduira fidelement.
      if (detail && detail.lines.length > 0) {
        // qa-review B4 — resolu AVANT la generation : le PDF et la ligne
        // `commercial_quotes` doivent imprimer/porter la MEME date.
        resolvedValidUntil = await this.repository.resolveValidUntilForSend(tenantId, quoteId);

        const issuedAt = this.now().toISOString();
        const showDiscounts = command.show_discounts ?? detail.show_discounts;
        const generationInput: QuoteForDocumentGeneration = {
          id: detail.id,
          customerId: detail.customer_id,
          number: detail.number,
          validUntil: resolvedValidUntil,
          totals: {
            linesSubtotal: showDiscounts ? detail.totals.lines_subtotal : null,
            globalDiscount: showDiscounts ? detail.totals.global_discount : null,
            netTotal: detail.totals.net_total,
            vatRate: detail.totals.vat_rate,
            vatAmount: detail.totals.vat_amount,
            totalInclTax: detail.totals.total_incl_tax,
          },
          lines: detail.lines.map((line) => ({
            position: line.position,
            label: line.label,
            productConfig: line.product_config,
            quantity: line.quantity,
            priceBeforeDiscount: showDiscounts ? line.customer_price : null,
            discountRate: showDiscounts ? line.discount_rate : null,
            price: line.sale_price,
          })),
        };
        // Une erreur ici (QuoteDocumentGenerationFailedError) REMONTE telle
        // quelle : elle empeche l appel a `repository.sendQuote()` juste en
        // dessous, ce qui EST la garantie "le devis reste draft" — aucun
        // rattrapage necessaire. RIEN N EST ENCORE PERSISTE (B4-bis) : ce
        // seul appel produit des octets en memoire, aucun acces bucket ni
        // table `quote_documents`.
        rendered = await this.documents.renderForFirstSend(tenantId, generationInput, issuedAt);
      }
    }

    const sent = await this.repository.sendQuote(tenantId, actor, quoteId, command, resolvedValidUntil);

    if (rendered) {
      // qa-review B4-bis — PERSISTANCE APRES SUCCES CONFIRME uniquement. Le
      // devis est ICI deja irrevocablement `sent` : un echec de PERSISTANCE
      // a ce stade ne doit plus jamais declencher une regeneration (contrat :
      // "generation unique, jamais regeneree"). Degrade au silence — le
      // devis part alors sans document, exactement comme si aucun gabarit
      // n avait ete configure — plutot que de faire echouer une operation
      // qui, en base, a deja reellement reussi.
      try {
        await this.documents.persistRendered(tenantId, actor, sent.id, rendered);
      } catch (cause) {
        // Best-effort assume et documente : voir le paragraphe ci-dessus.
        // qa-review (non bloquant, corrige) : le commentaire precedent
        // affirmait a tort qu aucune information n etait perdue — c est
        // FAUX, le document EST perdu, definitivement (generation unique,
        // jamais regeneree : ce devis n aura plus jamais de piece jointe,
        // GET .../documents rendra 404 pour toujours). Journalise donc cet
        // echec (meme patron que `bestEffortOutbox(..., console.error ...)`
        // cable dans le fichier de composition, `magrit-outbox-dispatcher`)
        // pour qu il reste au moins visible operationnellement, meme si
        // l appelant HTTP, lui, ne doit pas voir echouer un envoi qui a
        // reellement reussi.
        console.error(
          `[CommercialQuotesService] document perdu (persistance echouee apres envoi reussi, quote=${sent.id}):`,
          cause,
        );
      }
    }

    await this.outbox.publish({
      name: 'quote.sent',
      tenantId,
      aggregateType: 'quote',
      aggregateId: sent.id,
      payload: {
        quote_id: sent.id,
        customer_id: sent.customer_id,
        number: sent.number,
        is_resend: isResend,
      },
    });
    return sent;
  }

  /**
   * DUPLIQUE un devis, quel que soit son statut (aucune garde d etat : la
   * duplication ne modifie jamais le devis source).
   */
  async duplicate(tenantId: TenantId, actor: UserId, quoteId: string): Promise<QuoteDetailDto> {
    const exists = await this.repository.findById(tenantId, quoteId);
    if (!exists) throw new QuoteNotFoundError();
    return this.repository.duplicateQuote(tenantId, actor, quoteId);
  }

  /**
   * Journal d audit de l ENTETE d un devis (E10.10a), distinct du journal des
   * LIGNES. Meme garde d acces `can_manage_pricing` que `listAuditEntries`,
   * verifiee ICI avant toute lecture (403 explicite, jamais une page vide).
   */
  async listHeaderAuditEntries(
    tenantId: TenantId,
    actor: UserId,
    quoteId: string,
    params: Omit<ListQuoteHeaderAuditParams, 'quoteId'>,
  ): Promise<ListQuoteHeaderAuditResultDto> {
    const authorized = await this.repository.actorHasCapability(tenantId, actor, 'can_manage_pricing');
    if (!authorized) throw new QuoteAuditAccessDeniedError();

    const quote = await this.repository.findById(tenantId, quoteId);
    if (!quote) throw new QuoteNotFoundError();

    return this.repository.listHeaderAuditEntries(tenantId, { ...params, quoteId });
  }

  // ---------------------------------------------------------------------------
  // E10.9 — lignes de devis.
  // ---------------------------------------------------------------------------

  async getLine(tenantId: TenantId, quoteId: string, lineId: string): Promise<QuoteLineDto> {
    const line = await this.repository.findLineById(tenantId, quoteId, lineId);
    if (!line) throw new QuoteLineNotFoundError();
    return line;
  }

  /**
   * CA1-CA9 elargi (decision d Arnaud du 01/09) — ajoute une ligne, LIEE a un
   * chiffrage du projet source ou LIBRE. Resout systematiquement le prix par
   * `PriceRulesService.resolve()` + `PricingEngine.price()` : une ligne n est
   * jamais creee avec une marge « en attendant ».
   */
  async addLine(
    tenantId: TenantId,
    quoteId: string,
    command: CreateQuoteLineCommand,
  ): Promise<QuoteLineDto> {
    const quote = await this.repository.findById(tenantId, quoteId);
    if (!quote) throw new QuoteNotFoundError();

    const input = await this.resolveAddLineInput(tenantId, quote.project_id, command);
    const priced = await this.priceLine(tenantId, quote.customer_id, input);
    return this.repository.addLine(tenantId, quoteId, priced);
  }

  private async resolveAddLineInput(
    tenantId: TenantId,
    projectId: string,
    command: CreateQuoteLineCommand,
  ): Promise<ResolvedAddLineInput> {
    if ('project_item_id' in command) {
      const detail = await this.projects.findDetailById(tenantId, projectId);
      const item = (detail?.items ?? []).find((candidate) => candidate.id === command.project_item_id);
      if (!item) throw new QuoteLineProjectItemInvalidError();

      const payload = (item.quote_payload ?? {}) as Readonly<Record<string, unknown>>;
      const amounts = (payload['amounts'] ?? {}) as Readonly<Record<string, unknown>>;
      // qa-review (point mineur 3) — lecture de la chaine SOURCE, jamais un
      // detour par `Number()` : `serializeQuotePayload.ts` persiste deja ces
      // montants en chaine Money a 2 decimales (docs/api/CONVENTIONS.md §5),
      // un `Number(...).toFixed(2)` pourrait tronquer silencieusement un
      // payload a plus de 2 decimales et diverger du chemin SQL
      // (`(...)::numeric`, memes valeurs mais jamais rearrondi en JS).
      const rawPrice = amounts['clariprint_price_ht'] ?? amounts['price'];
      const productionPrice =
        typeof rawPrice === 'string' && moneyNonNegativeSchema.safeParse(rawPrice).success
          ? rawPrice
          : '0.00';
      const rawChiffrageQuantity = Math.trunc(Number(payload['quantity'] ?? 1));
      const chiffrageQuantity =
        Number.isFinite(rawChiffrageQuantity) && rawChiffrageQuantity >= 1 ? rawChiffrageQuantity : 1;

      return {
        kind: 'project_item',
        projectItemId: item.id,
        label: item.label,
        productConfig: payload,
        productionPrice,
        chiffrageQuantity,
        quantity: command.quantity ?? chiffrageQuantity,
      };
    }
    if (command.quantity < 1) throw new QuoteLineInvalidQuantityError();
    return {
      kind: 'free',
      label: command.label,
      quantity: command.quantity,
      productionPrice: command.production_price,
    };
  }

  private async priceLine(
    tenantId: TenantId,
    customerId: string,
    input: ResolvedAddLineInput,
  ): Promise<PricedQuoteLineWrite> {
    const at = this.now().toISOString().slice(0, 10);
    const resolved = await this.priceRules.resolve(tenantId, {
      customerId,
      productRangeId: null,
      at,
    });
    const priced = this.pricingEngine.price(
      { currency: 'EUR', posts: [{ post: 'total', amount: input.productionPrice }] },
      {
        rule: resolved.rule
          ? { id: resolved.rule.id, value_type: resolved.rule.value_type, value: resolved.rule.value }
          : null,
        defaultMarginRate: null,
      },
    );

    // A la creation, sale_price demarre sur customer_price (CA1) : remise et
    // ecart de marge nuls, quel que soit le geste ulterieur du commercial.
    const commercials = deriveLineCommercials({
      salePrice: priced.customer_price,
      productionPrice: priced.production_price,
      customerPrice: priced.customer_price,
      appliedMarginRate: priced.applied_margin_rate,
    });

    return {
      origin: input.kind,
      projectItemId: input.kind === 'project_item' ? input.projectItemId : null,
      label: input.label,
      productConfig: input.kind === 'project_item' ? input.productConfig : {},
      quantity: input.quantity,
      chiffrageQuantity: input.kind === 'project_item' ? input.chiffrageQuantity : null,
      productionPrice: priced.production_price,
      publicPrice: priced.public_price,
      customerPrice: priced.customer_price,
      appliedMarginRate: priced.applied_margin_rate,
      appliedRuleId: priced.applied_rule_id,
      salePrice: priced.customer_price,
      saleMarginRate: commercials.saleMarginRate,
      discountRate: commercials.discountRate,
      marginVariation: commercials.marginVariation,
      breakdown: priced.breakdown,
    };
  }

  /**
   * CA1-CA4, CA9 — modifie `sale_price` OU `margin_rate` (mutuellement
   * exclusifs, deja garanti par le schema Zod), et/ou `quantity`. Recalcule
   * systematiquement `discount_rate`/`margin_variation`, jamais transmis par
   * l appelant.
   */
  async updateLine(
    tenantId: TenantId,
    quoteId: string,
    lineId: string,
    command: UpdateQuoteLineCommand,
  ): Promise<QuoteLineDto> {
    const current = await this.repository.findLineById(tenantId, quoteId, lineId);
    if (!current) throw new QuoteLineNotFoundError();

    const update: { -readonly [K in keyof QuoteLineWriteUpdate]: QuoteLineWriteUpdate[K] } = {};

    let salePrice = current.sale_price;
    if (command.margin_rate !== undefined) {
      try {
        salePrice = salePriceFromMarginRate(current.production_price, command.margin_rate);
      } catch (cause) {
        if (cause instanceof MarginNotDerivableError) throw new QuoteLineMarginNotDerivableError();
        if (cause instanceof NegativeSalePriceError) throw new QuoteLineInvalidMarginRateError();
        throw cause;
      }
    } else if (command.sale_price !== undefined) {
      salePrice = command.sale_price;
    }

    if (command.sale_price !== undefined || command.margin_rate !== undefined) {
      const commercials = deriveLineCommercials({
        salePrice,
        productionPrice: current.production_price,
        customerPrice: current.customer_price,
        appliedMarginRate: current.applied_margin_rate,
      });
      update.salePrice = salePrice;
      update.saleMarginRate = commercials.saleMarginRate;
      update.discountRate = commercials.discountRate;
      update.marginVariation = commercials.marginVariation;
    }

    if (command.quantity !== undefined) {
      update.quantity = command.quantity;
    }

    return this.repository.updateLine(tenantId, quoteId, lineId, update);
  }

  async removeLine(tenantId: TenantId, quoteId: string, lineId: string): Promise<void> {
    const exists = await this.repository.findLineById(tenantId, quoteId, lineId);
    if (!exists) throw new QuoteLineNotFoundError();
    await this.repository.removeLine(tenantId, quoteId, lineId);
  }

  async reorderLines(
    tenantId: TenantId,
    quoteId: string,
    lineIds: readonly string[],
  ): Promise<QuoteDetailDto> {
    const exists = await this.repository.findById(tenantId, quoteId);
    if (!exists) throw new QuoteNotFoundError();
    return this.repository.reorderLines(tenantId, quoteId, lineIds);
  }

  /**
   * CA5, CA6 — journal d audit des lignes, lecture seule. Garde d acces au
   * droit `can_manage_pricing` (403 `identity.role_required`, E10.11)
   * verifiee ICI, avant toute lecture : un refus explicite ne doit jamais se
   * confondre avec une page vide (contrat `listQuoteAuditEntries`).
   */
  async listAuditEntries(
    tenantId: TenantId,
    actor: UserId,
    quoteId: string,
    params: Omit<ListQuoteLineAuditParams, 'quoteId'>,
  ): Promise<ListQuoteLineAuditResultDto> {
    const authorized = await this.repository.actorHasCapability(tenantId, actor, 'can_manage_pricing');
    if (!authorized) throw new QuoteAuditAccessDeniedError();

    const quote = await this.repository.findById(tenantId, quoteId);
    if (!quote) throw new QuoteNotFoundError();

    const result = await this.repository.listLineAuditEntries(tenantId, { ...params, quoteId });
    return {
      rows: result.rows.map((row) => ({
        id: row.id,
        quote_id: row.quote_id,
        quote_line_id: row.quote_line_id,
        change_set_id: row.change_set_id,
        action: row.action,
        field: row.field,
        previous_value: row.previous_value,
        new_value: row.new_value,
        line_snapshot: row.line_snapshot,
        actor_id: row.actor_id,
        actor_label: row.actor_label,
        occurred_at: row.occurred_at,
      })),
    };
  }
}

/**
 * Alertes de la ligne (CA7 amende), calculees a partir de son etat courant.
 * Exportee pour permettre a un adaptateur (Supabase, faux de test) de la
 * brancher sur `warnings` sans dupliquer la logique — meme raisonnement que
 * `deriveLineCommercials` (calcul UNIQUE, plusieurs appelants).
 */
export function quoteLineWarningsOf(
  line: Readonly<{
    origin: 'project_item' | 'free';
    quantity: number;
    chiffrageQuantity: number | null;
    salePrice: string;
    productionPrice: string;
  }>,
): readonly QuoteLineWarningDto[] {
  return computeQuoteLineWarnings(line);
}
