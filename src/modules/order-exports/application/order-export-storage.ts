/**
 * Port de mise a disposition du fichier produit (story E10.18c, contrat
 * §8.24 point 3(d)). Bucket prive `order_exports`, chemin JAMAIS choisi par
 * l appelant : `<tenant_id>/<export_id>.<extension>`, forme par
 * l implementation (meme discipline que `OrderDocument`/`QuoteDocument`).
 */
import type { TenantId } from '../../../kernel/ids/index.ts';

export type UploadOrderExportFileParams = Readonly<{
  tenantId: TenantId;
  exportId: string;
  extension: 'csv' | 'xlsx';
  bytes: Uint8Array;
  contentType: string;
}>;

export interface OrderExportStorage {
  /** `upsert: false` implicite cote implementation : un second depot sur le meme chemin echoue explicitement. */
  upload(params: UploadOrderExportFileParams): Promise<Readonly<{ storagePath: string }>>;
}
