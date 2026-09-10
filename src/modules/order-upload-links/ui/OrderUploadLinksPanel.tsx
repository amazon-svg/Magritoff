/**
 * OrderUploadLinksPanel — panneau "Liens de depot" sur la fiche commande
 * (E10.20a). CREE/LISTE/REVOQUE des liens, ne depose jamais de fichier
 * lui-meme : le depot se fait sur la page publique `/depot/:token`
 * (E10.20b, `ui/UploadLinkDepositPage.tsx`), livree — l avertissement "page
 * pas encore disponible" pose en E10.20a est donc RETIRE (qa-review E10.20a
 * round 1, N4 : sa raison d etre a disparu).
 *

 * MAGRIT N ENVOIE PAS LE LIEN (contrat). L atelier copie l URL publique et
 * la transmet par le canal de son choix : ce panneau propose donc un bouton
 * "Copier le lien", jamais un bouton "Envoyer".
 *
 * LE JETON EN CLAIR N APPARAIT QU UNE FOIS (contrat, seule reponse de tout
 * le contrat qui le porte) : ce panneau l affiche IMMEDIATEMENT apres la
 * creation, dans un encart dedie qui disparait des que l atelier le ferme —
 * une seconde lecture ne le rendra jamais.
 *
 * Aucun appel Supabase direct : tout passe par `OrderUploadLinksApiClient`
 * (`../api/client.ts`). Aucun controle metier pose ICI n est la seule
 * verite : les bornes des champs (label, echeance, plafond de fichiers)
 * sont un CONFORT UX, le serveur (E10.20a) reste la seule barriere reelle
 * (`.claude/rules/frontend.md`).
 *
 * Aucun wireframe Sally publie a la redaction de ce lot : gabarit visuel
 * repris tel quel d `OrderFilesBlock`/`OrderDocumentPanel` (meme section,
 * meme famille de composants), testids poses selon la convention documentee
 * en tete de `testIds.ts`, a faire confirmer par le scribe des que le
 * cahier TF existera.
 */
import { useCallback, useEffect, useState } from 'react';
import { Copy, Link2, Loader2, X } from 'lucide-react';
import { TEST_IDS } from '@/shared/presentation/testIds';
import { useWorkspaceApi } from '@/platform/runtime/workspace-ui-runtime';
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Input } from '@/shared/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select';
import { OrderUploadLinksApiClient } from '../api/client';
import type { OrderUploadLinkCreatedDto, OrderUploadLinkDto } from '../api/contracts';
import { buildUploadLinkPublicUrl, describeUploadLinkUsage, formatUploadLinkDate } from './order-upload-links.helpers';

const btnPrimary =
  'px-3 py-1.5 rounded-lg text-sm bg-brand text-white hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-1.5';
const btnGhost =
  'px-2.5 py-1 border border-line-2 rounded-lg text-xs text-ink-2 hover:bg-bg hover:text-ink disabled:opacity-50 inline-flex items-center';

export interface OrderUploadLinksPanelProps {
  orderId: string;
}

export function OrderUploadLinksPanel({ orderId }: OrderUploadLinksPanelProps) {
  const api = useWorkspaceApi(OrderUploadLinksApiClient);

  const [links, setLinks] = useState<readonly OrderUploadLinkDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [expiresInDays, setExpiresInDays] = useState<'7' | '30' | '90'>('30');
  const [maxFiles, setMaxFiles] = useState('10');

  const [createdLink, setCreatedLink] = useState<OrderUploadLinkCreatedDto | null>(null);
  const [copied, setCopied] = useState(false);

  const [revokeTarget, setRevokeTarget] = useState<OrderUploadLinkDto | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  const loadLinks = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const data = await api.list(orderId);
      setLinks(data);
    } catch {
      setListError('Chargement des liens de depot impossible.');
    } finally {
      setLoading(false);
    }
  }, [api, orderId]);

  useEffect(() => {
    void loadLinks();
  }, [loadLinks]);

  const resetCreateForm = useCallback(() => {
    setLabel('');
    setExpiresInDays('30');
    setMaxFiles('10');
    setCreateError(null);
  }, []);

  const handleCreate = useCallback(async () => {
    setCreating(true);
    setCreateError(null);
    try {
      const parsedMaxFiles = Number.parseInt(maxFiles, 10);
      const created = await api.create(orderId, {
        label: label.trim().length > 0 ? label.trim() : null,
        expires_in_days: Number(expiresInDays) as 7 | 30 | 90,
        max_files: Number.isFinite(parsedMaxFiles) ? parsedMaxFiles : 10,
      });
      setCreateOpen(false);
      resetCreateForm();
      setCreatedLink(created);
      setCopied(false);
      await loadLinks();
    } catch {
      setCreateError('Emission du lien de depot impossible.');
    } finally {
      setCreating(false);
    }
  }, [api, orderId, label, expiresInDays, maxFiles, resetCreateForm, loadLinks]);

  const handleCopy = useCallback(async () => {
    if (!createdLink) return;
    try {
      await navigator.clipboard.writeText(buildUploadLinkPublicUrl(createdLink.token));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }, [createdLink]);

  const handleRevokeConfirm = useCallback(async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    setRevokeError(null);
    try {
      await api.revoke(orderId, revokeTarget.id);
      setLinks((current) => current.filter((entry) => entry.id !== revokeTarget.id));
      setRevokeTarget(null);
    } catch {
      setRevokeError('Revocation du lien impossible.');
    } finally {
      setRevoking(false);
    }
  }, [api, orderId, revokeTarget]);

  return (
    <section
      className="border border-line rounded-xl p-4 space-y-3"
      data-testid={TEST_IDS.orderUploadLinks.block}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-ink-2 uppercase tracking-wider">Liens de dépôt</h2>
        <button
          type="button"
          className={btnPrimary}
          onClick={() => {
            resetCreateForm();
            setCreateOpen(true);
          }}
          data-testid={TEST_IDS.orderUploadLinks.createBtn}
        >
          <Link2 className="w-4 h-4" />
          Créer un lien
        </button>
      </div>

      {createdLink && (
        <div
          className="border border-brand/40 bg-brand/5 rounded-lg p-3 space-y-2"
          data-testid={TEST_IDS.orderUploadLinks.createdTokenPanel}
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs text-ink-2">
              Lien créé — copiez-le maintenant, il ne sera plus jamais affiché.
            </p>
            <button
              type="button"
              onClick={() => setCreatedLink(null)}
              aria-label="Fermer"
              className="text-ink-muted hover:text-ink shrink-0"
              data-testid={TEST_IDS.orderUploadLinks.closeCreatedPanelBtn}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={buildUploadLinkPublicUrl(createdLink.token)}
              className="flex-1 text-xs bg-paper border border-line-2 rounded px-2 py-1.5 text-ink"
              data-testid={TEST_IDS.orderUploadLinks.createdUrlField}
              onFocus={(event) => event.currentTarget.select()}
            />
            <button
              type="button"
              onClick={() => void handleCopy()}
              className={btnGhost}
              data-testid={TEST_IDS.orderUploadLinks.copyUrlBtn}
            >
              <Copy className="w-3.5 h-3.5 mr-1" />
              {copied ? 'Copié' : 'Copier'}
            </button>
          </div>
        </div>
      )}

      {listError && (
        <p className="text-sm text-err-fg" data-testid={TEST_IDS.orderUploadLinks.listErrorBanner}>
          {listError}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-ink-muted">Chargement…</p>
      ) : links.length === 0 && !listError ? (
        <p className="text-sm text-ink-muted py-2" data-testid={TEST_IDS.orderUploadLinks.emptyState}>
          Aucun lien de dépôt actif pour cette commande.
        </p>
      ) : (
        <div className="space-y-2">
          {links.map((link) => (
            <div
              key={link.id}
              className="border border-line-2 rounded-lg p-3 bg-paper flex items-center justify-between gap-3"
              data-testid={TEST_IDS.orderUploadLinks.row}
              data-link-id={link.id}
            >
              <div className="min-w-0">
                <p className="text-sm text-ink truncate">{link.label ?? 'Sans consigne'}</p>
                <p className="text-xs text-ink-muted">
                  Expire le {formatUploadLinkDate(link.expires_at)} · {link.deposited_count}/{link.max_files} déposés ·{' '}
                  {describeUploadLinkUsage(link)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRevokeTarget(link)}
                className={btnGhost}
                data-testid={TEST_IDS.orderUploadLinks.revokeBtn}
              >
                Révoquer
              </button>
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          if (!open && !creating) setCreateOpen(false);
        }}
      >
        <DialogContent data-testid={TEST_IDS.orderUploadLinks.createDialog}>
          <DialogHeader>
            <DialogTitle>Créer un lien de dépôt</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-ink-2 block mb-1" htmlFor="upload-link-label">
                Consigne pour le client (facultatif)
              </label>
              <Input
                id="upload-link-label"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="Votre fichier prêt-à-imprimer pour les 5000 flyers"
                maxLength={200}
                data-testid={TEST_IDS.orderUploadLinks.labelInput}
              />
            </div>

            <div>
              <label className="text-xs text-ink-2 block mb-1">Durée de vie</label>
              <Select value={expiresInDays} onValueChange={(value) => setExpiresInDays(value as '7' | '30' | '90')}>
                <SelectTrigger data-testid={TEST_IDS.orderUploadLinks.expiresSelect}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 jours</SelectItem>
                  <SelectItem value="30">30 jours</SelectItem>
                  <SelectItem value="90">90 jours</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs text-ink-2 block mb-1">Nombre de fichiers maximum</label>
              <Select value={maxFiles} onValueChange={setMaxFiles}>
                <SelectTrigger data-testid={TEST_IDS.orderUploadLinks.maxFilesSelect}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 5, 10, 20, 30].map((value) => (
                    <SelectItem key={value} value={String(value)}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {createError && (
              <p className="text-sm text-err-fg" data-testid={TEST_IDS.orderUploadLinks.createErrorBanner}>
                {createError}
              </p>
            )}
          </div>

          <DialogFooter>
            <button
              type="button"
              className={btnGhost}
              disabled={creating}
              onClick={() => setCreateOpen(false)}
              data-testid={TEST_IDS.orderUploadLinks.createCancelBtn}
            >
              Annuler
            </button>
            <button
              type="button"
              className={btnPrimary}
              disabled={creating}
              onClick={() => void handleCreate()}
              data-testid={TEST_IDS.orderUploadLinks.createSubmitBtn}
            >
              {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Créer le lien
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={revokeTarget !== null}
        onOpenChange={(open) => {
          if (!open && !revoking) {
            setRevokeTarget(null);
            setRevokeError(null);
          }
        }}
      >
        <AlertDialogContent data-testid={TEST_IDS.orderUploadLinks.revokeDialog}>
          <AlertDialogHeader>
            <AlertDialogTitle>Révoquer ce lien ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le lien cessera immédiatement de fonctionner. Les fichiers déjà déposés par ce lien ne
              sont pas affectés. Cette action est irréversible : un nouveau lien devra être émis si
              besoin.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {revokeError && (
            <p className="text-sm text-err-fg" role="alert">
              {revokeError}
            </p>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel data-testid={TEST_IDS.orderUploadLinks.revokeCancelBtn} disabled={revoking}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              data-testid={TEST_IDS.orderUploadLinks.revokeConfirmBtn}
              disabled={revoking}
              onClick={(event) => {
                event.preventDefault();
                void handleRevokeConfirm();
              }}
              className="bg-err-fg text-paper hover:bg-err-fg/90"
            >
              {revoking && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
              Révoquer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
