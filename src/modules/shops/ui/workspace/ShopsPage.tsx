import { useState, useRef, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { Plus, Store, Trash2, Copy, ExternalLink, Loader2, Settings2 } from 'lucide-react';
import { useShops, type NewShopInput, type Shop } from '@/modules/shops/ui/runtime/ShopsContext';
import { usePlan } from '@/modules/plans/ui/hooks';
import { useTenantPath } from '@/modules/tenants/ui/hooks';
import { UpgradeCTA } from '@/modules/plans/ui/components';
import { Button } from '@/shared/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/shared/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogCancel } from '@/shared/ui/alert-dialog';

const field = 'w-full min-h-11 rounded-lg border border-line-2 bg-paper px-3 py-2 text-sm text-ink';
const primary = 'min-h-11 bg-brand text-brand-ink hover:bg-brand/90';

export function DashboardShops() {
  const navigate = useNavigate();
  const { canUse } = usePlan();
  const tp = useTenantPath();
  const { shops, loading, error: loadError, refresh, createShop, deleteShop } = useShops();
  const createTrigger = useRef<HTMLButtonElement>(null);
  const deleteTrigger = useRef<HTMLButtonElement | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState<NewShopInput>({ name: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Shop | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);

  if (!canUse('shops')) return <UpgradeCTA feature="Boutiques en ligne" />;
  const publicUrl = (slug: string) => `${window.location.origin}/shop/${slug}`;
  const removeShop = async () => {
    if (!deleting || deleteBusy) return;
    setDeleteBusy(true); setDeleteError(null);
    try {
      await deleteShop(deleting.id);
      setNotice(`La boutique « ${deleting.name} » a été supprimée.`);
      setDeleting(null);
    } catch (cause) {
      setDeleteError(cause instanceof Error ? cause.message : 'Suppression impossible. Réessayez.');
    } finally { setDeleteBusy(false); }
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true); setError(null);
    try {
      const shop = await createShop({ ...draft, name: draft.name.trim() });
      if (!shop) throw new Error('Création impossible. Vérifiez votre connexion et réessayez.');
      setModalOpen(false); setDraft({ name: '', description: '' });
      navigate(tp(`/dashboard/shops/${shop.id}`));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Création impossible. Réessayez.');
    } finally { setSaving(false); }
  };
  const copyLink = async (shop: Shop) => {
    setCopyError(null);
    try {
      await navigator.clipboard.writeText(publicUrl(shop.slug));
      setNotice(`Le lien de « ${shop.name} » a été copié.`);
    } catch {
      setCopyError('Le lien n’a pas pu être copié. Sélectionnez l’adresse affichée pour la copier.');
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Boutiques</h1>
          <p className="mt-1 text-sm text-ink-muted">Gérez les produits, les accès clients et l’apparence de vos boutiques.</p>
        </div>
        <Button ref={createTrigger} className={primary} onClick={() => { setError(null); setModalOpen(true); }}><Plus />Créer une boutique</Button>
      </header>
      {notice && <p role="status" className="rounded-lg border border-ok-line bg-ok-bg px-4 py-3 text-sm text-ok-fg">{notice}</p>}
      {copyError && <p role="alert" className="rounded-lg bg-err-bg px-4 py-3 text-sm text-err-fg">{copyError}</p>}
      {loadError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-err-bg p-4 text-sm text-err-fg">
        <p>{loadError}</p><Button variant="outline" className="min-h-11" disabled={loading} onClick={() => void refresh()}>Réessayer</Button>
      </div>}
      {loading && <p role="status" className="flex items-center gap-2 text-sm text-ink-muted"><Loader2 className="size-4 animate-spin" />Chargement des boutiques…</p>}
      {!loading && !loadError && shops.length === 0 ? (
        <section className="rounded-xl border border-line bg-paper px-6 py-12 text-center">
          <Store aria-hidden="true" className="mx-auto mb-4 size-10 text-ink-muted" />
          <h2 className="text-lg font-medium text-ink">Votre première boutique</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">Créez une boutique, associez vos produits et choisissez comment vos clients y accèdent.</p>
          <p className="mt-3 text-sm text-ink-muted">Utilisez « Créer une boutique » pour commencer.</p>
        </section>
      ) : shops.length > 0 && (
        <section aria-label="Liste des boutiques" className="space-y-3">
          <p className="text-sm text-ink-muted">{shops.length} boutique{shops.length > 1 ? 's' : ''}</p>
          {shops.map(shop => (
            <article key={shop.id} className="rounded-xl border border-line bg-paper p-4 sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="min-w-0 break-words text-lg font-medium text-ink"><Link className="hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand" to={tp(`/dashboard/shops/${shop.id}`)}>{shop.name}</Link></h2>
                    <span className={`rounded-full px-2 py-1 text-xs ${shop.active ? 'bg-ok-bg text-ok-fg' : 'bg-bg text-ink-muted'}`}>{shop.active ? 'Active' : 'Désactivée'}</span>
                  </div>
                  <p className="mt-1 text-sm text-ink-muted">{shop.access_mode === 'self_signup' ? 'Inscription libre' : 'Accès sur invitation'}</p>
                  {shop.description && <p className="mt-2 break-words text-sm text-ink-2">{shop.description}</p>}
                </div>
                <Button asChild variant="outline" className="min-h-11"><Link to={tp(`/dashboard/shops/${shop.id}`)}><Settings2 />Gérer la boutique</Link></Button>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                <span className="min-w-0 flex-1 break-all font-mono text-xs text-ink-muted">{publicUrl(shop.slug)}</span>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="min-h-11 min-w-11" aria-label={`Copier le lien de ${shop.name}`} onClick={() => void copyLink(shop)}><Copy /></Button>
                  <Button asChild variant="ghost" className="min-h-11"><a href={publicUrl(shop.slug)} target="_blank" rel="noreferrer" aria-label={`Voir ${shop.name} dans un nouvel onglet`}><ExternalLink />Voir la boutique</a></Button>
                  <Button variant="ghost" size="icon" className="min-h-11 min-w-11 text-err-fg hover:bg-err-bg hover:text-err-fg" aria-label={`Supprimer la boutique ${shop.name}`} onClick={event => { deleteTrigger.current = event.currentTarget; setDeleteError(null); setDeleting(shop); }}><Trash2 /></Button>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}
      <Dialog open={modalOpen} onOpenChange={open => { if (!saving) setModalOpen(open); }}>
        <DialogContent onCloseAutoFocus={event => { event.preventDefault(); createTrigger.current?.focus(); }} className="max-h-[90vh] overflow-y-auto bg-paper text-ink">
          <DialogHeader><DialogTitle>Créer une boutique</DialogTitle><DialogDescription>Donnez-lui un nom. Vous pourrez ensuite choisir ses produits, ses accès et son apparence.</DialogDescription></DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <label className="block space-y-1 text-sm text-ink">Nom de la boutique (obligatoire)<input className={field} required maxLength={120} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="Ex. Boutique Imprimerie Dupont" /></label>
            <label className="block space-y-1 text-sm text-ink">Description<textarea className={field} maxLength={2000} rows={3} value={draft.description ?? ''} onChange={e => setDraft({ ...draft, description: e.target.value })} /></label>
            {error && <p role="alert" className="rounded-lg bg-err-bg p-3 text-sm text-err-fg">{error}</p>}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" className="min-h-11" disabled={saving} onClick={() => setModalOpen(false)}>Annuler</Button><Button type="submit" disabled={saving || !draft.name.trim()} className={primary}>{saving && <Loader2 className="animate-spin" />}{saving ? 'Création…' : 'Créer la boutique'}</Button></div>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog open={deleting !== null} onOpenChange={open => { if (!open && !deleteBusy) setDeleting(null); }}>
        <AlertDialogContent onCloseAutoFocus={event => { event.preventDefault(); if (deleteTrigger.current?.isConnected) deleteTrigger.current.focus(); else createTrigger.current?.focus(); }} className="bg-paper text-ink">
          <AlertDialogTitle>Supprimer « {deleting?.name} » ?</AlertDialogTitle>
          <AlertDialogDescription>Ses produits, réglages, comptes clients et commandes non validées seront supprimés. Les commandes déjà validées seront conservées pour l’historique. Cette action est irréversible.</AlertDialogDescription>
          {deleteError && <p role="alert" className="rounded-lg bg-err-bg p-3 text-sm text-err-fg">{deleteError}</p>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><AlertDialogCancel className="min-h-11" disabled={deleteBusy}>Annuler</AlertDialogCancel><Button className="min-h-11 bg-err-fg text-paper hover:bg-err-fg/90" disabled={deleteBusy} onClick={() => void removeShop()}>{deleteBusy ? 'Suppression…' : 'Supprimer la boutique'}</Button></div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
