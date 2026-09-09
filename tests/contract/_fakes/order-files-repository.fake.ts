/**
 * Faux repository Fichiers de commande (E10.17a), utilise par
 * `order-files.contract.test.ts`.
 *
 * Reimplemente FIDELEMENT les regles tenues EN BASE par la migration
 * `20260909060000` : la commande porteuse doit appartenir au tenant du jeton
 * (`order.not_found`), la ligne citee doit appartenir a CETTE commande
 * (`order_file.line_not_found`), plafond de 30 fichiers VIVANTS par commande
 * (`order_file.limit_reached`), un `file_id` deja confirme ne l est jamais
 * deux fois (`order_file.already_confirmed`), suppression = octets detruits
 * mais ligne CONSERVEE (jamais rendue par `listByOrder`/`findById`).
 *
 * N EXERCE AUCUN STOCKAGE REEL : la metadonnee qu `info(path)` relirait est
 * STAGEE explicitement par le test (`stageUploadForTest`), exactement comme
 * si le depot avait reussi au chemin attendu.
 */
import type { TenantId, UserId } from '@/kernel';
import {
  OrderFileAlreadyConfirmedError,
  OrderFileLimitReachedError,
  OrderFileLineNotFoundError,
  OrderFileNotFoundError,
  OrderFileRejectedError,
  OrderFileUploadMissingError,
  OrderNotFoundError,
  type ListOrderFilesResult,
  type OrderFilesRepository,
} from '@/modules/order-files/application/order-files-repository';
import type {
  ConfirmOrderFileUploadCommand,
  OrderFileDetailDto,
  OrderFileDto,
  OrderFileUploadTicketDto,
  UpdateOrderFileCommand,
} from '@/modules/order-files/api/contracts';

const ACCEPTED_CONTENT_TYPES: readonly string[] = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/tiff',
  'application/zip',
  'application/x-zip-compressed',
];
const MAX_UPLOAD_BYTE_SIZE = 50 * 1024 * 1024;
const FILE_LIMIT = 30;

let sequence = 0;
export function fakeOrderFileUuid(): string {
  sequence += 1;
  return `10000000-0000-4000-9300-${String(sequence).padStart(12, '0')}`;
}

type StoredOrder = {
  id: string;
  tenantId: string;
  lineIds: string[];
};

type StoredFile = {
  id: string;
  order_id: string;
  order_line_id: string | null;
  filename: string;
  content_type: string;
  byte_size: number;
  visibility: 'internal' | 'customer';
  deposited_by: string | null;
  deposited_by_label: string | null;
  deposited_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type StagedUpload = { contentType: string; byteSize: number };

export class InMemoryOrderFilesRepository implements OrderFilesRepository {
  private readonly orders = new Map<string, StoredOrder>();
  private readonly files = new Map<string, StoredFile>();
  private readonly stagedUploads = new Map<string, StagedUpload>();

  /** TEST UNIQUEMENT — declare une commande et ses lignes valides. */
  seedOrderForTest(order: Readonly<{ id: string; tenantId: string; lineIds?: readonly string[] }>): void {
    this.orders.set(order.id, { id: order.id, tenantId: order.tenantId, lineIds: [...(order.lineIds ?? [])] });
  }

  /** TEST UNIQUEMENT — simule un depot reussi (comme si `info(path)` avait relu le fichier). */
  stageUploadForTest(fileId: string, upload: StagedUpload): void {
    this.stagedUploads.set(fileId, upload);
  }

  /** TEST UNIQUEMENT — seed direct d une ligne de fichier, sans passer par `confirmUpload`. */
  seedFileForTest(overrides: Partial<StoredFile> & { id: string; order_id: string }): void {
    const now = new Date().toISOString();
    const file: StoredFile = {
      order_line_id: null,
      filename: 'fichier-test.pdf',
      content_type: 'application/pdf',
      byte_size: 1024,
      visibility: 'internal',
      deposited_by: null,
      deposited_by_label: 'Test Auteur',
      deposited_at: now,
      updated_at: now,
      deleted_at: null,
      ...overrides,
    };
    this.files.set(file.id, file);
  }

  async listByOrder(tenantId: TenantId, orderId: string): Promise<ListOrderFilesResult | null> {
    const order = this.orders.get(orderId);
    if (!order || order.tenantId !== tenantId) return null;

    return [...this.files.values()]
      .filter((row) => row.order_id === orderId && row.deleted_at === null)
      .sort((a, b) => (a.deposited_at < b.deposited_at ? 1 : -1))
      .map(toFileDto);
  }

  async findById(tenantId: TenantId, orderId: string, fileId: string): Promise<OrderFileDetailDto | null> {
    const order = this.orders.get(orderId);
    if (!order || order.tenantId !== tenantId) return null;

    const row = this.files.get(fileId);
    if (!row || row.order_id !== orderId || row.deleted_at !== null) return null;

    return {
      ...toFileDto(row),
      download_url: `https://storage.test/commercial_order_files/${orderId}/${fileId}?download=${encodeURIComponent(row.filename)}`,
      download_url_expires_at: new Date(Date.now() + 300_000).toISOString(),
    };
  }

  /** qa-review N6 : meme resolution que `findById`, SANS URL signee. */
  async findRawById(tenantId: TenantId, orderId: string, fileId: string): Promise<OrderFileDto | null> {
    const order = this.orders.get(orderId);
    if (!order || order.tenantId !== tenantId) return null;

    const row = this.files.get(fileId);
    if (!row || row.order_id !== orderId || row.deleted_at !== null) return null;

    return toFileDto(row);
  }

  async issueUploadUrl(tenantId: TenantId, orderId: string): Promise<OrderFileUploadTicketDto> {
    const order = this.orders.get(orderId);
    if (!order || order.tenantId !== tenantId) throw new OrderNotFoundError();

    const aliveCount = [...this.files.values()].filter(
      (row) => row.order_id === orderId && row.deleted_at === null,
    ).length;
    if (aliveCount >= FILE_LIMIT) throw new OrderFileLimitReachedError();

    const fileId = fakeOrderFileUuid();
    return {
      file_id: fileId,
      url: `https://storage.test/commercial_order_files/upload/${orderId}/${fileId}`,
      token: `fake-upload-token-${fileId}`,
      path: `fake-tenant/${orderId}/${fileId}`,
      max_byte_size: MAX_UPLOAD_BYTE_SIZE,
      accepted_content_types: [...ACCEPTED_CONTENT_TYPES],
      expires_at: new Date(Date.now() + 7200_000).toISOString(),
    };
  }

  async confirmUpload(
    tenantId: TenantId,
    orderId: string,
    actor: UserId,
    command: ConfirmOrderFileUploadCommand,
  ): Promise<OrderFileDto> {
    const order = this.orders.get(orderId);
    if (!order || order.tenantId !== tenantId) throw new OrderNotFoundError();

    if (this.files.has(command.file_id)) {
      throw new OrderFileAlreadyConfirmedError();
    }

    const staged = this.stagedUploads.get(command.file_id);
    if (!staged) throw new OrderFileUploadMissingError();

    if (
      staged.byteSize < 1 ||
      staged.byteSize > MAX_UPLOAD_BYTE_SIZE ||
      !ACCEPTED_CONTENT_TYPES.includes(staged.contentType)
    ) {
      this.stagedUploads.delete(command.file_id);
      throw new OrderFileRejectedError('Objet depose refuse (taille ou type hors bornes).');
    }

    // Plafond verifie ICI, sous ce qui simule le verrou de la fonction SQL
    // (comptage des fichiers VIVANTS uniquement).
    const aliveCount = [...this.files.values()].filter(
      (row) => row.order_id === orderId && row.deleted_at === null,
    ).length;
    if (aliveCount >= FILE_LIMIT) throw new OrderFileLimitReachedError();

    if (command.order_line_id !== null && command.order_line_id !== undefined) {
      if (!order.lineIds.includes(command.order_line_id)) {
        throw new OrderFileLineNotFoundError();
      }
    }

    this.stagedUploads.delete(command.file_id);

    const now = new Date().toISOString();
    const row: StoredFile = {
      id: command.file_id,
      order_id: orderId,
      order_line_id: command.order_line_id ?? null,
      filename: command.filename,
      content_type: staged.contentType,
      byte_size: staged.byteSize,
      visibility: command.visibility ?? 'internal',
      deposited_by: actor,
      deposited_by_label: 'Test Auteur',
      deposited_at: now,
      updated_at: now,
      deleted_at: null,
    };
    this.files.set(row.id, row);
    return toFileDto(row);
  }

  async updateVisibility(
    tenantId: TenantId,
    orderId: string,
    fileId: string,
    command: UpdateOrderFileCommand,
  ): Promise<OrderFileDto> {
    void tenantId;
    const row = this.files.get(fileId);
    if (!row || row.order_id !== orderId || row.deleted_at !== null) throw new OrderFileNotFoundError();

    const updated: StoredFile = { ...row, visibility: command.visibility, updated_at: new Date().toISOString() };
    this.files.set(fileId, updated);
    return toFileDto(updated);
  }

  async remove(tenantId: TenantId, orderId: string, fileId: string, actor: UserId): Promise<void> {
    void tenantId;
    void actor;
    const row = this.files.get(fileId);
    if (!row || row.order_id !== orderId || row.deleted_at !== null) throw new OrderFileNotFoundError();

    this.files.set(fileId, { ...row, deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  }
}

function toFileDto(row: StoredFile): OrderFileDto {
  return {
    id: row.id,
    order_id: row.order_id,
    order_line_id: row.order_line_id,
    filename: row.filename,
    content_type: row.content_type,
    byte_size: row.byte_size,
    visibility: row.visibility,
    deposited_at: row.deposited_at,
    deposited_by: row.deposited_by,
    deposited_by_label: row.deposited_by_label,
    updated_at: row.updated_at,
  };
}
