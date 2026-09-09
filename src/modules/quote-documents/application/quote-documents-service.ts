/**
 * Service applicatif du module Document PDF de devis (story E10.10b-4c).
 *
 * Orchestre trois briques deja PURES ou deja isolees : la resolution de
 * gabarit eligible (`document-templates`, dependance externe existante
 * depuis 4a/4b), la resolution de valeurs (`document-field-value-resolver.ts`)
 * et le moteur de dessin (`quote-document-renderer.ts`). Ce fichier-ci EST le
 * point d integration Supabase-adjacent (il appelle des ports qui, eux,
 * touchent Supabase) mais ne fait lui-meme AUCUN accès reseau direct.
 *
 * qa-review B4-bis (BLOQUANT, corrige) — LA GENERATION NE PERSISTE PLUS
 * RIEN : `renderForFirstSend()` produit le PDF EN MEMOIRE (ni depot dans le
 * bucket, ni ligne `quote_documents`) et `persistRendered()` n est appelee
 * par `CommercialQuotesService.send()` qu APRES le succes CONFIRME de
 * `repository.sendQuote()`. Avant ce correctif, la version precedente
 * stockait le document AVANT l envoi : un envoi qui echouait ensuite
 * (`If-Match` perimee, garde de statut, transition concurrente) laissait un
 * document ORPHELIN sur un devis reste `draft` — modifiable — de sorte
 * qu un rejeu ulterieur, sur une ligne corrigee, pouvait faire recevoir au
 * client le PDF de la version PERIMEE du devis (contrainte d unicite
 * `quote_id`, la ligne existante etait reutilisee). Produire en memoire puis
 * persister seulement apres succes rend ce scenario STRUCTURELLEMENT
 * impossible : rien n est jamais ecrit avant que l envoi n ait reellement eu
 * lieu. Voir aussi le test dedie (`quote-documents-service.test.ts`,
 * « B4-bis »).
 */
import type { TenantId, UserId } from '../../../kernel/ids/index.ts';
import type { EligibleDocumentPdfTemplate } from '../../document-templates/application/document-templates-repository.ts';
import type { QuoteDocumentDto } from '../api/contracts.ts';
import {
  resolveDocumentFieldValues,
  resolveDocumentLineFieldValues,
  type ResolvableCustomer,
} from './document-field-value-resolver.ts';
import { renderQuoteDocument } from './quote-document-renderer.ts';
import {
  QuoteDocumentGenerationFailedError,
  QuoteDocumentNotFoundError,
  type QuoteDocumentsRepository,
} from './quote-documents-repository.ts';

/** Dependance NARROW sur le referentiel des gabarits (module `document-templates`) : une seule methode utilisee ici. */
export interface DocumentTemplateForGenerationPort {
  findEligibleTemplateForGeneration(tenantId: TenantId): Promise<EligibleDocumentPdfTemplate | null>;
}

/** Donnees CLIENT necessaires au document (`customer.*`), resolues dans le tenant du devis. */
export type CustomerDocumentData = ResolvableCustomer;

export interface CustomerDocumentDataPort {
  /** `null` si le client n existe plus (defensif, ne devrait pas arriver pour un devis reel). */
  findCustomerForDocument(tenantId: TenantId, customerId: string): Promise<CustomerDocumentData | null>;
}

const EMPTY_CUSTOMER: CustomerDocumentData = Object.freeze({
  companyName: null,
  contactName: null,
  billingLine1: null,
  billingLine2: null,
  billingPostalCode: null,
  billingCity: null,
  billingCountry: null,
  email: null,
  phone: null,
  siret: null,
  vatNumber: null,
});

export type QuoteLineForDocumentGeneration = Readonly<{
  position: number;
  label: string;
  productConfig: Readonly<Record<string, unknown>>;
  quantity: number;
  /** `customer_price` de la ligne — masque par l appelant quand `show_discounts` est faux (jamais recalcule ici). */
  priceBeforeDiscount: string | null;
  discountRate: string | null;
  /** `sale_price` — TOUJOURS transmis, remises visibles ou non. */
  price: string;
}>;

export type QuoteTotalsForDocumentGeneration = Readonly<{
  /** `null` quand `show_discounts` est faux (masque par l appelant, jamais recalcule ici). */
  linesSubtotal: string | null;
  globalDiscount: string | null;
  netTotal: string;
  vatRate: string;
  vatAmount: string;
  totalInclTax: string;
}>;

/**
 * Devis PRET a etre imprime : deja filtre par l appelant selon
 * `show_discounts` (E10.10b-1 decision 3 — la regle reste SERVEUR, appliquee
 * UNE FOIS, jamais par ce service ni par la carte de champs).
 */
export type QuoteForDocumentGeneration = Readonly<{
  id: string;
  customerId: string;
  number: string;
  /** `YYYY-MM-DD`, ou `null`. */
  validUntil: string | null;
  totals: QuoteTotalsForDocumentGeneration;
  lines: readonly QuoteLineForDocumentGeneration[];
}>;

/**
 * Document RENDU EN MEMOIRE, pas encore persiste (qa-review B4-bis) :
 * `renderForFirstSend()` le rend, `persistRendered()` le stocke — SEULEMENT
 * apres le succes confirme de l envoi.
 */
export type RenderedDocumentForSend = Readonly<{
  templateId: string;
  bytes: Uint8Array;
  pageCount: number;
  /** Coincide par construction avec l instant d envoi (`issuedAt` transmis a `renderForFirstSend`). */
  generatedAt: string;
}>;

export type QuoteDocumentsServiceDependencies = Readonly<{
  templates: DocumentTemplateForGenerationPort;
  customers: CustomerDocumentDataPort;
  repository: QuoteDocumentsRepository;
}>;

export class QuoteDocumentsService {
  private readonly templates: DocumentTemplateForGenerationPort;
  private readonly customers: CustomerDocumentDataPort;
  private readonly repository: QuoteDocumentsRepository;

  constructor(dependencies: QuoteDocumentsServiceDependencies) {
    this.templates = dependencies.templates;
    this.customers = dependencies.customers;
    this.repository = dependencies.repository;
  }

  /** Cote ATELIER. Leve `QuoteDocumentNotFoundError` (404 `quote.document_not_generated`) si le devis n a pas de document. */
  async getForQuote(tenantId: TenantId, quoteId: string): Promise<QuoteDocumentDto> {
    const document = await this.repository.findByQuoteId(tenantId, quoteId);
    if (!document) throw new QuoteDocumentNotFoundError();
    return document;
  }

  /** Cote PORTAIL CLIENT. `null` sur toutes les causes confondues (404 indiscernable, contrat). */
  getForStorefrontSession(sessionToken: string, quoteId: string): Promise<QuoteDocumentDto | null> {
    return this.repository.findForStorefrontSession(sessionToken, quoteId);
  }

  /**
   * Genere le document du PREMIER envoi d un devis EN MEMOIRE — qa-review
   * B4-bis : AUCUNE persistance ici (ni bucket, ni `quote_documents`), voir
   * l en-tete de fichier. Rend `null` quand AUCUN gabarit n est eligible (cas
   * NOMINAL (a) : l envoi part sans piece jointe). Leve
   * `QuoteDocumentGenerationFailedError` quand un gabarit ETAIT eligible
   * mais que la production a echoue techniquement (reserve (j)) — c est a
   * l APPELANT de ne PAS transitionner le devis dans ce cas.
   *
   * JAMAIS appelee sur un RENVOI (contrat §8.18 §5, "generation unique") :
   * c est `CommercialQuotesService.send()` qui porte cette garde, pas cette
   * methode.
   */
  async renderForFirstSend(
    tenantId: TenantId,
    quote: QuoteForDocumentGeneration,
    issuedAt: string,
  ): Promise<RenderedDocumentForSend | null> {
    try {
      // qa-review (non bloquant, corrige avec B3) : cet appel vivait
      // AUPARAVANT hors du `try` — une erreur SQL (panne transitoire,
      // reseau) y remontait alors en `Error` nue, jamais traduite en
      // `QuoteDocumentGenerationFailedError` comme le contrat le declare
      // pour ce 500. Desormais a l interieur, comme le reste de la chaine.
      const eligible = await this.templates.findEligibleTemplateForGeneration(tenantId);
      if (!eligible) return null;

      const customer = (await this.customers.findCustomerForDocument(tenantId, quote.customerId)) ?? EMPTY_CUSTOMER;

      const fieldValues = resolveDocumentFieldValues(
        { number: quote.number, issuedAt, validUntil: quote.validUntil },
        customer,
        quote.totals,
      );
      const lineValues = quote.lines.map((line) => resolveDocumentLineFieldValues(line));

      const rendered = await renderQuoteDocument({
        backgroundBytes: eligible.backgroundBytes,
        pages: eligible.pages,
        placements: eligible.placements,
        linesBlock: eligible.linesBlock,
        fieldValues,
        lineValues,
      });

      return {
        templateId: eligible.templateId,
        bytes: rendered.bytes,
        pageCount: rendered.pageCount,
        generatedAt: issuedAt,
      };
    } catch (cause) {
      if (cause instanceof QuoteDocumentGenerationFailedError) throw cause;
      throw new QuoteDocumentGenerationFailedError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  /**
   * Persiste (bucket + `quote_documents`) un document DEJA RENDU — qa-review
   * B4-bis : a n appeler QU APRES le succes CONFIRME de
   * `repository.sendQuote()` (voir `CommercialQuotesService.send()`), jamais
   * avant. Le devis est alors deja irrevocablement `sent` : un echec de
   * PERSISTANCE a ce stade ne doit plus jamais faire regenerer le document
   * (contrat : "generation unique, jamais regeneree") — l appelant decide
   * s il degrade (devis envoye sans piece jointe, comme si aucun gabarit n
   * avait ete configure) ou s il fait remonter l echec.
   */
  async persistRendered(
    tenantId: TenantId,
    actor: UserId,
    quoteId: string,
    rendered: RenderedDocumentForSend,
  ): Promise<QuoteDocumentDto> {
    return this.repository.store(tenantId, actor, {
      quoteId,
      templateId: rendered.templateId,
      bytes: rendered.bytes,
      pageCount: rendered.pageCount,
      generatedAt: rendered.generatedAt,
    });
  }
}
