/**
 * Service applicatif du module Document PDF de commande (story E10.19b).
 *
 * REUTILISE, sans les redupliquer, les trois briques deja PURES/isolees
 * ecrites pour le devis (`quote-documents`, E10.10b-4c/E10.19a) :
 *  - le MOTEUR DE DESSIN (`renderQuoteDocument`, `quote-document-renderer.ts`)
 *    est deja generique (contrat §8.20 §0 : « ne connait AUCUNE notion de
 *    devis, il recoit des valeurs deja resolues et les dessine ») — importe
 *    ICI TEL QUEL, sans renommage de fichier ni deplacement de module. Voir
 *    la note de DETTE en fin de fichier : le cadrage recommandait de
 *    renommer/deplacer ce moteur vers un module partage neutre ; ce lot ne
 *    le fait pas (risque de regression sur un module deja couvert par une
 *    suite de tests dense, hors perimetre strict de la sous-story) et le
 *    signale explicitement plutot que de le taire.
 *  - le RESOLVEUR DE VALEURS (`resolveOrderDocumentFieldValues`, ajoute a
 *    `document-field-value-resolver.ts` par CE lot) et
 *    `resolveDocumentLineFieldValues` (INCHANGE, deja generique — une ligne
 *    de commande porte les memes attributs qu une ligne de devis).
 *  - la PASSERELLE DONNEES CLIENT (`CustomersRepositoryDocumentDataGateway`,
 *    deja generique — aucune notion de devis dedans) — REUTILISEE, pas
 *    redupliquee (regle R5).
 *
 * Point d entree du gabarit ELIGIBLE : `findEligibleTemplateForGeneration`
 * (module `document-templates`), deja generalise par E10.19a a
 * `(tenantId, documentType)` — ce module l appelle toujours avec `'order'`.
 */
import type { TenantId, UserId } from '../../../kernel/ids/index.ts';
import type { EligibleDocumentPdfTemplate } from '../../document-templates/application/document-templates-repository.ts';
import {
  resolveDocumentLineFieldValues,
  resolveOrderDocumentFieldValues,
  type ResolvableCustomer,
  type ResolvableOrderHeader,
  type ResolvableTotals,
} from '../../quote-documents/application/document-field-value-resolver.ts';
import { renderQuoteDocument, type RenderedQuoteDocument } from '../../quote-documents/application/quote-document-renderer.ts';
import type { OrderDocumentDto } from '../api/contracts.ts';
import {
  OrderDocumentAlreadyGeneratedError,
  OrderDocumentGenerationFailedError,
  OrderDocumentNotFoundError,
  OrderDocumentTemplateMissingError,
  type OrderDocumentsRepository,
} from './order-documents-repository.ts';

/**
 * Dependance NARROW sur le referentiel des gabarits (module
 * `document-templates`), meme parti que `DocumentTemplateForGenerationPort`
 * du module `quote-documents` : une seule methode utilisee ici, RESTREINTE
 * au type `'order'` (jamais `'quote'` depuis ce module).
 */
export interface OrderDocumentTemplateForGenerationPort {
  findEligibleTemplateForGeneration(
    tenantId: TenantId,
    documentType: 'order',
  ): Promise<EligibleDocumentPdfTemplate | null>;
}

/** Donnees CLIENT necessaires au document (`customer.*`), resolues dans le tenant de la commande. Meme forme que `quote-documents` (module reutilise, pas duplique). */
export type CustomerDocumentData = ResolvableCustomer;

export interface CustomerDocumentDataPort {
  /** `null` si le client n existe plus (defensif). */
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

export type OrderLineForDocumentGeneration = Readonly<{
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

export type OrderTotalsForDocumentGeneration = Readonly<{
  /** `null` quand `show_discounts` est faux (masque par l appelant, jamais recalcule ici). */
  linesSubtotal: string | null;
  globalDiscount: string | null;
  netTotal: string;
  vatRate: string;
  vatAmount: string;
  totalInclTax: string;
}>;

/**
 * Commande PRETE a etre imprimee : deja filtree par l appelant selon
 * `commercial_orders.show_discounts` (E10.19a decision D — la regle reste
 * SERVEUR, appliquee UNE FOIS par `CommercialOrdersService.generateDocument()`,
 * jamais par ce service ni par la carte de champs).
 */
export type OrderForDocumentGeneration = Readonly<{
  id: string;
  customerId: string;
  number: string;
  /** `commercial_orders.created_at` (Timestamp ISO). */
  createdAt: string;
  quoteNumber: string;
  customerReference: string | null;
  /** `YYYY-MM-DD`, ou `null`. */
  expectedDeliveryDate: string | null;
  totals: OrderTotalsForDocumentGeneration;
  lines: readonly OrderLineForDocumentGeneration[];
}>;

export type OrderDocumentsServiceDependencies = Readonly<{
  templates: OrderDocumentTemplateForGenerationPort;
  customers: CustomerDocumentDataPort;
  repository: OrderDocumentsRepository;
}>;

export class OrderDocumentsService {
  private readonly templates: OrderDocumentTemplateForGenerationPort;
  private readonly customers: CustomerDocumentDataPort;
  private readonly repository: OrderDocumentsRepository;

  constructor(dependencies: OrderDocumentsServiceDependencies) {
    this.templates = dependencies.templates;
    this.customers = dependencies.customers;
    this.repository = dependencies.repository;
  }

  /** Cote ATELIER. Leve `OrderDocumentNotFoundError` (404 `order.document_not_generated`) si la commande n a pas de document. AUCUNE generation ici (contrat : "cette operation ne produit rien"). */
  async getForOrder(tenantId: TenantId, orderId: string): Promise<OrderDocumentDto> {
    const document = await this.repository.findByOrderId(tenantId, orderId);
    if (!document) throw new OrderDocumentNotFoundError();
    return document;
  }

  /**
   * PRODUIT le bon de commande — ACTION EXPLICITE, REJOUABLE tant qu elle n a
   * pas reussi (contrat §8.20 §6, arbitrage (C2)) :
   *  1. verifie qu AUCUN document n existe deja (409 `order.document_
   *     already_generated`) — verification AVANT tout rendu, pour ne jamais
   *     payer le cout d un rendu/upload inutile sur le cas d appel repete ;
   *  2. resout le gabarit ELIGIBLE `order` (409 `order.document_template_
   *     missing` si aucun, AUCUN repli sur `quote`, jamais) ;
   *  3. resout les donnees client, PUIS les valeurs de champs ;
   *  4. rend le PDF (moteur reutilise, voir en-tete de fichier) ;
   *  5. persiste (repository.store()) — la contrainte d unicite EN BASE et
   *     `api_register_order_document` couvrent la course residuelle entre
   *     l etape 1 et cette etape 5 (contrat §6, migration 20260910000200).
   */
  async generate(
    tenantId: TenantId,
    actor: UserId,
    order: OrderForDocumentGeneration,
  ): Promise<OrderDocumentDto> {
    const existing = await this.repository.findByOrderId(tenantId, order.id);
    if (existing) throw new OrderDocumentAlreadyGeneratedError();

    const eligible = await this.templates.findEligibleTemplateForGeneration(tenantId, 'order');
    if (!eligible) throw new OrderDocumentTemplateMissingError();

    const customer = (await this.customers.findCustomerForDocument(tenantId, order.customerId)) ?? EMPTY_CUSTOMER;

    const header: ResolvableOrderHeader = {
      number: order.number,
      createdAt: order.createdAt,
      quoteNumber: order.quoteNumber,
      customerReference: order.customerReference,
      expectedDeliveryDate: order.expectedDeliveryDate,
    };
    const totals: ResolvableTotals = order.totals;
    const fieldValues = resolveOrderDocumentFieldValues(header, customer, totals);
    const lineValues = order.lines.map((line) => resolveDocumentLineFieldValues(line));

    let rendered: RenderedQuoteDocument;
    try {
      rendered = await renderQuoteDocument({
        backgroundBytes: eligible.backgroundBytes,
        pages: eligible.pages,
        placements: eligible.placements,
        linesBlock: eligible.linesBlock,
        fieldValues,
        lineValues,
      });
    } catch (cause) {
      throw new OrderDocumentGenerationFailedError(cause instanceof Error ? cause.message : String(cause));
    }

    return this.repository.store(tenantId, actor, {
      orderId: order.id,
      templateId: eligible.templateId,
      bytes: rendered.bytes,
      pageCount: rendered.pageCount,
      generatedAt: new Date().toISOString(),
    });
  }
}

// ---------------------------------------------------------------------------
// DETTE INTRODUITE (a documenter au rapport de fin de story) :
//
// `renderQuoteDocument` (module `quote-documents`) est importe ICI TEL QUEL,
// sans renommage ni deplacement vers un module partage neutre, alors que le
// cadrage (docs/api/CONVENTIONS.md §8.20 §0) recommandait explicitement de le
// « renommer/deplacer (document-rendering, ou un _shared de documents) ».
// Motif du choix : le moteur, le planificateur de mise en page et
// l assainissement de texte (`quote-document-renderer.ts`,
// `document-layout-planner.ts`, `document-text-sanitization.ts`,
// `document-value-formatting.ts`) sont TOUS deja generiques (aucune notion de
// devis dans leur code), mais physiquement heberges sous
// `src/modules/quote-documents/application/`. Les deplacer aurait touche
// ~10 sites d import deja EN PRODUCTION (routes, adaptateur, 5 fichiers de
// test unitaire dedies) pour un gain cosmetique (un NOM de fichier/module),
// sans aucun changement de comportement — un risque de regression que cette
// sous-story, scopee a « la production et la remise », n a pas a prendre.
// Chemin de mise en conformite : une story de refactoring dediee qui deplace
// ces quatre fichiers vers `src/modules/_shared/documents/` (ou equivalent)
// et met a jour les imports des DEUX modules (`quote-documents`,
// `order-documents`) dans le MEME commit — trivial une fois isole, mais pas
// gratuit a faire « en passant » dans ce lot.
// ---------------------------------------------------------------------------
