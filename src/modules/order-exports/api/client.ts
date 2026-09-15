/**
 * Client HTTP du module Exports de commandes (story E10.18e-2).
 *
 * PREMIERE ENTREE PUBLIQUE DE CE MODULE CONSOMMEE PAR UNE UI : jusqu ici
 * seul le generateur cote serveur (E10.18c/d) lisait `OrderExportsService`
 * directement. `src/modules/commercial-orders/ui/` n a le droit d importer
 * ce module que par sa racine (`@/modules/order-exports`,
 * `tests/architecture/modular-ui-boundaries.test.ts`), jamais par un chemin
 * profond `api/client` — voir `../index.ts`.
 *
 * `Idempotency-Key` N EST PAS GENEREE ICI, a la difference des autres
 * clients E10 (ex. `CommercialOrdersApiClient.convertQuote`, qui appelle
 * `crypto.randomUUID()` en interne). La consigne (docs/api/CONVENTIONS.md
 * §8.24, E10.18e-2 point 4) exige un cycle de vie PILOTE PAR L ECRAN : cree
 * a l ouverture de la modale, REUTILISE si l envoi est rejoue apres une
 * coupure, RENOUVELE apres succes — un cycle qu un `crypto.randomUUID()`
 * interne au client masquerait entierement. `request()` prend donc la cle
 * en PARAMETRE OBLIGATOIRE (voir `order-export.helpers.ts`,
 * `createOrderExportSubmitController`).
 */
import { successEnvelopeSchema } from '../../_shared/api/index.ts';
import { API_V1_BASE_PATH, FetchApiClient } from '../../../platform/api/index.ts';
import {
  orderExportSchema,
  orderExportsListSchema,
  requestOrderExportCommandSchema,
  type OrderExportDto,
  type OrderExportFormat,
  type OrderExportGranularity,
  type OrderExportStatus,
  type RequestOrderExportCommand,
} from './contracts.ts';

const ORDER_EXPORTS_BASE_PATH = `${API_V1_BASE_PATH}/commercial-order-exports`;

export type ListCommercialOrderExportsQuery = Readonly<{
  status?: OrderExportStatus;
  format?: OrderExportFormat;
  granularity?: OrderExportGranularity;
  pageSize?: number;
  pageCursor?: string;
}>;

export type ListCommercialOrderExportsResponse = Readonly<{
  items: readonly OrderExportDto[];
  nextCursor: string | null;
}>;

export class OrderExportsApiClient {
  constructor(private readonly client: FetchApiClient) {}

  /**
   * REGISTRE TENANT-LARGE (contrat) : rend les demandes de TOUS les membres
   * de l espace, `download_url` reserve au demandeur. Aucune validation de
   * calendrier ici — ce n est pas un filtre de periode.
   */
  async list(query: ListCommercialOrderExportsQuery = {}): Promise<ListCommercialOrderExportsResponse> {
    const params = new URLSearchParams();
    if (query.status) params.set('status', query.status);
    if (query.format) params.set('format', query.format);
    if (query.granularity) params.set('granularity', query.granularity);
    if (query.pageSize) params.set('page[size]', String(query.pageSize));
    if (query.pageCursor) params.set('page[cursor]', query.pageCursor);
    const suffix = params.toString();

    const envelope = await this.client.request({
      path: suffix ? `${ORDER_EXPORTS_BASE_PATH}?${suffix}` : ORDER_EXPORTS_BASE_PATH,
      responseSchema: successEnvelopeSchema(orderExportsListSchema),
    });
    return { items: envelope.data, nextCursor: envelope.meta.next_cursor ?? null };
  }

  /**
   * `idempotencyKey` OBLIGATOIRE — voir en-tete de fichier : ce client ne
   * genere jamais lui-meme cette cle, contrairement au reste du depot.
   */
  async request(command: RequestOrderExportCommand, idempotencyKey: string): Promise<OrderExportDto> {
    const envelope = await this.client.request({
      method: 'POST',
      path: ORDER_EXPORTS_BASE_PATH,
      body: requestOrderExportCommandSchema.parse(command),
      headers: { 'Idempotency-Key': idempotencyKey },
      responseSchema: successEnvelopeSchema(orderExportSchema),
    });
    return envelope.data;
  }

  /**
   * ETAT D UNE DEMANDE — c est aussi l operation de REEMISSION de l URL de
   * telechargement (contrat : « REEMISE A CHAQUE APPEL »). Appelee en boucle
   * par le suivi (`startOrderExportPolling`) et au clic sur le lien
   * (`refreshOrderExportDownloadUrl`).
   */
  async get(exportId: string): Promise<OrderExportDto> {
    const envelope = await this.client.request({
      path: `${ORDER_EXPORTS_BASE_PATH}/${exportId}`,
      responseSchema: successEnvelopeSchema(orderExportSchema),
    });
    return envelope.data;
  }
}
