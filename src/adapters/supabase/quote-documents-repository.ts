/**
 * Implementation Supabase du referentiel des documents PDF de devis produits
 * (story E10.10b-4c).
 *
 * DEUX clients, jamais confondus :
 *  - `privilegedClient` — `service_role`, SEUL role qui atteint la table
 *    `quote_documents` en ECRITURE (migration 20260909040000 :
 *    `revoke insert, update, delete ... from anon, authenticated`) ET le
 *    bucket prive du meme nom (aucune policy `storage.objects`). Sert AUSSI
 *    la lecture ATELIER : la RLS `quote_documents_select` ouvrirait la
 *    lecture a un client `authenticated`, mais ce role N A PAS le grant
 *    `insert` — em prunter deux clients differents pour lire et ecrire sur la
 *    MEME table introduirait une incoherence sans aucun benefice de
 *    securite, puisque `findByQuoteId` filtre de toute facon EXPLICITEMENT
 *    par `tenant_id` (seule barriere d isolation en lecture une fois le
 *    client privilegie en place — qa-review B1, corrige : la RLS n est plus
 *    la ligne de defense sur ce chemin, le filtre applicatif l est).
 *  - `storefrontClient` — cle publique SANS le JWT Magrit eventuellement
 *    present (meme discipline que `SupabaseStorefrontQuotesRepository`) :
 *    appelle `api_get_storefront_quote_document`, GRANT EXECUTE au seul role
 *    `anon`.
 *
 * qa-review B1 (BLOQUANT, corrige) : la version precedente recevait le
 * client `authenticated` (JWT de l appelant) en 1er argument, y compris pour
 * `store()` — or ce role n a AUCUN grant `insert` sur `quote_documents`
 * (verifie par `information_schema.role_table_grants` et par le scenario SQL
 * 2 de ce meme lot, qui prouve le refus). Consequence : `sendQuote`
 * echouait SYSTEMATIQUEMENT en 500 des qu un gabarit etait eligible — la
 * story entiere etait non fonctionnelle en production. Le composeur
 * (`supabase/functions/magrit-api/index.ts`) doit desormais passer un
 * client construit avec la cle `service_role` (le meme
 * `documentTemplatesStorageClient` que `document-templates`, deja
 * `service_role`) en 1er argument.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { TenantId, UserId } from '../../kernel/ids/index.ts';
import { toIsoTimestamp } from '../../modules/_shared/application/index.ts';
import type { QuoteDocumentDto } from '../../modules/quote-documents/api/contracts.ts';
import type {
  QuoteDocumentsRepository,
  StoreQuoteDocumentParams,
} from '../../modules/quote-documents/application/quote-documents-repository.ts';

const BUCKET = 'quote_documents';
/** Arbitrage Arnaud du 2026-09-09 (reserve (c)), FIGE au contrat (`QuoteDocument.download_url_expires_at`). */
const DOWNLOAD_URL_TTL_SECONDS = 300;

const DOCUMENT_COLUMNS = 'quote_id, template_id, generated_at, byte_size, sha256, content_type, page_count, storage_path';

export class SupabaseQuoteDocumentsRepository implements QuoteDocumentsRepository {
  constructor(
    /** `service_role` OBLIGATOIRE — voir en-tete de fichier (qa-review B1). Sert la table (lecture ET ecriture) et le bucket. */
    private readonly privilegedClient: SupabaseClient<any>,
    /** cle publique SANS JWT Magrit — meme discipline que `SupabaseStorefrontQuotesRepository`. */
    private readonly storefrontClient: SupabaseClient<any>,
  ) {}

  /**
   * `service_role` bypasse la RLS : le filtre `.eq('tenant_id', tenantId)`
   * ci-dessous est donc la SEULE barriere d isolation inter-tenant de cette
   * methode (qa-review B1) — a NE JAMAIS retirer.
   */
  async findByQuoteId(tenantId: TenantId, quoteId: string): Promise<QuoteDocumentDto | null> {
    const { data, error } = await this.privilegedClient
      .from('quote_documents')
      .select(DOCUMENT_COLUMNS)
      .eq('tenant_id', tenantId)
      .eq('quote_id', quoteId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;

    return this.toDto(data);
  }

  async findForStorefrontSession(sessionToken: string, quoteId: string): Promise<QuoteDocumentDto | null> {
    const { data, error } = await this.storefrontClient.rpc('api_get_storefront_quote_document', {
      p_opaque_token: sessionToken,
      p_quote_id: quoteId,
    });
    if (error) throw new Error(`api_get_storefront_quote_document: ${error.message}`);

    const row = Array.isArray(data) ? (data[0] as Record<string, unknown> | undefined) : undefined;
    if (!row) return null;

    return this.toDto(row);
  }

  /**
   * Depot UNE SEULE FOIS par devis. qa-review B2 (BLOQUANT, corrige) :
   * `upsert: true` a ete RETIRE — il permettait, si un bug amont appelait
   * jamais deux fois cette methode pour le meme `quote_id` (par ex. une
   * regression sur la garde `status === 'draft'` du service appelant),
   * d ECRASER SILENCIEUSEMENT le fichier d un document DEJA REMIS a un
   * client avant que la contrainte d unicite EN BASE (`quote_id`) n ait la
   * moindre chance de refuser quoi que ce soit — l upload precede toujours
   * l insert. Sans `upsert`, un second depot sur le meme chemin echoue
   * EXPLICITEMENT (objet deja existant), l operation entiere leve
   * `QuoteDocumentGenerationFailedError` (500), et le fichier de reference
   * reste intact. Contrepartie ASSUMEE, signalee plutot que masquee : un
   * rejeu legitime apres un echec MI-CHEMIN (upload reussi, insertion
   * ensuite en echec pour une raison independante) echouera desormais lui
   * aussi explicitement au lieu de reussir silencieusement — cas rarissime,
   * la garde de statut du service appelant (E10.10b-4c, `commercial-quotes-
   * service.ts`) rend de toute facon un second appel sur le MEME devis
   * structurellement improbable une fois celui-ci passe `sent`.
   */
  async store(tenantId: TenantId, actor: UserId, params: StoreQuoteDocumentParams): Promise<QuoteDocumentDto> {
    void actor; // trace : `generated_by` est renseigne depuis ce parametre, aucune verification de droit ici (la garde vit dans sendQuote).
    const storagePath = storagePathFor(tenantId, params.quoteId);

    const { error: uploadError } = await this.privilegedClient.storage
      .from(BUCKET)
      .upload(storagePath, params.bytes, { contentType: 'application/pdf' });
    if (uploadError) throw new Error(`Depot du document impossible : ${uploadError.message}`);

    const sha256 = await sha256Hex(params.bytes);

    const { data, error } = await this.privilegedClient
      .from('quote_documents')
      .insert({
        tenant_id: tenantId,
        quote_id: params.quoteId,
        template_id: params.templateId,
        storage_path: storagePath,
        byte_size: params.bytes.length,
        sha256,
        page_count: params.pageCount,
        generated_at: params.generatedAt,
        generated_by: actor,
      })
      .select(DOCUMENT_COLUMNS)
      .single();
    if (error) throw new Error(`Enregistrement du document impossible : ${error.message}`);

    return this.toDto(data);
  }

  private async toDto(row: Record<string, unknown>): Promise<QuoteDocumentDto> {
    const storagePath = String(row.storage_path);
    const { data: signed, error } = await this.privilegedClient.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, DOWNLOAD_URL_TTL_SECONDS);
    if (error || !signed) {
      throw new Error(`URL de telechargement impossible a emettre : ${error?.message ?? 'objet absent'}`);
    }

    return {
      quote_id: String(row.quote_id),
      template_id: String(row.template_id),
      generated_at: toIsoTimestamp(row.generated_at as string),
      byte_size: Number(row.byte_size),
      sha256: String(row.sha256),
      content_type: 'application/pdf',
      page_count: Number(row.page_count),
      download_url: signed.signedUrl,
      download_url_expires_at: new Date(Date.now() + DOWNLOAD_URL_TTL_SECONDS * 1000).toISOString(),
    };
  }
}

function storagePathFor(tenantId: TenantId, quoteId: string): string {
  return `${tenantId}/${quoteId}.pdf`;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as unknown as BufferSource);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
