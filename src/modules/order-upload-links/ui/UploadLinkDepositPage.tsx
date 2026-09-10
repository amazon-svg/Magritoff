/**
 * UploadLinkDepositPage — page PUBLIQUE de depot par un lien (E10.20b),
 * montee sur `/depot/:token` (surface `storefront`, AUCUNE session
 * workspace — voir `src/app/routes.tsx`). C est la page que
 * `buildUploadLinkPublicUrl` (`order-upload-links.helpers.ts`, E10.20a)
 * compose et que `OrderUploadLinksPanel` invite l atelier a copier.
 *
 * VUE PAR UN NON-UTILISATEUR, SOUVENT SUR MOBILE, SANS REPERE MAGRIT
 * (passage Sally UX, contrat §8.21 §5) : une seule chance de faire
 * comprendre quoi deposer. Le contexte (nom de l imprimeur, numero de
 * commande, consigne) est affiche EN PREMIER, avant tout formulaire — sans
 * lui, un inconnu ne sait ni si le lien est le bon, ni quel fichier envoyer.
 *
 * ARBITRAGE (E), DEPOT SEUL : cette page ne relit JAMAIS ce qui a ete
 * depose (ni par ce lien, ni par un autre) — un COMPTEUR ("2 sur 10"), et
 * rien de plus. Pas de liste de fichiers, pas de telechargement, pas de
 * prix, pas de statut de commande.
 *
 * Aucun appel Supabase direct, aucune dependance a une session workspace :
 * tout passe par `OrderUploadLinkDepositApiClient` (`../api/client.ts`), le
 * jeton du lien porte l identite entiere (en-tete `X-Magrit-Upload-Link`,
 * jamais un `Authorization`). Aucun controle metier pose ICI n est la seule
 * verite : `validateUploadLinkDeposit` est un CONFORT UX immediat, le
 * serveur (E10.20b) reste la seule barriere reelle sur le poids, le format
 * et les DEUX plafonds qui se cumulent (`.claude/rules/frontend.md`).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { AlertTriangle, CheckCircle2, Loader2, UploadCloud } from 'lucide-react';
import { TEST_IDS } from '@/shared/presentation/testIds';
import { useStorefrontUiRuntime } from '@/platform/runtime/storefront-ui-runtime';
import { Progress } from '@/shared/ui/progress';
import { OrderUploadLinkDepositApiClient } from '../api/client';
import { supportedOrderFileExtensions, type OrderFileUploadTicketDto } from '../../order-files';
import type { OrderUploadLinkContextDto, OrderUploadLinkDepositDto } from '../api/contracts';
import {
  describeUploadLinkDepositFailure,
  isUploadLinkInvalidFailure,
  isUploadMissingFailure,
  UPLOAD_LINK_DEPOSIT_COPY,
  validateUploadLinkDeposit,
} from './upload-link-deposit.helpers';

type DepositStatus = 'uploading' | 'confirming' | 'error';

interface PendingDeposit {
  file: File;
  status: DepositStatus;
  progress: number;
  error?: string | undefined;
  retryable?: boolean | undefined;
  ticket?: OrderFileUploadTicketDto | undefined;
  idempotencyKey?: string | undefined;
  /**
   * qa-review round 1 (B2, BLOQUANT FONCTIONNEL) — vrai UNIQUEMENT une fois
   * le `PUT` sur l URL signee reellement ABOUTI. `ticket`/`idempotencyKey`
   * sont poses AVANT le `PUT` (des l emission du billet) : leur seule
   * presence ne prouve PAS qu un envoi a reussi. Avant ce correctif, un
   * reseau perdu PENDANT le `PUT` laissait `ticket` deja defini, et
   * "Réessayer" sautait a tort directement a la confirmation — 404
   * `order_file.upload_missing` a chaque nouvelle tentative, message
   * affichant a tort "le fichier a ete transmis", client bloque jusqu au
   * rechargement complet de la page.
   */
  uploaded?: boolean | undefined;
}

const btnPrimary =
  'px-4 py-2 rounded-lg text-sm bg-brand text-white hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-1.5';
const btnGhost =
  'px-3 py-1.5 border border-line-2 rounded-lg text-sm text-ink-2 hover:bg-bg hover:text-ink disabled:opacity-50 inline-flex items-center';

export function UploadLinkDepositPage() {
  const { token } = useParams<{ token: string }>();
  const { apiClient } = useStorefrontUiRuntime();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [context, setContext] = useState<OrderUploadLinkContextDto | null>(null);
  const [loadingContext, setLoadingContext] = useState(true);
  const [linkInvalid, setLinkInvalid] = useState(false);
  const [depositedCount, setDepositedCount] = useState(0);
  const [pending, setPending] = useState<PendingDeposit | null>(null);
  const [dropzoneError, setDropzoneError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [lastDeposit, setLastDeposit] = useState<OrderUploadLinkDepositDto | null>(null);

  const client = token ? new OrderUploadLinkDepositApiClient(apiClient, token) : null;

  const loadContext = useCallback(async () => {
    if (!client) {
      setLinkInvalid(true);
      setLoadingContext(false);
      return;
    }
    setLoadingContext(true);
    setLinkInvalid(false);
    try {
      const upstreamContext = await client.getContext();
      setContext(upstreamContext);
      setDepositedCount(upstreamContext.deposited_count);
    } catch {
      // `upload_link.invalid` (jeton absent/inexistant/expire/revoque, sans
      // distinction — arbitrage (F)) est la SEULE cause possible ici : cette
      // operation n a ni scope ni capability, aucune autre erreur de domaine
      // n existe pour `getOrderUploadLinkContext`.
      setLinkInvalid(true);
    } finally {
      setLoadingContext(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    void loadContext();
  }, [loadContext]);

  const updatePending = useCallback((patch: Partial<PendingDeposit>) => {
    setPending((current) => (current ? { ...current, ...patch } : current));
  }, []);

  const runDeposit = useCallback(
    async (
      file: File,
      options?: {
        /**
         * qa-review round 1 (B2) — ne saute au billet/PUT existants QUE si
         * le `PUT` a REELLEMENT abouti (`uploaded: true`), jamais sur la
         * seule presence d un `ticket` (pose des l EMISSION du billet, AVANT
         * le `PUT` — voir `PendingDeposit.uploaded`).
         */
        resumeFromConfirm?: boolean | undefined;
        ticket?: OrderFileUploadTicketDto | undefined;
        idempotencyKey?: string | undefined;
      },
    ) => {
      if (!client) return;

      let ticket = options?.resumeFromConfirm ? options.ticket : undefined;
      let idempotencyKey = options?.resumeFromConfirm ? options.idempotencyKey : undefined;

      if (!ticket || !idempotencyKey) {
        setPending({ file, status: 'uploading', progress: 0, uploaded: false });

        try {
          ticket = await client.issueFileUploadUrl();
        } catch (cause) {
          if (isUploadLinkInvalidFailure(cause)) {
            setLinkInvalid(true);
            setPending(null);
            return;
          }
          const failure = describeUploadLinkDepositFailure(cause, UPLOAD_LINK_DEPOSIT_COPY.errorUploadNetwork);
          updatePending({ status: 'error', error: failure.message, retryable: failure.retryable });
          return;
        }

        idempotencyKey = crypto.randomUUID();
        // `uploaded: false` EXPLICITE : le billet existe, le PUT n a pas
        // encore ete tente. Tant que ce drapeau n est pas passe a `true`
        // (juste apres un PUT reussi, ci-dessous), un "Réessayer" DOIT
        // reprendre au debut (nouveau billet), jamais sauter a la
        // confirmation.
        updatePending({ ticket, idempotencyKey, uploaded: false });

        try {
          await client.uploadFile(ticket, file.name, file, (loaded, total) => {
            updatePending({ progress: total > 0 ? Math.round((loaded / total) * 100) : 0 });
          });
          // qa-review round 1 (B2) — LE PUT A REELLEMENT ABOUTI : c est
          // desormais, et seulement desormais, sur qu un "Réessayer" peut
          // sauter directement a la confirmation avec CE billet.
          updatePending({ uploaded: true });
        } catch {
          updatePending({
            status: 'error',
            error: UPLOAD_LINK_DEPOSIT_COPY.errorUploadNetwork,
            retryable: true,
          });
          return;
        }
      } else {
        updatePending({ status: 'confirming', progress: 100, error: undefined, retryable: undefined });
      }

      updatePending({ status: 'confirming', progress: 100 });
      try {
        const deposit = await client.confirmFile({ file_id: ticket.file_id, filename: file.name }, idempotencyKey);
        setLastDeposit(deposit);
        setDepositedCount(deposit.deposited_count);
        setPending(null);
      } catch (cause) {
        if (isUploadLinkInvalidFailure(cause)) {
          setLinkInvalid(true);
          setPending(null);
          return;
        }
        const failure = describeUploadLinkDepositFailure(cause, UPLOAD_LINK_DEPOSIT_COPY.errorConfirmFailed);
        // qa-review round 1 (B2) — le serveur dit qu AUCUN octet n a ete
        // recu au chemin attendu (TOCTOU rarissime, ou tout autre cas ou la
        // croyance locale "uploaded: true" se revele fausse cote serveur) :
        // FORCE un envoi COMPLET au prochain "Réessayer" en effacant le
        // billet — rejouer la MEME confirmation echouerait a l identique en
        // boucle, exactement le blocage signale.
        const mustRestartFully = isUploadMissingFailure(cause);
        updatePending({
          status: 'error',
          error: failure.message,
          retryable: failure.retryable,
          ...(mustRestartFully
            ? { ticket: undefined, idempotencyKey: undefined, uploaded: false }
            : {}),
        });
      }
    },
    [client, updatePending],
  );

  const retryPending = useCallback(() => {
    if (!pending) return;
    // qa-review round 1 (B2, BLOQUANT FONCTIONNEL, corrige) — ne reprend a
    // la confirmation que si le PUT a REELLEMENT abouti (`uploaded: true`).
    // Avant ce correctif, `pending.ticket !== undefined` suffisait a lui
    // seul : un reseau perdu PENDANT le PUT laissait `ticket` deja pose (il
    // est ecrit des l emission du billet, avant le PUT), et "Réessayer"
    // sautait a tort la ligne directement a la confirmation — 404
    // `order_file.upload_missing` a chaque nouvelle tentative, indefiniment,
    // jusqu au rechargement complet de la page.
    const canResumeConfirm =
      pending.status === 'error' &&
      pending.uploaded === true &&
      pending.ticket !== undefined &&
      pending.idempotencyKey !== undefined;
    void runDeposit(pending.file, {
      resumeFromConfirm: canResumeConfirm,
      ticket: canResumeConfirm ? pending.ticket : undefined,
      idempotencyKey: canResumeConfirm ? pending.idempotencyKey : undefined,
    });
  }, [pending, runDeposit]);

  const beginDeposit = useCallback(
    (file: File) => {
      if (!context) return;
      const validation = validateUploadLinkDeposit({ name: file.name, size: file.size }, depositedCount, context.max_files);
      if (!validation.ok) {
        setDropzoneError(validation.error);
        return;
      }
      setDropzoneError(null);
      setLastDeposit(null);
      void runDeposit(file);
    },
    [context, depositedCount, runDeposit],
  );

  const acceptAttr = supportedOrderFileExtensions()
    .map((extension) => `.${extension}`)
    .join(',');

  if (loadingContext) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6" data-testid={TEST_IDS.uploadLinkDepot.page}>
        <p className="text-sm text-ink-muted" data-testid={TEST_IDS.uploadLinkDepot.loadingState}>
          {UPLOAD_LINK_DEPOSIT_COPY.loadingContext}
        </p>
      </main>
    );
  }

  if (linkInvalid || !context) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6" data-testid={TEST_IDS.uploadLinkDepot.page}>
        <div
          className="max-w-sm w-full border border-line rounded-xl p-6 text-center space-y-2"
          data-testid={TEST_IDS.uploadLinkDepot.invalidLinkBanner}
        >
          <AlertTriangle className="w-6 h-6 text-amber-600 mx-auto" />
          <p className="text-base font-medium text-ink">{UPLOAD_LINK_DEPOSIT_COPY.invalidLinkTitle}</p>
          <p className="text-sm text-ink-muted">{UPLOAD_LINK_DEPOSIT_COPY.invalidLinkBody}</p>
        </div>
      </main>
    );
  }

  const atCapacity = depositedCount >= context.max_files;

  return (
    <main className="min-h-screen flex items-center justify-center p-4" data-testid={TEST_IDS.uploadLinkDepot.page}>
      <div className="max-w-md w-full border border-line rounded-xl p-6 space-y-4 bg-paper">
        <div className="text-center space-y-1">
          <p className="text-sm text-ink-muted" data-testid={TEST_IDS.uploadLinkDepot.printerName}>
            {context.printer_name}
          </p>
          <p className="text-lg font-bold text-ink" data-testid={TEST_IDS.uploadLinkDepot.orderNumber}>
            {context.order_number}
          </p>
          {context.label && (
            <p className="text-sm text-ink-2" data-testid={TEST_IDS.uploadLinkDepot.labelText}>
              {context.label}
            </p>
          )}
        </div>

        <p className="text-xs text-ink-muted text-center" data-testid={TEST_IDS.uploadLinkDepot.counter}>
          {UPLOAD_LINK_DEPOSIT_COPY.depositedCount(depositedCount, context.max_files)}
        </p>

        {lastDeposit && (
          <div
            className="border border-brand/40 bg-brand/5 rounded-lg p-3 text-center space-y-1"
            data-testid={TEST_IDS.uploadLinkDepot.successBanner}
          >
            <CheckCircle2 className="w-5 h-5 text-brand mx-auto" />
            <p className="text-sm font-medium text-ink">{UPLOAD_LINK_DEPOSIT_COPY.depositSuccessTitle}</p>
            <p className="text-xs text-ink-muted">{UPLOAD_LINK_DEPOSIT_COPY.depositSuccessBody(lastDeposit.filename)}</p>
          </div>
        )}

        {!atCapacity && !pending && (
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragActive(false);
              const file = event.dataTransfer.files?.[0];
              if (file) beginDeposit(file);
            }}
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              dragActive ? 'border-brand bg-brand/5' : 'border-line-2'
            }`}
            data-testid={TEST_IDS.uploadLinkDepot.dropzone}
          >
            <UploadCloud className="w-6 h-6 text-ink-muted mx-auto mb-2" />
            <p className="text-sm text-ink">{UPLOAD_LINK_DEPOSIT_COPY.dropzoneTitle}</p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={`${btnPrimary} mt-3`}
              data-testid={TEST_IDS.uploadLinkDepot.browseBtn}
            >
              {UPLOAD_LINK_DEPOSIT_COPY.dropzoneBrowse}
            </button>
            <p className="text-xs text-ink-muted mt-2">{UPLOAD_LINK_DEPOSIT_COPY.dropzoneLimits(context.max_files)}</p>
            <input
              ref={fileInputRef}
              type="file"
              accept={acceptAttr}
              className="hidden"
              data-testid={TEST_IDS.uploadLinkDepot.fileInput}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file) beginDeposit(file);
              }}
            />
          </div>
        )}

        {dropzoneError && (
          <p className="text-sm text-err-fg text-center" data-testid={TEST_IDS.uploadLinkDepot.dropzoneError}>
            {dropzoneError}
          </p>
        )}

        {pending && (
          <div className="border border-line-2 rounded-lg p-3 bg-bg space-y-2">
            <p className="text-sm text-ink truncate">{pending.file.name}</p>
            {pending.status === 'error' ? (
              <div className="space-y-2">
                <p className="text-sm text-err-fg" data-testid={TEST_IDS.uploadLinkDepot.depositErrorBanner}>
                  {pending.error}
                </p>
                {pending.retryable !== false && (
                  <button type="button" onClick={retryPending} className={btnGhost} data-testid={TEST_IDS.uploadLinkDepot.retryBtn}>
                    {UPLOAD_LINK_DEPOSIT_COPY.retry}
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                <Progress value={pending.progress} data-testid={TEST_IDS.uploadLinkDepot.progressBar} />
                <p className="text-xs text-ink-muted">
                  {pending.status === 'uploading'
                    ? UPLOAD_LINK_DEPOSIT_COPY.uploading
                    : UPLOAD_LINK_DEPOSIT_COPY.confirming}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
