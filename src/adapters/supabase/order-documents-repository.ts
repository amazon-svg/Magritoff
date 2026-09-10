/**
 * Implementation Supabase du referentiel des documents PDF de commande
 * produits (story E10.19b).
 *
 * DEUX clients, jamais confondus, et ECART DELIBERE avec
 * `SupabaseQuoteDocumentsRepository` (module `quote-documents`) — motif au
 * long dans la migration `20260910000200_gescom_e10_19b_order_documents.sql` :
 *  - `authenticatedClient` — le client construit avec le JETON DE L ACTEUR
 *    (role `authenticated`). Sert LA LECTURE (RLS `order_documents_select`,
 *    ouverte a tout membre du tenant) ET L ECRITURE, via la fonction
 *    `security definer` `api_register_order_document` : cette fonction
 *    resout `generated_by`/`generated_by_label` depuis `auth.uid()`, qui
 *    n existe QUE si l appel porte le jeton de l acteur — un client
 *    `service_role` n a AUCUNE session, `auth.uid()` y rendrait NULL et la
 *    fonction refuserait systematiquement (`authentication_required`).
 *  - `privilegedClient` — `service_role`, seul role qui atteint le bucket
 *    prive `order_documents` (aucune policy `storage.objects`, meme patron
 *    que `document_pdf_templates`/`quote_documents`). Sert LE DEPOT des
 *    octets et LA SIGNATURE de l URL de telechargement, jamais la table.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { TenantId, UserId } from '../../kernel/ids/index.ts';
import { toIsoTimestamp } from '../../modules/_shared/application/index.ts';
import type { OrderDocumentDto } from '../../modules/order-documents/api/contracts.ts';
import {
  OrderDocumentAlreadyGeneratedError,
  OrderDocumentGenerationFailedError,
  OrderDocumentTemplateMissingError,
  type OrderDocumentsRepository,
  type StoreOrderDocumentParams,
} from '../../modules/order-documents/application/order-documents-repository.ts';
import { CommercialOrderNotFoundError } from '../../modules/commercial-orders/application/commercial-orders-repository.ts';

const BUCKET = 'order_documents';
/** Meme valeur et meme motif que `QuoteDocument.download_url_expires_at` (contrat §8.20 §6) : un telechargement est un CLIC, pas une session. */
const DOWNLOAD_URL_TTL_SECONDS = 300;

const DOCUMENT_COLUMNS =
  'order_id, template_id, generated_at, generated_by, generated_by_label, byte_size, sha256, content_type, page_count, storage_path';

export class SupabaseOrderDocumentsRepository implements OrderDocumentsRepository {
  constructor(
    /** JETON DE L ACTEUR (role `authenticated`) — OBLIGATOIRE pour `api_register_order_document`, voir en-tete de fichier. */
    private readonly authenticatedClient: SupabaseClient<any>,
    /** `service_role` — bucket UNIQUEMENT, jamais la table. */
    private readonly privilegedClient: SupabaseClient<any>,
  ) {}

  async findByOrderId(tenantId: TenantId, orderId: string): Promise<OrderDocumentDto | null> {
    const { data, error } = await this.authenticatedClient
      .from('order_documents')
      .select(DOCUMENT_COLUMNS)
      .eq('tenant_id', tenantId)
      .eq('order_id', orderId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;

    return this.toDto(data);
  }

  /**
   * Depot UNE SEULE FOIS par commande — meme discipline (SANS `upsert`) que
   * `SupabaseQuoteDocumentsRepository.store()` : un second depot sur le meme
   * chemin echoue EXPLICITEMENT plutot que d ecraser silencieusement un
   * document deja remis.
   *
   * qa-review B1 (BLOQUANT, corrige) — CONTRAIREMENT au devis (aucune
   * operation de rejeu, "un second appel sur le meme devis structurellement
   * improbable"), le contrat de CE lot promet EXPLICITEMENT que la
   * production "se rejoue telle quelle" tant qu elle n a pas reussi (§8.20
   * §5, decision C2 : "l action explicite est ce qui rend l echec
   * rattrapable, c est tout ce qui la justifie"). Recopier tel quel le
   * "sans upsert" de `quote-documents` cassait cette promesse : si l upload
   * REUSSIT mais que l enregistrement en base ECHOUE ensuite (timeout,
   * coupure reseau, 5xx PostgREST — la production dure "quelques secondes",
   * le contrat lui-meme reconnait ce risque), le chemin de stockage
   * DETERMINISTE (`storagePathFor`) reste occupe par un objet ORPHELIN :
   * tout rejeu ulterieur echouait alors ETERNELLEMENT des l etape upload()
   * (« resource already exists »), sans aucun moyen de se rattraper sans
   * intervention manuelle dans le bucket.
   *
   * COMPENSATION, PAS `upsert: true` NU : un `upsert: true` sans garde
   * laisserait une invocation PERDANTE d une course reelle ECRASER les
   * octets du document deja enregistre par le GAGNANT — le `sha256` en base
   * resterait celui du gagnant alors que l objet aurait change, cassant la
   * promesse du schema `OrderDocument.sha256` ("meme fichier d une lecture a
   * l autre"). Cette methode supprime donc l objet qu ELLE VIENT
   * D UPLOADER **uniquement si aucune ligne `order_documents` n existe pour
   * cette commande au moment de l echec** (`findByOrderId` re-verifie) : si
   * une ligne existe deja (le cas `order.document_already_generated`, la
   * SEULE facon realiste d atteindre ce cas apres un upload REUSSI par
   * CETTE invocation — le chemin deterministe et l absence d upsert rendent
   * la course elle-meme quasi impossible), c est que quelqu un d autre a
   * gagne : l objet au chemin deterministe est alors LE SIEN, jamais
   * supprime.
   */
  async store(tenantId: TenantId, actor: UserId, params: StoreOrderDocumentParams): Promise<OrderDocumentDto> {
    void actor; // trace : generated_by/generated_by_label sont resolus par la RPC depuis auth.uid(), jamais depuis ce parametre.
    const storagePath = storagePathFor(tenantId, params.orderId);

    const { error: uploadError } = await this.privilegedClient.storage
      .from(BUCKET)
      .upload(storagePath, params.bytes, { contentType: 'application/pdf' });
    if (uploadError) throw new OrderDocumentGenerationFailedError(`Depot du document impossible : ${uploadError.message}`);

    const sha256 = await sha256Hex(params.bytes);

    const { data, error } = await this.authenticatedClient.rpc('api_register_order_document', {
      p_tenant_id: tenantId,
      p_order_id: params.orderId,
      p_template_id: params.templateId,
      p_storage_path: storagePath,
      p_byte_size: params.bytes.length,
      p_sha256: sha256,
      p_page_count: params.pageCount,
      p_generated_at: params.generatedAt,
    });

    if (error) {
      const mapped = mapRegisterOrderDocumentError(error.message);
      // La garde : ne supprimer QUE si AUCUNE ligne n a ete enregistree pour
      // cette commande entre-temps — sinon l objet au chemin deterministe
      // est celui du gagnant, jamais touche.
      const winner = await this.findByOrderId(tenantId, params.orderId);
      if (!winner) {
        const { error: removeError } = await this.privilegedClient.storage.from(BUCKET).remove([storagePath]);
        if (removeError) {
          // Best-effort, ne masque JAMAIS l erreur d origine : un objet
          // orphelin qui survivrait malgre cette tentative fera echouer le
          // PROCHAIN rejeu de la meme facon — signale, jamais avale.
          console.error(
            `order_documents: nettoyage de l objet orphelin ${storagePath} impossible (${removeError.message}) — le prochain rejeu de generateOrderDocument echouera tant que l objet n aura pas ete retire manuellement.`,
          );
        }
      }
      throw mapped;
    }

    const row = Array.isArray(data) ? (data[0] as Record<string, unknown> | undefined) : (data as Record<string, unknown>);
    if (!row) throw new Error('api_register_order_document n a rendu aucune ligne.');

    return this.toDto(row);
  }

  private async toDto(row: Record<string, unknown>): Promise<OrderDocumentDto> {
    const storagePath = String(row.storage_path);
    const { data: signed, error } = await this.privilegedClient.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, DOWNLOAD_URL_TTL_SECONDS);
    if (error || !signed) {
      throw new Error(`URL de telechargement impossible a emettre : ${error?.message ?? 'objet absent'}`);
    }

    return {
      order_id: String(row.order_id),
      template_id: String(row.template_id),
      generated_at: toIsoTimestamp(row.generated_at as string),
      generated_by: row.generated_by ? String(row.generated_by) : null,
      generated_by_label: row.generated_by_label ? String(row.generated_by_label) : null,
      byte_size: Number(row.byte_size),
      sha256: String(row.sha256),
      content_type: 'application/pdf',
      page_count: Number(row.page_count),
      download_url: signed.signedUrl,
      download_url_expires_at: new Date(Date.now() + DOWNLOAD_URL_TTL_SECONDS * 1000).toISOString(),
    };
  }
}

function storagePathFor(tenantId: TenantId, orderId: string): string {
  return `${tenantId}/${orderId}.pdf`;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as unknown as BufferSource);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Traduit le message d exception de `api_register_order_document` en erreur
 * de domaine. ORDRE identique a la fonction SQL (authentication_required ->
 * permission_denied -> order.not_found -> order.document_template_missing ->
 * order.document_already_generated, migration 20260910000200).
 */
function mapRegisterOrderDocumentError(message: string): Error {
  if (message.includes('order.document_already_generated')) {
    return new OrderDocumentAlreadyGeneratedError(message);
  }
  if (message.includes('order.document_template_missing')) {
    return new OrderDocumentTemplateMissingError(message);
  }
  if (message.includes('order.not_found')) {
    return new CommercialOrderNotFoundError(message);
  }
  if (message.includes('permission_denied')) {
    return new Error(`permission_denied: ${message}`);
  }
  if (message.includes('authentication_required')) {
    return new Error(`authentication_required: ${message}`);
  }
  return new OrderDocumentGenerationFailedError(`Enregistrement du bon de commande impossible : ${message}`);
}
