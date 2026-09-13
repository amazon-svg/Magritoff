/**
 * Drain de GENERATION reelle des exports (story E10.18c, contrat §8.24
 * §3(b)) : reclame un lot borne, lit chaque export par PAGES via
 * `api_read_order_export_rows`, rend le fichier et le depose, ou echoue
 * proprement.
 *
 * Invoque par l Edge Function `magrit-order-export-runner`, SON PROPRE
 * `pg_cron` a la minute (§8.24 §3(b), "strictement le patron de
 * magrit-notification-sender").
 *
 * ── Plafond de lignes (`ORDER_EXPORT_ROW_LIMIT`), VERIFIE AVANT tout appel
 * ── au renderer ─────────────────────────────────────────────────────────
 * Valeur et motif complet : contrat §8.24 point 4 (douzieme entree du
 * bandeau, mesure du 2026-09-13 dans l Edge Runtime reel — c est le CPU qui
 * tue l export, PAS la memoire, contrairement a ce qu affirmait a tort une
 * version anterieure de ce commentaire). « Constate a l execution, le seul
 * endroit ou le compte est connu ». Un depassement CPU (mise a mort par le
 * superviseur) tue le PROCESSUS entier (aucun `try/catch` ne le rattrape,
 * `markFailed` n est jamais appele) — ce plafond est donc le SEUL filet
 * PREVENTIF, et il agit AVANT que le renderer ne recoive une seule ligne,
 * jamais apres. Le FILET DE REPRISE (migration `20260913010000`,
 * `api_claim_order_exports`) traite le cas ou ce plafond serait quand meme
 * franchi par une charge imprevue.
 */
import type { OrderExportRawRow } from './order-export-columns.ts';
import type { OrderExportRenderer } from './order-export-renderer.ts';
import {
  DEFAULT_ORDER_EXPORT_RUN_SETTINGS,
  type ClaimedOrderExport,
  type OrderExportRunRepository,
  type OrderExportRunSettings,
} from './order-export-run-repository.ts';
import type { OrderExportStorage } from './order-export-storage.ts';

/**
 * Plafond DUR, IDENTIQUE quel que soit le format (contrat point 4 : "un seul
 * nombre a connaitre, un seul message a ecrire"). **`5_000`, pas `50_000`**
 * — valeur CORRIGEE le 2026-09-13 (douzieme entree du bandeau §8.24) sur une
 * mesure du CHEMIN REEL (Edge Function servie en *user worker*, limites
 * exactes de la CLI Supabase : 256 Mo, CPU 1000/2000 ms), apres qu une
 * premiere mesure (50 000, prise hors de la limite CPU du superviseur) s est
 * revelee fausse : a 50 000 lignes, meme la bibliotheque XLSX SEULE est tuee
 * par le CPU. **Valable SOUS TROIS CONDITIONS, sans lesquelles 5 000 est
 * fausse aussi** (contrat point 4) : (1) le formateur de date civile est mis
 * en cache (`src/kernel/clock/timezone.ts`, `CIVIL_DATE_FORMATTER`) — SANS
 * lui, le plafond serait 2 000 ; (2) un seul export par invocation
 * (`DEFAULT_ORDER_EXPORT_RUN_SETTINGS.limit`, `order-export-run-repository.ts`)
 * — le budget CPU se cumule sur le LOT que `runOnce()` traite ; (3) un filet
 * de reprise des exports tues (migration `20260913010000`). Cette valeur
 * n est validee que localement (Apple Silicon, arm64) : l activation du
 * runner en production reste subordonnee a une mesure sur le projet
 * heberge (contrat point 4, "validation sur la plateforme").
 */
export const ORDER_EXPORT_ROW_LIMIT = 5_000;

/** 7 jours, NON CONFIGURABLE PAR ESPACE (contrat point 3(e)). */
const RETENTION_DAYS = 7;

/** Taille de page de lecture — bien en-deca du plafond, pour ecrire au fil de l eau plutot que de charger tout en un seul aller-retour. */
const READ_PAGE_SIZE = 1000;

export type OrderExportGenerationReport = Readonly<{
  claimed: number;
  ready: number;
  failed: number;
}>;

export type OrderExportGenerationServiceDependencies = Readonly<{
  repository: OrderExportRunRepository;
  storage: OrderExportStorage;
  /** Un renderer par format ARME. Un format demande SANS renderer enregistre (aucun aujourd hui, `csv` et `xlsx` sont tous deux livres depuis E10.18d) echoue proprement (`order_export.format_not_implemented`), jamais en boucle. */
  renderers: Partial<Record<'csv' | 'xlsx', OrderExportRenderer>>;
  settings?: OrderExportRunSettings;
  now?: () => Date;
  sha256?: (bytes: Uint8Array) => Promise<string>;
  onUnhandledError?: (error: unknown, exportId: string) => void;
}>;

export class OrderExportGenerationService {
  private readonly settings: OrderExportRunSettings;
  private readonly now: () => Date;
  private readonly sha256: (bytes: Uint8Array) => Promise<string>;

  constructor(private readonly dependencies: OrderExportGenerationServiceDependencies) {
    this.settings = dependencies.settings ?? DEFAULT_ORDER_EXPORT_RUN_SETTINGS;
    this.now = dependencies.now ?? (() => new Date());
    this.sha256 = dependencies.sha256 ?? defaultSha256;
  }

  async runOnce(): Promise<OrderExportGenerationReport> {
    const claimed = await this.dependencies.repository.claim(this.settings);
    let ready = 0;
    let failed = 0;

    for (const item of claimed) {
      try {
        const outcome = await this.processOne(item);
        if (outcome) ready += 1;
        else failed += 1;
      } catch (error) {
        // Defense en profondeur (meme discipline que OutboxDispatcher/
        // NotificationSender) : un echec non prevu ne doit jamais faire
        // sauter le tour entier, ni laisser la ligne en `running` a jamais.
        this.dependencies.onUnhandledError?.(error, item.id);
        await this.dependencies.repository.markFailed(
          item.id,
          'order_export.generation_failed',
          error instanceof Error ? error.message : 'Erreur inattendue du drain de generation.',
          this.now().toISOString(),
        );
        failed += 1;
      }
    }

    return Object.freeze({ claimed: claimed.length, ready, failed });
  }

  /** `true` = depose `ready`, `false` = marque `failed` (verdict deja ecrit dans les deux cas). */
  private async processOne(item: ClaimedOrderExport): Promise<boolean> {
    const renderer = this.dependencies.renderers[item.format];
    if (!renderer) {
      await this.dependencies.repository.markFailed(
        item.id,
        'order_export.generation_failed',
        `order_export.format_not_implemented: aucun renderer pour le format ${item.format}`,
        this.now().toISOString(),
      );
      return false;
    }

    const rows: OrderExportRawRow[] = [];
    let after: unknown | null = null;
    for (;;) {
      const page = await this.dependencies.repository.readRows(item.id, after, READ_PAGE_SIZE);
      rows.push(...page.rows);
      // Plafond verifie A CHAQUE PAGE, AVANT d en lire une de plus — jamais
      // apres avoir tout charge (contrat : "constate a l execution", et le
      // seul filet contre un depassement memoire qu aucun try/catch ne
      // rattrape).
      if (rows.length > ORDER_EXPORT_ROW_LIMIT) {
        await this.dependencies.repository.markFailed(
          item.id,
          'order_export.row_limit_exceeded',
          `order_export.row_limit_exceeded: plus de ${ORDER_EXPORT_ROW_LIMIT} lignes — resserrez la periode.`,
          this.now().toISOString(),
        );
        return false;
      }
      if (page.rows.length < READ_PAGE_SIZE || page.nextAfter === null) break;
      after = page.nextAfter;
    }

    const rendered = await renderer.render({ granularity: item.granularity, rows });
    if (!rendered.ok) {
      await this.dependencies.repository.markFailed(item.id, rendered.code, rendered.detail, this.now().toISOString());
      return false;
    }

    const sha256 = await this.sha256(rendered.bytes);
    const completedAt = this.now();
    const fileName = buildOrderExportFileName(item, renderer.fileExtension, completedAt);

    let storagePath: string;
    try {
      const uploaded = await this.dependencies.storage.upload({
        tenantId: item.tenantId,
        exportId: item.id,
        extension: renderer.fileExtension as 'csv' | 'xlsx',
        bytes: rendered.bytes,
        contentType: renderer.contentType,
      });
      storagePath = uploaded.storagePath;
    } catch (error) {
      await this.dependencies.repository.markFailed(
        item.id,
        'order_export.storage_failed',
        error instanceof Error ? error.message : 'Depot du fichier impossible.',
        completedAt.toISOString(),
      );
      return false;
    }

    const expiresAt = new Date(completedAt.getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000);
    await this.dependencies.repository.markReady(item.id, {
      rowCount: rows.length,
      storagePath,
      fileName,
      byteSize: rendered.bytes.byteLength,
      sha256,
      contentType: renderer.contentType,
      completedAt: completedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    });
    return true;
  }
}

/** `commandes-<granularite>-<debut>_<fin>-<horodatage>.<extension>` (contrat, `OrderExport.file_name`) — bornes absentes rendues par `tout`. */
export function buildOrderExportFileName(
  item: Pick<ClaimedOrderExport, 'granularity' | 'filters'>,
  extension: string,
  completedAt: Date,
): string {
  const from = item.filters.created_from ?? 'tout';
  const to = item.filters.created_to ?? 'tout';
  const stamp = completedAt.toISOString().replace(/[:.]/g, '-');
  return `commandes-${item.granularity}-${from}_${to}-${stamp}.${extension}`;
}

async function defaultSha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as unknown as BufferSource);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
