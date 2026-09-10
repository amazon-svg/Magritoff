/**
 * Faux repository Liens de depot publics (E10.20a), utilise par
 * `order-upload-links.contract.test.ts`.
 *
 * Reimplemente FIDELEMENT les regles tenues EN BASE par la migration
 * `20260910000300` : la commande porteuse doit appartenir au tenant du jeton
 * (`order.not_found`), plafond de 10 liens VIVANTS par commande
 * (`upload_link.limit_reached`), un lien revoque est INDISCERNABLE d un
 * lien inconnu (`upload_link.not_found`), le jeton n est JAMAIS stocke en
 * clair (seul un index par jeton en clair -> id est tenu ICI, cote test,
 * pour simuler le hachage sans en reproduire l algorithme).
 */
import type { TenantId, UserId } from '@/kernel';
import {
  OrderNotFoundError,
  OrderUploadLinkLimitReachedError,
  OrderUploadLinkNotFoundError,
  type ListOrderUploadLinksResult,
  type OrderUploadLinksRepository,
} from '@/modules/order-upload-links/application/order-upload-links-repository';
import type {
  CreateOrderUploadLinkCommand,
  OrderUploadLinkContextDto,
  OrderUploadLinkCreatedDto,
  OrderUploadLinkDto,
} from '@/modules/order-upload-links/api/contracts';

const LINK_LIMIT = 10;
const MAX_BYTE_SIZE = 50 * 1024 * 1024;
const ACCEPTED_CONTENT_TYPES: readonly string[] = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/tiff',
  'application/zip',
  'application/x-zip-compressed',
];

let sequence = 0;
export function fakeOrderUploadLinkUuid(): string {
  sequence += 1;
  return `40000000-0000-4000-9300-${String(sequence).padStart(12, '0')}`;
}

type StoredOrder = { id: string; tenantId: string; number: string; tenantName: string };

type StoredLink = {
  id: string;
  order_id: string;
  token: string;
  label: string | null;
  expires_at: string;
  max_files: number;
  deposited_count: number;
  use_count: number;
  first_used_at: string | null;
  last_used_at: string | null;
  created_at: string;
  created_by: string | null;
  created_by_label: string | null;
  revoked_at: string | null;
};

export class InMemoryOrderUploadLinksRepository implements OrderUploadLinksRepository {
  private readonly orders = new Map<string, StoredOrder>();
  private readonly links = new Map<string, StoredLink>();
  private readonly linksByToken = new Map<string, string>();

  /** TEST UNIQUEMENT — declare une commande. */
  seedOrderForTest(order: Readonly<{ id: string; tenantId: string; number?: string; tenantName?: string }>): void {
    this.orders.set(order.id, {
      id: order.id,
      tenantId: order.tenantId,
      number: order.number ?? 'CDE-2026-00001',
      tenantName: order.tenantName ?? 'Imprimerie Test',
    });
  }

  private isAlive(link: StoredLink, now: number): boolean {
    return link.revoked_at === null && new Date(link.expires_at).getTime() > now;
  }

  async create(
    tenantId: TenantId,
    orderId: string,
    actor: UserId,
    command: CreateOrderUploadLinkCommand,
  ): Promise<OrderUploadLinkCreatedDto> {
    const order = this.orders.get(orderId);
    if (!order || order.tenantId !== tenantId) throw new OrderNotFoundError();

    const now = Date.now();
    const aliveCount = [...this.links.values()].filter(
      (row) => row.order_id === orderId && this.isAlive(row, now),
    ).length;
    if (aliveCount >= LINK_LIMIT) throw new OrderUploadLinkLimitReachedError();

    const id = fakeOrderUploadLinkUuid();
    const token = `fake-upload-link-token-${id}`;
    const nowIso = new Date(now).toISOString();
    const row: StoredLink = {
      id,
      order_id: orderId,
      token,
      label: command.label ?? null,
      expires_at: new Date(now + command.expires_in_days * 86_400_000).toISOString(),
      max_files: command.max_files,
      deposited_count: 0,
      use_count: 0,
      first_used_at: null,
      last_used_at: null,
      created_at: nowIso,
      created_by: actor,
      created_by_label: 'Test Auteur',
      revoked_at: null,
    };
    this.links.set(id, row);
    this.linksByToken.set(token, id);
    return { ...toLinkDto(row), token };
  }

  async listByOrder(tenantId: TenantId, orderId: string): Promise<ListOrderUploadLinksResult | null> {
    const order = this.orders.get(orderId);
    if (!order || order.tenantId !== tenantId) return null;

    const now = Date.now();
    return [...this.links.values()]
      .filter((row) => row.order_id === orderId && this.isAlive(row, now))
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .map(toLinkDto);
  }

  async revoke(tenantId: TenantId, orderId: string, linkId: string, actor: UserId): Promise<void> {
    void tenantId;
    void actor;
    const row = this.links.get(linkId);
    const now = Date.now();
    if (!row || row.order_id !== orderId || !this.isAlive(row, now)) {
      throw new OrderUploadLinkNotFoundError();
    }
    this.links.set(linkId, { ...row, revoked_at: new Date(now).toISOString() });
  }

  /**
   * TEST UNIQUEMENT — simule `api_resolve_order_upload_link_principal`
   * (STABLE, SANS effet de bord), consomme par le `PrincipalVerifier` de
   * test pour construire un `UploadLinkPrincipal` — jamais par le
   * repository lui-meme en production (deux fonctions SQL distinctes,
   * §"story E10.20" du contrat).
   */
  resolvePrincipalForTest(
    token: string,
  ): Readonly<{ linkId: string; orderId: string; tenantId: string }> | null {
    const linkId = this.linksByToken.get(token);
    if (!linkId) return null;
    const row = this.links.get(linkId);
    if (!row || !this.isAlive(row, Date.now())) return null;
    const order = this.orders.get(row.order_id);
    if (!order) return null;
    return { linkId: row.id, orderId: row.order_id, tenantId: order.tenantId };
  }

  async getContext(token: string): Promise<OrderUploadLinkContextDto | null> {
    const linkId = this.linksByToken.get(token);
    if (!linkId) return null;
    const row = this.links.get(linkId);
    if (!row) return null;
    const now = Date.now();
    if (!this.isAlive(row, now)) return null;

    const order = this.orders.get(row.order_id);
    if (!order) return null;

    const nowIso = new Date(now).toISOString();
    this.links.set(linkId, {
      ...row,
      use_count: row.use_count + 1,
      first_used_at: row.first_used_at ?? nowIso,
      last_used_at: nowIso,
    });

    return {
      printer_name: order.tenantName,
      order_number: order.number,
      label: row.label,
      expires_at: row.expires_at,
      max_files: row.max_files,
      deposited_count: row.deposited_count,
      max_byte_size: MAX_BYTE_SIZE,
      accepted_content_types: [...ACCEPTED_CONTENT_TYPES],
    };
  }
}

function toLinkDto(row: StoredLink): OrderUploadLinkDto {
  return {
    id: row.id,
    order_id: row.order_id,
    label: row.label,
    expires_at: row.expires_at,
    max_files: row.max_files,
    deposited_count: row.deposited_count,
    use_count: row.use_count,
    first_used_at: row.first_used_at,
    last_used_at: row.last_used_at,
    created_at: row.created_at,
    created_by: row.created_by,
    created_by_label: row.created_by_label,
  };
}
