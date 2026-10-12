import { useEffect, useRef, useState } from 'react';
import { Link, useBlocker, useParams } from 'react-router';
import { useTenantPath } from '@/modules/tenants/ui/hooks';
import { useTenant } from '@/modules/tenants/ui';
import { Button } from '@/shared/ui/button';
import { Pagination } from '@/shared/ui/pagination';
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogCancel } from '@/shared/ui/alert-dialog';
import { useShopCustomerDetail } from '../hooks/useShopCustomerDetail';

const statusLabels: Record<string, string> = { active: 'Actif', invited: 'Invitation en attente', delegated_only: 'Préparé', suspended: 'Désactivé' };
const orderLabels: Record<string, string> = { draft: 'Brouillon', validated: 'Validée', in_production: 'En production', shipped: 'Expédiée', delivered: 'Livrée', invoiced: 'Facturée', cancelled: 'Annulée' };
const money = (value: string, currency: string) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(Number(value));
const date = (value: string | null) => value ? new Date(value).toLocaleDateString('fr-FR') : '—';

export function ShopCustomerDetailPage() {
  const { currentTenant } = useTenant();
  const { shopId, customerId } = useParams<{ shopId: string; customerId: string }>();
  if (!currentTenant || !shopId || !customerId) return <p role="status">Chargement du client…</p>;
  return <CustomerDetail key={`${currentTenant.id}:${shopId}:${customerId}`} tenantId={currentTenant.id} shopId={shopId} customerId={customerId} />;
}

function CustomerDetail({ tenantId, shopId, customerId }: { tenantId: string; shopId: string; customerId: string }) {
  const tp = useTenantPath();
  const management = useShopCustomerDetail(tenantId, shopId, customerId);
  const { detail, loading, error, saving, feedback } = management;
  const [name, setName] = useState('');
  const accessButton = useRef<HTMLButtonElement>(null);
  const [confirmAccess, setConfirmAccess] = useState(false);
  const customer = detail?.customer;
  useEffect(() => { if (customer) setName(customer.fullName); }, [customer?.fullName]);
  const dirty = !!customer && name !== customer.fullName;
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && !saving && currentLocation.pathname !== nextLocation.pathname);
  useEffect(() => {
    const protect = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', protect);
    return () => window.removeEventListener('beforeunload', protect);
  }, [dirty]);
  const back = <Link className="inline-flex min-h-11 items-center text-sm text-ink underline underline-offset-4" to={tp(`/dashboard/shops/${shopId}?section=clients`)}>← Clients de la boutique</Link>;

  if (!customer) return <div className="space-y-4">{back}<h1 className="text-2xl font-semibold">Client boutique</h1>
    {loading ? <p role="status">Chargement du client…</p> : <div role="alert"><p>{error ?? 'Client introuvable.'}</p><Button variant="outline" className="mt-3 min-h-11" onClick={() => void management.refresh()}>Réessayer</Button></div>}</div>;

  return <div className="mx-auto max-w-5xl space-y-6">
    <header className="space-y-2">{back}<h1 className="break-words text-2xl font-semibold text-ink">{customer.fullName}</h1>
      <p className="break-all text-sm text-ink-muted">{customer.email} · {statusLabels[customer.status]}</p>
    </header>
    {error && <p role="alert" className="rounded-lg bg-err-bg p-3 text-sm text-err-fg">{error}</p>}
    {feedback && <p role="status" className="rounded-lg bg-ok-bg p-3 text-sm text-ink">{feedback}</p>}
    <section className="space-y-4 rounded-xl border border-line bg-paper p-4">
      <h2 className="text-lg font-semibold">Informations générales</h2>
      <form onSubmit={event => { event.preventDefault(); void management.update({ fullName: name }).then(saved => { if (saved) setName(name.trim()); }); }} className="space-y-3">
        <label className="block text-sm font-medium" htmlFor="shop-customer-name">Nom complet</label>
        <input id="shop-customer-name" required maxLength={200} value={name} disabled={saving} onChange={event => setName(event.target.value)} className="min-h-11 w-full max-w-lg rounded-lg border border-line-2 bg-paper px-3 py-2" />
        <div><Button type="submit" className="min-h-11" disabled={saving || !dirty || !name.trim()}>{saving ? 'Enregistrement…' : 'Enregistrer les informations'}</Button></div>
      </form>
      <dl className="grid gap-4 text-sm sm:grid-cols-2">
        <div><dt className="text-ink-muted">Email de connexion</dt><dd className="break-all">{customer.email}</dd></div>
        <div><dt className="text-ink-muted">Création du compte</dt><dd>{date(customer.createdAt)}</dd></div>
        <div><dt className="text-ink-muted">Activation</dt><dd>{date(customer.activatedAt)}</dd></div>
        {customer.suspendedAt && <div><dt className="text-ink-muted">Désactivation</dt><dd>{date(customer.suspendedAt)}</dd></div>}
      </dl>
      <div className="border-t border-line pt-4">
        <Button ref={accessButton} variant="outline" className="min-h-11" disabled={saving} onClick={() => setConfirmAccess(true)}>{customer.status === 'suspended' ? 'Réactiver l’accès' : 'Désactiver l’accès'}</Button>
        {customer.status === 'invited' && <p className="mt-2 text-sm text-ink-muted">Le client doit utiliser son invitation pour activer son compte.</p>}
      </div>
    </section>
    <section className="space-y-3 rounded-xl border border-line bg-paper p-4">
      <h2 className="text-lg font-semibold">Chiffre d’affaires HT</h2>
      <p className="text-sm text-ink-muted">Depuis la création du compte : commandes validées, en production, expédiées, livrées ou facturées. Les brouillons et annulations sont exclus. Total séparé par devise.</p>
      {detail.revenue.length ? <dl className="flex flex-wrap gap-6">{detail.revenue.map(value => <div key={value.currency}><dt className="text-sm text-ink-muted">{value.currency} · {value.orderCount} commande(s)</dt><dd className="font-mono text-2xl font-semibold">{money(value.totalHt, value.currency)}</dd></div>)}</dl> : <p>Aucune commande validée.</p>}
      <p className="text-sm text-ink-muted">{detail.orderCount} commande(s) au total, tous statuts confondus.</p>
    </section>
    <section className="space-y-3 rounded-xl border border-line bg-paper p-4">
      <h2 className="text-lg font-semibold">Commandes du client</h2>
      {management.ordersError ? <div role="alert"><p>{management.ordersError}</p><Button variant="outline" className="mt-2 min-h-11" onClick={management.retryOrders}>Réessayer les commandes</Button></div>
        : management.ordersLoading ? <p role="status">Chargement des commandes…</p>
        : management.orders.items.length === 0 ? <p className="text-sm text-ink-muted">Aucune commande sur cette page.</p>
        : <ul className="divide-y divide-line">{management.orders.items.map(order => <li key={order.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="min-w-0"><Link to={tp(`/dashboard/orders/${order.id}`)} className="inline-flex min-h-11 items-center break-all text-sm font-medium underline underline-offset-4">Commande {order.number ?? order.id.slice(0, 8)}</Link><p className="text-sm text-ink-muted">{date(order.createdAt)} · {orderLabels[order.status] ?? order.status}</p></div>
          <p className="font-mono text-sm">{money(order.totalHt, order.currency)} HT</p>
        </li>)}</ul>}
      <Pagination aria-label="Pages des commandes" className="flex flex-wrap items-center gap-3 pt-3">
        <Button variant="outline" className="min-h-11" disabled={management.ordersLoading || management.pageNumber === 1} onClick={management.previousPage}>Commandes précédentes</Button>
        <span role="status" className="text-sm">Page {management.pageNumber}</span>
        <Button variant="outline" className="min-h-11" disabled={management.ordersLoading || !!management.ordersError || !management.orders.nextCursor} onClick={management.nextPage}>Commandes suivantes</Button>
      </Pagination>
    </section>
    <AlertDialog open={confirmAccess} onOpenChange={open => { if (!saving) setConfirmAccess(open); }}>
      <AlertDialogContent onCloseAutoFocus={event => { event.preventDefault(); accessButton.current?.focus(); }}><AlertDialogTitle>{customer.status === 'suspended' ? 'Réactiver l’accès à la boutique ?' : 'Désactiver l’accès à la boutique ?'}</AlertDialogTitle>
        <AlertDialogDescription>{customer.status === 'suspended' ? 'Le client pourra se reconnecter avec son compte activé, ou utiliser son invitation si son compte n’a jamais été activé.' : 'Le client ne pourra plus se connecter et ses sessions seront révoquées. Ses informations et ses commandes restent conservées.'}</AlertDialogDescription>
        {error && <p role="alert" className="text-sm text-err-fg">{error}</p>}
        <div className="flex flex-wrap gap-2"><AlertDialogCancel className="min-h-11" disabled={saving}>Annuler</AlertDialogCancel><Button className="min-h-11" disabled={saving} onClick={() => void management.update({ enabled: customer.status === 'suspended' }).then(saved => { if (saved) setConfirmAccess(false); })}>{saving ? 'Enregistrement…' : 'Confirmer'}</Button></div>
      </AlertDialogContent>
    </AlertDialog>
    <AlertDialog open={blocker.state === 'blocked'} onOpenChange={open => { if (!open && blocker.state === 'blocked') blocker.reset(); }}>
      <AlertDialogContent><AlertDialogTitle>Quitter sans enregistrer ?</AlertDialogTitle><AlertDialogDescription>Le nom du client a été modifié. Enregistrez-le ou choisissez de quitter sans conserver la saisie.</AlertDialogDescription>
        <div className="flex flex-wrap gap-2"><AlertDialogCancel className="min-h-11">Rester sur le client</AlertDialogCancel><Button variant="outline" className="min-h-11" onClick={() => { if (blocker.state === 'blocked') blocker.proceed(); }}>Quitter sans enregistrer</Button></div>
      </AlertDialogContent>
    </AlertDialog>
  </div>;
}
