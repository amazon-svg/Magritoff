/**
 * Implementation Supabase de la mise a disposition du fichier d export
 * (story E10.18c, contrat §8.24 point 3(d)). `service_role` SEUL : le
 * bucket `order_exports` ne porte AUCUNE policy `storage.objects`.
 *
 * Chemin JAMAIS choisi par l appelant : `<tenant_id>/<export_id>.<extension>`,
 * DETERMINISTE — meme discipline que `OrderDocument`
 * (`SupabaseOrderDocumentsRepository`), `upsert: false` : un second depot sur
 * le meme export echoue explicitement plutot que d ecraser silencieusement.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  OrderExportStorage,
  UploadOrderExportFileParams,
} from '../../modules/order-exports/application/order-export-storage.ts';

const BUCKET = 'order_exports';

export class SupabaseOrderExportStorage implements OrderExportStorage {
  constructor(private readonly serviceRoleClient: SupabaseClient<any>) {}

  async upload(params: UploadOrderExportFileParams): Promise<Readonly<{ storagePath: string }>> {
    const storagePath = `${params.tenantId}/${params.exportId}.${params.extension}`;
    const { error } = await this.serviceRoleClient.storage
      .from(BUCKET)
      .upload(storagePath, params.bytes, { contentType: params.contentType, upsert: false });
    if (error) throw new Error(`Depot du fichier d export ${params.exportId} impossible: ${error.message}`);
    return { storagePath };
  }
}
