import type { TenantId, UserId } from '../../../kernel/ids/index.ts';
import type { OrderDocumentDto } from '../api/contracts.ts';

/**
 * La commande n a pas de document (404 `order.document_not_generated`, cote
 * atelier). CAS NOMINAL (contrat §8.20 §6, "toute commande dont personne n a
 * clique « Produire le bon de commande » rend ce code, indefiniment et sans
 * anomalie") — jamais une anomalie, jamais un cas a distinguer de "aucun
 * gabarit configure".
 */
export class OrderDocumentNotFoundError extends Error {
  constructor(message = 'Cette commande n a pas de bon de commande (aucune production demandee).') {
    super(message);
    this.name = 'OrderDocumentNotFoundError';
  }
}

/**
 * La commande porte DEJA son document (409 `order.document_already_generated`,
 * contrat §8.20 §6) : "le lire, ne pas le reproduire". A NE PAS CONFONDRE
 * avec le rejeu d idempotence (meme cle + meme requete -> 201), traduit par
 * le socle transverse, jamais par cette erreur.
 */
export class OrderDocumentAlreadyGeneratedError extends Error {
  constructor(message = 'Cette commande porte deja son bon de commande.') {
    super(message);
    this.name = 'OrderDocumentAlreadyGeneratedError';
  }
}

/**
 * Aucun gabarit `document_type: order` importe/`ready`/actif/par defaut pour
 * ce tenant (409 `order.document_template_missing`, contrat §8.20 §6) — un
 * defaut de PARAMETRAGE, pas une erreur d appel. AUCUN repli sur un gabarit
 * `quote`, jamais.
 */
export class OrderDocumentTemplateMissingError extends Error {
  constructor(message = 'Aucun gabarit de bon de commande actif pour ce tenant.') {
    super(message);
    this.name = 'OrderDocumentTemplateMissingError';
  }
}

/**
 * Un gabarit ETAIT eligible mais la production a echoue techniquement (fond
 * illisible, geometrie incoherente...) — 500, traduit par la route, JAMAIS un
 * repli silencieux : contrairement au devis (ou l echec degrade l envoi sans
 * piece jointe), il n y a ici rien d autre a degrader puisque cette operation
 * NE FAIT QUE produire le document.
 */
export class OrderDocumentGenerationFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OrderDocumentGenerationFailedError';
  }
}

export type StoreOrderDocumentParams = Readonly<{
  orderId: string;
  templateId: string;
  bytes: Uint8Array;
  pageCount: number;
  /** Instant de PRODUCTION reel (contrat : "ne coincide avec AUCUNE transmission"), jamais lu d une horloge ici. */
  generatedAt: string;
}>;

/**
 * Port (interface) du referentiel des documents PDF de commande produits
 * (E10.19b). L implementation Supabase vit dans
 * `src/adapters/supabase/order-documents-repository.ts` ; ce module n en
 * connait que le contrat.
 */
export interface OrderDocumentsRepository {
  /** Cote ATELIER (jeton utilisateur ou cle de service `orders:read`). `null` si la commande n a pas de document. */
  findByOrderId(tenantId: TenantId, orderId: string): Promise<OrderDocumentDto | null>;

  /**
   * Depose le PDF genere (bucket prive `order_documents`, chemin
   * `<tenant_id>/<order_id>.pdf`) PUIS enregistre la ligne via
   * `api_register_order_document` (security definer, resout
   * `generated_by`/`generated_by_label` depuis le jeton de l acteur) — UNE
   * SEULE FOIS par commande (contrainte d unicite `order_id`). Leve
   * `OrderDocumentAlreadyGeneratedError` sur une course perdue (unique
   * violation traduite), `CommercialOrderNotFoundError`-like `order.not_found`
   * / `OrderDocumentTemplateMissingError` en defense en profondeur (le
   * SERVICE a deja verifie les deux avant d atteindre cette methode). Rend l
   * URL de telechargement signee (300 s).
   */
  store(tenantId: TenantId, actor: UserId, params: StoreOrderDocumentParams): Promise<OrderDocumentDto>;
}
