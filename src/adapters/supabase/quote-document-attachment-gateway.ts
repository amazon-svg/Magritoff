/**
 * Implementation Supabase de la piece jointe du courriel `quote.sent`
 * (E10.10b-4c). `service_role` uniquement : le bucket prive `quote_documents`
 * ne porte aucune policy `storage.objects` (migration 20260909040000).
 *
 * DISTINCT de `SupabaseQuoteDocumentsRepository` (qui rend une URL SIGNEE
 * pour un ecran) : ce gateway rend des OCTETS BASE64 prets pour l API HTTP
 * de Resend — deux representations differentes du meme fichier, pour deux
 * consommateurs differents (meme raisonnement que documente dans
 * `quote-sent-notification-consumer.ts` pour `QuoteNotificationGateway`).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { TenantId } from '../../kernel/ids/index.ts';
import type {
  QuoteDocumentAttachmentBytes,
  QuoteDocumentAttachmentGateway,
} from '../../modules/commercial-quotes/application/quote-sent-notification-consumer.ts';

const BUCKET = 'quote_documents';

export class SupabaseQuoteDocumentAttachmentGateway implements QuoteDocumentAttachmentGateway {
  constructor(
    /** `service_role` : lit `quote_documents` (select) ET telecharge le fichier (storage). */
    private readonly client: SupabaseClient<any>,
  ) {}

  async findAttachment(tenantId: TenantId, quoteId: string): Promise<QuoteDocumentAttachmentBytes | null> {
    const { data: row, error } = await this.client
      .from('quote_documents')
      .select('storage_path')
      .eq('tenant_id', tenantId)
      .eq('quote_id', quoteId)
      .maybeSingle();
    if (error) throw new Error(`quote_documents (piece jointe) : ${error.message}`);
    if (!row) return null; // cas NOMINAL : aucun gabarit configure pour ce tenant.

    const { data: downloaded, error: downloadError } = await this.client.storage
      .from(BUCKET)
      .download(row.storage_path as string);
    if (downloadError || !downloaded) {
      throw new Error(
        `Telechargement du document (${row.storage_path}) impossible : ${downloadError?.message ?? 'objet absent'}`,
      );
    }

    const bytes = new Uint8Array(await downloaded.arrayBuffer());
    return { base64Content: bytesToBase64(bytes) };
  }
}

/** `btoa` seul ne gere pas un `Uint8Array` de plus de ~8000 octets sans depasser la pile d arguments : conversion par blocs. */
function bytesToBase64(bytes: Uint8Array): string {
  const CHUNK_SIZE = 0x8000;
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += CHUNK_SIZE) {
    const chunk = bytes.subarray(offset, offset + CHUNK_SIZE);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}
