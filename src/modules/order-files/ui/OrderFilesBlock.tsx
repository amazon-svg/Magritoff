/**
 * OrderFilesBlock — panneau de depot et gestion des fichiers d une commande
 * (E10.17b, second lot de la decomposition d E10.17 — le premier, E10.17a,
 * n avait AUCUN effet observable : c est CE lot qui rend le travail visible
 * a l imprimeur).
 *
 * Wireframe VALIDE par Arnaud le 09/09/2026 :
 * `.design-handoff/wireframes/E10.17b-panneau-fichiers-commande.md`. DEUX
 * arbitrages tranches (§6) et repris a la lettre :
 *  (Q1) troisieme section de `OrderDetailPage.tsx`, apres les lignes de
 *       commande, MEME gabarit visuel que les sections existantes
 *       (`border border-line rounded-xl p-4 space-y-3`) ;
 *  (Q2) AUCUN bandeau d alerte proactif au plafond de 30 fichiers — le
 *       compteur "{n}/30" suffit.
 *
 * Aucun appel Supabase direct : tout passe par `OrderFilesApiClient`
 * (`../api/client.ts`, deja ecrit par E10.17a — `fetch`/`XMLHttpRequest` NUS
 * sur l URL signee, jamais le SDK Supabase, `modular-ui-boundaries.test.ts`).
 * Aucun controle metier POSE ICI n est la seule verite : la validation
 * client (`../ui/order-files.helpers.ts`) est un CONFORT UX immediat, le
 * serveur (E10.17a) reste la seule barriere reelle sur le poids, le format et
 * le plafond de fichiers (`.claude/rules/frontend.md`).
 *
 * Detection de l objet de stockage disparu (wireframe §4.4) — CORRIGE au
 * round 1 de qa-review (B1, bloquant) : `listOrderFiles` NE SIGNE AUCUNE URL
 * (collection bornee et bon marche, contrat §8.19 §1), donc il est
 * structurellement impossible de savoir des l affichage de la liste qu un
 * objet a disparu. La detection reste PARESSEUSE (au clic Telecharger,
 * `getOrderFile`, qui SIGNE l URL) mais elle est desormais purement
 * INFORMATIVE : l icone d alerte et le message affiches suite a un echec de
 * telechargement NE PROUVENT PAS que l objet a disparu — une coupure
 * reseau, un jeton expire ou un 500 transitoire produisent exactement le
 * meme signal cote client, et il n existe aujourd hui aucun code d erreur
 * serveur qui distingue les deux cas (a signaler a l architecte si une
 * distinction fiable est un jour necessaire, ex. `order_file.object_missing`
 * dedie). En consequence : le bouton de telechargement N EST JAMAIS
 * definitivement desactive (un nouvel essai reste toujours possible, et peut
 * reussir si l echec etait transitoire), et `missingObjectIds` est PURGE a
 * chaque rechargement de la liste (`loadFiles()`), qu il soit automatique
 * (apres un depot/une suppression) ou manuel ("Réessayer" du bandeau
 * d erreur) — un fichier sain ne reste donc jamais bloque au dela d un
 * rafraichissement normal du panneau, sans avoir a recharger toute la page.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Archive, AlertTriangle, Download, Eye, FileIcon, FileText, Image as ImageIcon, Link2, Loader2, Trash2, UploadCloud, X } from 'lucide-react';
import { TEST_IDS } from '@/shared/presentation/testIds';
import { useWorkspaceApi, useWorkspaceUiRuntime } from '@/platform/runtime/workspace-ui-runtime';
import { Progress } from '@/shared/ui/progress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import { OrderFilesApiClient } from '../api/client';
import { resolveOrderFileContentType, supportedOrderFileExtensions } from '../api/content-type-map';
import type { OrderFileDto, OrderFileUploadTicketDto, OrderFileVisibility } from '../api/contracts';
import {
  describeOrderFileUploadFailure,
  formatOrderFileDepositedByLine,
  formatOrderFileSize,
  ORDER_FILES_COPY,
  resolveOrderFileIconFamily,
  validateOrderFileForUpload,
  type OrderFileIconFamily,
} from './order-files.helpers';

const btnGhost =
  'px-2.5 py-1 border border-line-2 rounded-lg text-xs text-ink-2 hover:bg-bg hover:text-ink disabled:opacity-50 inline-flex items-center';

type PendingUploadStatus = 'uploading' | 'confirming' | 'error';
type PendingUploadFailedStage = 'ticket' | 'transport' | 'confirm';

interface PendingUpload {
  localId: string;
  file: File;
  status: PendingUploadStatus;
  progress: number;
  error?: string | undefined;
  /** `false` seulement pour un echec qui ne peut jamais aboutir en rejouant a l identique (qa-review B2 — ex. plafond atteint). */
  retryable?: boolean | undefined;
  /** Etape ayant echoue — determine si "Réessayer" reprend tout le cycle ou seulement la confirmation (qa-review N2). */
  failedStage?: PendingUploadFailedStage | undefined;
  /** Conserves pour rejouer UNIQUEMENT la confirmation avec le MEME billet et la MEME cle d idempotence (qa-review N2). */
  ticket?: OrderFileUploadTicketDto | undefined;
  idempotencyKey?: string | undefined;
}

export interface OrderFilesBlockProps {
  orderId: string;
}

export function OrderFilesBlock({ orderId }: OrderFilesBlockProps) {
  const api = useWorkspaceApi(OrderFilesApiClient);
  const { actor } = useWorkspaceUiRuntime();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [files, setFiles] = useState<readonly OrderFileDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [pendingUploads, setPendingUploads] = useState<readonly PendingUpload[]>([]);
  const [dropzoneError, setDropzoneError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [visibilityBusyId, setVisibilityBusyId] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Readonly<Record<string, string>>>({});
  const [missingObjectIds, setMissingObjectIds] = useState<ReadonlySet<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<OrderFileDto | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    setListError(null);
    // qa-review B1 (round 1) : purge a CHAQUE rechargement — un fichier
    // marque "introuvable" apres un aléa réseau ne doit jamais rester bloqué
    // au-delà de l'actualisation normale du panneau.
    setMissingObjectIds(new Set());
    try {
      const data = await api.list(orderId);
      setFiles(data);
    } catch {
      setListError(ORDER_FILES_COPY.errorListFailed);
    } finally {
      setLoading(false);
    }
  }, [api, orderId]);

  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  const updatePending = useCallback((localId: string, patch: Partial<PendingUpload>) => {
    setPendingUploads((current) =>
      current.map((upload) => (upload.localId === localId ? { ...upload, ...patch } : upload)),
    );
  }, []);

  const runUpload = useCallback(
    async (
      localId: string,
      file: File,
      options?: {
        resumeFromConfirm?: boolean | undefined;
        ticket?: OrderFileUploadTicketDto | undefined;
        idempotencyKey?: string | undefined;
      },
    ) => {
      let ticket = options?.resumeFromConfirm ? options.ticket : undefined;
      let idempotencyKey = options?.resumeFromConfirm ? options.idempotencyKey : undefined;

      if (!ticket || !idempotencyKey) {
        updatePending(localId, {
          status: 'uploading',
          progress: 0,
          error: undefined,
          retryable: undefined,
          failedStage: undefined,
        });

        try {
          ticket = await api.issueUploadUrl(orderId);
        } catch (cause) {
          const failure = describeOrderFileUploadFailure(cause, ORDER_FILES_COPY.errorUploadNetwork);
          updatePending(localId, {
            status: 'error',
            error: failure.message,
            retryable: failure.retryable,
            failedStage: 'ticket',
          });
          return;
        }

        idempotencyKey = crypto.randomUUID();
        updatePending(localId, { ticket, idempotencyKey });

        try {
          await api.uploadOrderFile(ticket, file.name, file, (loaded, total) => {
            updatePending(localId, { progress: total > 0 ? Math.round((loaded / total) * 100) : 0 });
          });
        } catch {
          // Transport brut (XHR vers l URL signee) : jamais un ApiClientError,
          // toujours un message reseau generique — toujours rejouable.
          updatePending(localId, {
            status: 'error',
            error: ORDER_FILES_COPY.errorUploadNetwork,
            retryable: true,
            failedStage: 'transport',
          });
          return;
        }
      } else {
        // qa-review N2 : reprise APRES un echec de confirmation, avec le MEME
        // billet et la MEME cle d idempotence — aucun nouveau depot d octets,
        // aucune seconde ligne possible si la confirmation avait en realite
        // deja reussi cote serveur.
        updatePending(localId, { status: 'confirming', progress: 100, error: undefined, retryable: undefined });
      }

      updatePending(localId, { status: 'confirming', progress: 100 });
      try {
        await api.confirmUpload(orderId, { file_id: ticket.file_id, filename: file.name }, idempotencyKey);
      } catch (cause) {
        const failure = describeOrderFileUploadFailure(cause, ORDER_FILES_COPY.errorConfirmFailed);
        updatePending(localId, {
          status: 'error',
          error: failure.message,
          retryable: failure.retryable,
          failedStage: 'confirm',
        });
        return;
      }

      setPendingUploads((current) => current.filter((upload) => upload.localId !== localId));
      await loadFiles();
    },
    [api, orderId, loadFiles, updatePending],
  );

  const retryUpload = useCallback(
    (upload: PendingUpload) => {
      void runUpload(upload.localId, upload.file, {
        resumeFromConfirm: upload.failedStage === 'confirm',
        ticket: upload.ticket,
        idempotencyKey: upload.idempotencyKey,
      });
    },
    [runUpload],
  );

  const dismissPendingUpload = useCallback((localId: string) => {
    setPendingUploads((current) => current.filter((upload) => upload.localId !== localId));
  }, []);

  const currentFileCount = useCallback(
    () => files.length + pendingUploads.length,
    [files.length, pendingUploads.length],
  );

  const beginUpload = useCallback(
    (file: File) => {
      const validation = validateOrderFileForUpload({ name: file.name, size: file.size }, currentFileCount());
      if (!validation.ok) {
        setDropzoneError(validation.error);
        return;
      }
      setDropzoneError(null);
      const localId = crypto.randomUUID();
      setPendingUploads((current) => [...current, { localId, file, status: 'uploading', progress: 0 }]);
      void runUpload(localId, file);
    },
    [currentFileCount, runUpload],
  );

  const handleDownload = useCallback(
    async (file: OrderFileDto) => {
      setRowErrors((current) => {
        if (!(file.id in current)) return current;
        const next = { ...current };
        delete next[file.id];
        return next;
      });
      try {
        const detail = await api.getForRead(orderId, file.id);
        window.open(detail.data.download_url, '_blank', 'noopener,noreferrer');
        setMissingObjectIds((current) => {
          if (!current.has(file.id)) return current;
          const next = new Set(current);
          next.delete(file.id);
          return next;
        });
      } catch {
        // Wireframe §4.4 : signal INFORMATIF seulement — voir l en-tete de ce
        // fichier. Jamais bloquant : aucun `disabled` n est pose ici, un
        // nouvel essai reste toujours possible.
        setMissingObjectIds((current) => new Set(current).add(file.id));
        setRowErrors((current) => ({ ...current, [file.id]: ORDER_FILES_COPY.errorDownloadFailed }));
      }
    },
    [api, orderId],
  );

  const handleVisibilityChange = useCallback(
    async (file: OrderFileDto, next: OrderFileVisibility) => {
      if (file.visibility === next) return;
      setVisibilityBusyId(file.id);
      setRowErrors((current) => {
        if (!(file.id in current)) return current;
        const clone = { ...current };
        delete clone[file.id];
        return clone;
      });
      try {
        const fresh = await api.getForRead(orderId, file.id);
        if (!fresh.etag) throw new Error('ETag du fichier indisponible.');
        const updated = await api.updateVisibility(orderId, file.id, { visibility: next }, fresh.etag);
        setFiles((current) => current.map((entry) => (entry.id === file.id ? updated.data : entry)));
      } catch {
        setRowErrors((current) => ({ ...current, [file.id]: ORDER_FILES_COPY.errorVisibilityFailed }));
      } finally {
        setVisibilityBusyId(null);
      }
    },
    [api, orderId],
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.remove(orderId, deleteTarget.id);
      setFiles((current) => current.filter((entry) => entry.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch {
      setDeleteError(ORDER_FILES_COPY.errorDeleteFailed);
    } finally {
      setDeleting(false);
    }
  }, [api, orderId, deleteTarget]);

  const acceptAttr = supportedOrderFileExtensions()
    .map((extension) => `.${extension}`)
    .join(',');

  // Wireframe §2 — Ecran A (etat vide, dropzone pleine avec icone/sous-texte)
  // vs Ecran B (liste non vide, dropzone compacte une ligne).
  const hasAnyFile = files.length > 0 || pendingUploads.length > 0;

  return (
    <section
      className="border border-line rounded-xl p-4 space-y-3"
      data-testid={TEST_IDS.orderFiles.block}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-ink-2 uppercase tracking-wider">{ORDER_FILES_COPY.title}</h2>
        {files.length > 0 && (
          <span className="text-xs text-ink-muted" data-testid={TEST_IDS.orderFiles.counter}>
            {ORDER_FILES_COPY.counter(files.length)}
          </span>
        )}
      </div>

      {listError && (
        <div className="flex items-center gap-2 text-sm text-err-fg" data-testid={TEST_IDS.orderFiles.errorBanner}>
          <span>{listError}</span>
          <button
            type="button"
            onClick={() => void loadFiles()}
            className="underline shrink-0"
            data-testid={TEST_IDS.orderFiles.retryLoadBtn}
          >
            {ORDER_FILES_COPY.retry}
          </button>
        </div>
      )}

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragActive(false);
          Array.from(event.dataTransfer.files ?? []).forEach((file) => beginUpload(file));
        }}
        className={`border-2 border-dashed rounded-lg transition-colors ${
          hasAnyFile ? 'p-2.5 text-left' : 'p-4 text-center'
        } ${dragActive ? 'border-brand bg-brand/5' : 'border-line-2'}`}
        data-testid={TEST_IDS.orderFiles.dropzone}
      >
        {hasAnyFile ? (
          <p className="text-sm text-ink">
            {ORDER_FILES_COPY.dropzoneTitle}, ou{' '}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-brand underline font-medium"
              data-testid={TEST_IDS.orderFiles.browseBtn}
            >
              {ORDER_FILES_COPY.dropzoneBrowse}
            </button>
          </p>
        ) : (
          <>
            <UploadCloud className="w-5 h-5 text-ink-muted mx-auto mb-1.5" />
            <p className="text-sm text-ink">
              {ORDER_FILES_COPY.dropzoneTitle} ou{' '}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-brand underline font-medium"
                data-testid={TEST_IDS.orderFiles.browseBtn}
              >
                {ORDER_FILES_COPY.dropzoneBrowse}
              </button>
            </p>
            <p className="text-xs text-ink-muted mt-1">{ORDER_FILES_COPY.dropzoneFormats}</p>
            <p className="text-xs text-ink-muted">{ORDER_FILES_COPY.dropzoneLimits}</p>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptAttr}
          className="hidden"
          data-testid={TEST_IDS.orderFiles.fileInput}
          onChange={(event) => {
            const selected = Array.from(event.target.files ?? []);
            event.target.value = '';
            selected.forEach((file) => beginUpload(file));
          }}
        />
      </div>

      {dropzoneError && (
        <p className="text-sm text-err-fg" role="alert">
          {dropzoneError}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-ink-muted">{ORDER_FILES_COPY.loading}</p>
      ) : (
        <div className="space-y-2">
          {files.length === 0 && pendingUploads.length === 0 && !listError && (
            <p className="text-sm text-ink-muted py-2" data-testid={TEST_IDS.orderFiles.emptyState}>
              {ORDER_FILES_COPY.emptyState}
            </p>
          )}

          {pendingUploads.map((upload) => (
            <div
              key={upload.localId}
              className="border border-line-2 rounded-lg p-3 bg-paper"
              data-testid={TEST_IDS.orderFiles.row}
              data-file-id={upload.localId}
            >
              <div className="flex items-center gap-2">
                <FileFamilyIcon family={guessPendingIconFamily(upload.file.name)} />
                <span className="text-sm text-ink truncate">{upload.file.name}</span>
              </div>
              {upload.status === 'error' ? (
                <div className="mt-2 space-y-1.5">
                  <p className="text-sm text-err-fg" data-testid={TEST_IDS.orderFiles.rowError}>
                    {upload.error}
                  </p>
                  <div className="flex items-center gap-2">
                    {upload.retryable !== false && (
                      <button
                        type="button"
                        onClick={() => retryUpload(upload)}
                        className={btnGhost}
                        data-testid={TEST_IDS.orderFiles.retryUploadBtn}
                      >
                        {ORDER_FILES_COPY.retry}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => dismissPendingUpload(upload.localId)}
                      className={btnGhost}
                      aria-label={ORDER_FILES_COPY.dismissUpload}
                      data-testid={TEST_IDS.orderFiles.dismissUploadBtn}
                    >
                      <X className="w-3.5 h-3.5 mr-1" />
                      {ORDER_FILES_COPY.dismissUpload}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-2 space-y-1">
                  <Progress value={upload.progress} data-testid={TEST_IDS.orderFiles.progressBar} />
                  <p className="text-xs text-ink-muted">{ORDER_FILES_COPY.uploading}</p>
                </div>
              )}
            </div>
          ))}

          {files.map((file) => {
            const isCurrentUser = actor !== null && file.deposited_by === actor.userId;
            const busy = visibilityBusyId === file.id;
            const missingObject = missingObjectIds.has(file.id);
            const rowError = rowErrors[file.id];
            return (
              <div
                key={file.id}
                className="border border-line-2 rounded-lg p-3 bg-paper"
                data-testid={TEST_IDS.orderFiles.row}
                data-file-id={file.id}
              >
                <div className="flex items-start gap-3">
                  <FileFamilyIcon family={resolveOrderFileIconFamily(file.content_type)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-ink font-medium truncate">{file.filename}</span>
                      <span className="text-xs text-ink-muted whitespace-nowrap">
                        {formatOrderFileSize(file.byte_size)}
                      </span>
                      {missingObject && (
                        <span
                          title={ORDER_FILES_COPY.missingObjectTooltip}
                          aria-label={ORDER_FILES_COPY.missingObjectTooltip}
                          data-testid={TEST_IDS.orderFiles.missingObjectIcon}
                        >
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        </span>
                      )}
                      {/* E10.20b — indication d origine, sur `deposited_via`
                          UNIQUEMENT (jamais deduite de `deposited_by_label`,
                          contrat). `deposited_via` est OPTIONNEL dans cet
                          increment de contrat (§8.21 §8bis) : absent = un
                          fichier `workspace`, la meme discipline que le
                          serveur. */}
                      {file.deposited_via === 'upload_link' && (
                        <span
                          className="inline-flex items-center gap-1 text-xs text-brand bg-brand/10 rounded px-1.5 py-0.5"
                          data-testid={TEST_IDS.orderFiles.uploadLinkBadge}
                        >
                          <Link2 className="w-3 h-3" />
                          {ORDER_FILES_COPY.uploadLinkBadgeLabel}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-ink-muted mt-0.5">
                      {formatOrderFileDepositedByLine(file.deposited_by_label, isCurrentUser, file.deposited_at)}
                    </p>
                    {rowError && <p className="text-xs text-err-fg mt-1">{rowError}</p>}

                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            disabled={busy}
                            className={btnGhost}
                            data-testid={TEST_IDS.orderFiles.visibilityToggle}
                          >
                            {busy ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                            ) : (
                              <Eye className="w-3.5 h-3.5 mr-1" />
                            )}
                            {file.visibility === 'internal'
                              ? ORDER_FILES_COPY.visibilityInternal
                              : ORDER_FILES_COPY.visibilityCustomer}
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-72">
                          {/* qa-review N7 (round 1) : `DropdownMenuRadioGroup` rend visible
                              la selection courante (le ○/● du wireframe Ecran C), une simple
                              liste de `DropdownMenuItem` ne le faisait pas. */}
                          <DropdownMenuRadioGroup
                            value={file.visibility}
                            onValueChange={(value) => void handleVisibilityChange(file, value as OrderFileVisibility)}
                          >
                            <DropdownMenuRadioItem
                              value="internal"
                              data-testid={TEST_IDS.orderFiles.visibilityOption}
                              data-visibility="internal"
                            >
                              {ORDER_FILES_COPY.visibilityInternal}
                            </DropdownMenuRadioItem>
                            <DropdownMenuRadioItem
                              value="customer"
                              data-testid={TEST_IDS.orderFiles.visibilityOption}
                              data-visibility="customer"
                            >
                              {ORDER_FILES_COPY.visibilityCustomer}
                            </DropdownMenuRadioItem>
                          </DropdownMenuRadioGroup>
                          {/* Avertissement PERMANENT et NON MASQUABLE (wireframe §2 Ecran C,
                              §6 arbitrage) : rendu inconditionnellement des l ouverture du
                              menu, jamais derriere un clic ou un survol supplementaire. */}
                          <div
                            className="px-2 py-2 mt-1 text-xs text-ink-muted border-t border-line-2 flex gap-1.5"
                            data-testid={TEST_IDS.orderFiles.visibilityWarning}
                          >
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                            <span>{ORDER_FILES_COPY.visibilityWarning}</span>
                          </div>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      <button
                        type="button"
                        onClick={() => void handleDownload(file)}
                        title={ORDER_FILES_COPY.downloadTooltip}
                        aria-label={ORDER_FILES_COPY.downloadTooltip}
                        className="p-1.5 text-ink-muted hover:text-ink"
                        data-testid={TEST_IDS.orderFiles.downloadBtn}
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(file)}
                        title={ORDER_FILES_COPY.deleteTooltip}
                        aria-label={ORDER_FILES_COPY.deleteTooltip}
                        className="p-1.5 text-ink-muted hover:text-err-fg"
                        data-testid={TEST_IDS.orderFiles.deleteBtn}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) {
            setDeleteTarget(null);
            setDeleteError(null);
          }
        }}
      >
        <AlertDialogContent data-testid={TEST_IDS.orderFiles.deleteDialog}>
          <AlertDialogHeader>
            <AlertDialogTitle>{ORDER_FILES_COPY.deleteDialogTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget ? ORDER_FILES_COPY.deleteDialogBody(deleteTarget.filename) : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {deleteError && (
            <p className="text-sm text-err-fg" role="alert">
              {deleteError}
            </p>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel data-testid={TEST_IDS.orderFiles.deleteCancelBtn} disabled={deleting}>
              {ORDER_FILES_COPY.deleteDialogCancel}
            </AlertDialogCancel>
            <AlertDialogAction
              data-testid={TEST_IDS.orderFiles.deleteConfirmBtn}
              disabled={deleting}
              onClick={(event) => {
                // Empeche AlertDialog Radix de fermer avant confirmation du resultat —
                // meme discipline que CancelOrderConfirmDialog (S3.4).
                event.preventDefault();
                void handleDeleteConfirm();
              }}
              className="bg-err-fg text-paper hover:bg-err-fg/90"
            >
              {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
              {ORDER_FILES_COPY.deleteDialogConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function guessPendingIconFamily(filename: string): OrderFileIconFamily {
  try {
    return resolveOrderFileIconFamily(resolveOrderFileContentType(filename));
  } catch {
    return 'unknown';
  }
}

function FileFamilyIcon({ family }: { family: OrderFileIconFamily }) {
  const className = 'w-5 h-5 text-ink-muted shrink-0 mt-0.5';
  switch (family) {
    case 'pdf':
      return <FileText className={className} />;
    case 'image':
      return <ImageIcon className={className} />;
    case 'archive':
      return <Archive className={className} />;
    default:
      return <FileIcon className={className} />;
  }
}
