import type { TenantId, UserId } from '../../../kernel/ids/index.ts';
import type { QuoteDocumentDto } from '../api/contracts.ts';

/**
 * Le devis n a pas de document (404 `quote.document_not_generated`, cote
 * atelier). CAS LE PLUS FREQUENT (contrat §8.18 §7 reserve (a)) : couvre a la
 * fois « aucun gabarit eligible au moment de l envoi » et « devis envoye
 * avant E10.10b-4c », les deux SANS distinction ni reprise retroactive.
 */
export class QuoteDocumentNotFoundError extends Error {
  constructor(message = "Ce devis n a pas de document (aucun gabarit n etait eligible a l envoi).") {
    super(message);
    this.name = 'QuoteDocumentNotFoundError';
  }
}

/**
 * Un gabarit ETAIT eligible (`ready`, actif, par defaut, carte non vide) mais
 * la production a echoue techniquement — 500 `quote.document_generation_failed`
 * (contrat §8.18 §5/§7 reserve (j)). Traduit par la route en 500, JAMAIS en
 * repli silencieux : l envoi ECHOUE entierement, le devis reste `draft`.
 */
export class QuoteDocumentGenerationFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuoteDocumentGenerationFailedError';
  }
}

export type StoreQuoteDocumentParams = Readonly<{
  quoteId: string;
  templateId: string;
  bytes: Uint8Array;
  pageCount: number;
  /** Instant de generation, EGAL par construction a l instant d envoi (contrat, `QuoteDocument.generated_at`) — jamais lu d une horloge ici. */
  generatedAt: string;
}>;

/**
 * Port (interface) du referentiel des documents PDF de devis produits
 * (E10.10b-4c). L implementation Supabase vit dans
 * `src/adapters/supabase/quote-documents-repository.ts` ; ce module n en
 * connait que le contrat.
 */
export interface QuoteDocumentsRepository {
  /** Cote ATELIER (jeton utilisateur ou cle de service `quotes:read`). `null` si le devis n a pas de document. */
  findByQuoteId(tenantId: TenantId, quoteId: string): Promise<QuoteDocumentDto | null>;

  /**
   * Cote PORTAIL CLIENT (session boutique). `null` sur TOUTES les causes
   * confondues (devis inconnu, d un autre client, encore `draft`, sans
   * document) — 404 INDISCERNABLE (contrat, meme regle que
   * `getStorefrontQuote`).
   */
  findForStorefrontSession(sessionToken: string, quoteId: string): Promise<QuoteDocumentDto | null>;

  /**
   * Stocke le PDF genere (bucket prive `quote_documents`, chemin
   * `<tenant_id>/<quote_id>.pdf`) et insere la ligne `quote_documents` UNE
   * SEULE FOIS (contrainte d unicite `quote_id`, jamais reappelee pour un
   * meme devis). Rend l URL de telechargement signee (300 s).
   */
  store(tenantId: TenantId, actor: UserId, params: StoreQuoteDocumentParams): Promise<QuoteDocumentDto>;
}
