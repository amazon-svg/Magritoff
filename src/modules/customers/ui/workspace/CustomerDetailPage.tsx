/**
 * CustomerDetailPage — fiche client complete (CA1, CA4, CA6, CA7, TF-165).
 *
 * Affiche les coordonnees, les interlocuteurs (ajout + bascule du contact
 * principal), l etat de verification SIRET, et les points d extension
 * projets/devis/commandes — vides tant que E10.1/E10.3/E10.12 ne sont pas
 * livrees (pas de donnee inventee).
 */
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, CheckCircle2, Loader2, Plus, Star } from 'lucide-react';
import { useTenantPath } from '@/modules/tenants/ui/hooks';
import { useWorkspaceApi, useWorkspaceUiRuntime } from '@/platform/runtime/workspace-ui-runtime';
import { ShopsApiClient, type ShopDto } from '@/modules/shops';
import { TEST_IDS } from '@/shared/presentation/testIds';
import { useCustomerDetail } from '@/modules/customers/ui/hooks';
import type { Address, CustomerContactDto } from '@/modules/customers/api/contracts';
import { AddressFields, AddressSummary, EMPTY_ADDRESS, isAddressBlank } from './AddressFields';

const CIVILITY_LABEL: Record<string, string> = { mr: 'Monsieur', mrs: 'Madame' };

const inputCls =
  'w-full px-3 py-2 border border-line-2 rounded-lg bg-paper text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand';
const btnGhost =
  'px-3 py-1.5 border border-line-2 rounded-lg text-sm text-ink-2 hover:bg-bg hover:text-ink flex items-center gap-2';
const btnPrimary =
  'px-3 py-1.5 bg-brand text-brand-ink rounded-lg hover:opacity-90 disabled:opacity-50 text-sm font-medium flex items-center gap-2';

export function DashboardCustomerDetail() {
  const { customerId } = useParams<{ customerId: string }>();
  const tp = useTenantPath();
  const {
    detail,
    loading,
    error,
    verifying,
    update,
    verifySiret,
    addContact,
    setContactPrimary,
    openContactShopAccess,
    revokeContactShopAccess,
  } = useCustomerDetail(customerId ?? null);
  const [showAddContact, setShowAddContact] = useState(false);
  const [contactFirstName, setContactFirstName] = useState('');
  const [contactLastName, setContactLastName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [savingContact, setSavingContact] = useState(false);

  // E10.5 CA3 — boutiques du tenant, pour choisir OU ouvrir l acces quand un
  // interlocuteur n en a encore aucun. Une seule boutique -> selection
  // implicite, sans demander a l utilisateur de choisir ce qui n a qu une
  // reponse possible.
  const shopsApi = useWorkspaceApi(ShopsApiClient);
  const { tenant: currentTenant } = useWorkspaceUiRuntime();
  const [shops, setShops] = useState<readonly ShopDto[]>([]);
  const [shopAccessPendingFor, setShopAccessPendingFor] = useState<string | null>(null);
  useEffect(() => {
    if (!currentTenant) return;
    void shopsApi.list(currentTenant.id).then(setShops).catch(() => setShops([]));
  }, [shopsApi, currentTenant]);

  const openShopAccess = async (contact: CustomerContactDto) => {
    const shopId =
      shops.length === 1
        ? shops[0]!.id
        : window.prompt(
            `Boutique pour ouvrir l’accès de ${contact.first_name} ${contact.last_name} :\n` +
              shops.map((shop) => `${shop.id} — ${shop.name}`).join('\n'),
          );
    if (!shopId) return;
    setShopAccessPendingFor(contact.id);
    try {
      await openContactShopAccess(contact.id, shopId);
    } catch {
      // L erreur est deja posee dans `error` par le hook ; rien a faire ici.
    } finally {
      setShopAccessPendingFor(null);
    }
  };

  const revokeShopAccess = async (contact: CustomerContactDto, shopId: string) => {
    if (!window.confirm(`Révoquer l’accès boutique de ${contact.first_name} ${contact.last_name} ?`)) return;
    setShopAccessPendingFor(contact.id);
    try {
      await revokeContactShopAccess(contact.id, shopId);
    } catch {
      // idem
    } finally {
      setShopAccessPendingFor(null);
    }
  };

  // M4 (qa-review) : TVA et adresses de facturation/livraison, saisissables
  // et editables ici — l API les acceptait deja, seule la fiche ne les
  // affichait ni ne les proposait a l edition.
  const [editingCoordinates, setEditingCoordinates] = useState(false);
  const [editVatNumber, setEditVatNumber] = useState('');
  const [editBillingAddress, setEditBillingAddress] = useState<Address>(EMPTY_ADDRESS);
  const [editShippingDifferent, setEditShippingDifferent] = useState(false);
  const [editShippingAddress, setEditShippingAddress] = useState<Address>(EMPTY_ADDRESS);
  const [savingCoordinates, setSavingCoordinates] = useState(false);

  if (loading) return <p className="text-sm text-ink-muted">Chargement…</p>;

  if (!detail) {
    return (
      <div className="space-y-3">
        <Link
          to={tp('/dashboard/customers')}
          className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour aux clients
        </Link>
        <p className="text-sm text-ink-muted">{error ?? 'Client introuvable.'}</p>
      </div>
    );
  }

  const displayName =
    detail.type === 'company'
      ? detail.company_name
      : [
          detail.civility ? CIVILITY_LABEL[detail.civility] : null,
          detail.first_name,
          detail.last_name,
        ]
          .filter(Boolean)
          .join(' ');

  const startEditingCoordinates = () => {
    setEditVatNumber(detail.vat_number ?? '');
    setEditBillingAddress(detail.billing_address ?? EMPTY_ADDRESS);
    setEditShippingDifferent(Boolean(detail.shipping_address));
    setEditShippingAddress(detail.shipping_address ?? EMPTY_ADDRESS);
    setEditingCoordinates(true);
  };

  const submitCoordinates = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingCoordinates(true);
    try {
      await update({
        ...(detail.type === 'company' ? { vat_number: editVatNumber || null } : {}),
        billing_address: isAddressBlank(editBillingAddress) ? null : editBillingAddress,
        shipping_address:
          editShippingDifferent && !isAddressBlank(editShippingAddress) ? editShippingAddress : null,
      });
      setEditingCoordinates(false);
    } finally {
      setSavingCoordinates(false);
    }
  };

  const submitContact = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingContact(true);
    try {
      await addContact({
        first_name: contactFirstName,
        last_name: contactLastName,
        email: contactEmail,
        is_primary: false,
      });
      setContactFirstName('');
      setContactLastName('');
      setContactEmail('');
      setShowAddContact(false);
    } finally {
      setSavingContact(false);
    }
  };

  return (
    <div className="space-y-6" data-testid={TEST_IDS.customer.detailPage}>
      <Link
        to={tp('/dashboard/customers')}
        className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour aux clients
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink">{displayName || 'Client'}</h1>
          <p className="text-sm text-ink-muted mt-1">
            {detail.type === 'company' ? 'Personne morale' : 'Personne physique'}
            {' · '}
            {detail.is_active ? 'Actif' : 'Inactif'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void update({ is_active: !detail.is_active })}
          className={btnGhost}
        >
          {detail.is_active ? 'Désactiver' : 'Réactiver'}
        </button>
      </div>

      {error && <p className="text-sm text-err-fg">{error}</p>}

      {detail.type === 'company' && (
        <section className="border border-line rounded-xl p-4 space-y-2">
          <h2 className="text-sm font-bold text-ink-2 uppercase tracking-wider">Entreprise</h2>
          <p className="text-sm text-ink">
            SIRET : {detail.siret ?? '—'}
            {detail.siret_verified ? (
              <span className="ml-2 inline-flex items-center gap-1 text-xs text-green-700">
                <CheckCircle2 className="w-3.5 h-3.5" /> vérifié
              </span>
            ) : null}
          </p>
          {detail.siret && !detail.siret_verified && (
            <button
              type="button"
              onClick={() => void verifySiret()}
              disabled={verifying}
              className={btnGhost}
              data-testid={TEST_IDS.customer.siretVerifyBtn}
            >
              {verifying && <Loader2 className="w-4 h-4 animate-spin" />}
              Vérifier le SIRET
            </button>
          )}
        </section>
      )}

      <section className="border border-line rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-ink-2 uppercase tracking-wider">Coordonnées</h2>
          {!editingCoordinates && (
            <button type="button" onClick={startEditingCoordinates} className={btnGhost}>
              Modifier
            </button>
          )}
        </div>

        {editingCoordinates ? (
          <form onSubmit={submitCoordinates} className="space-y-3">
            {detail.type === 'company' && (
              <div>
                <label className="block text-xs text-ink-muted mb-1">
                  Numéro de TVA intracommunautaire
                </label>
                <input
                  type="text"
                  value={editVatNumber}
                  onChange={(event) => setEditVatNumber(event.target.value)}
                  className={inputCls}
                />
              </div>
            )}

            <AddressFields
              legend={detail.type === 'company' ? 'Adresse de facturation' : 'Adresse'}
              value={editBillingAddress}
              onChange={setEditBillingAddress}
            />

            {detail.type === 'company' && (
              <>
                <label className="flex items-center gap-2 text-sm text-ink-2">
                  <input
                    type="checkbox"
                    checked={editShippingDifferent}
                    onChange={(event) => setEditShippingDifferent(event.target.checked)}
                  />
                  Adresse de livraison différente
                </label>
                {editShippingDifferent && (
                  <AddressFields
                    legend="Adresse de livraison"
                    value={editShippingAddress}
                    onChange={setEditShippingAddress}
                  />
                )}
              </>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setEditingCoordinates(false)}
                className={btnGhost}
              >
                Annuler
              </button>
              <button type="submit" disabled={savingCoordinates} className={btnPrimary}>
                {savingCoordinates && <Loader2 className="w-4 h-4 animate-spin" />}
                Enregistrer
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-2">
            {detail.type === 'company' && (
              <p className="text-sm text-ink-muted">TVA : {detail.vat_number ?? '—'}</p>
            )}
            <div>
              <p className="text-xs text-ink-muted uppercase tracking-wider mb-1">
                {detail.type === 'company' ? 'Adresse de facturation' : 'Adresse'}
              </p>
              <AddressSummary address={detail.billing_address} />
            </div>
            {detail.type === 'company' && detail.shipping_address && (
              <div>
                <p className="text-xs text-ink-muted uppercase tracking-wider mb-1">
                  Adresse de livraison
                </p>
                <AddressSummary address={detail.shipping_address} />
              </div>
            )}
          </div>
        )}
      </section>

      <section className="border border-line rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-ink-2 uppercase tracking-wider">Interlocuteurs</h2>
          <button
            type="button"
            onClick={() => setShowAddContact((value) => !value)}
            className={btnGhost}
            data-testid={TEST_IDS.customer.contactAddBtn}
          >
            <Plus className="w-4 h-4" />
            Ajouter
          </button>
        </div>

        {showAddContact && (
          <form onSubmit={submitContact} className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
            <div>
              <label className="block text-xs text-ink-muted mb-1">Prénom</label>
              <input
                type="text"
                required
                value={contactFirstName}
                onChange={(event) => setContactFirstName(event.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs text-ink-muted mb-1">Nom</label>
              <input
                type="text"
                required
                value={contactLastName}
                onChange={(event) => setContactLastName(event.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs text-ink-muted mb-1">Email</label>
              <input
                type="email"
                required
                value={contactEmail}
                onChange={(event) => setContactEmail(event.target.value)}
                className={inputCls}
              />
            </div>
            <div className="sm:col-span-3">
              <button type="submit" disabled={savingContact} className={btnPrimary}>
                {savingContact && <Loader2 className="w-4 h-4 animate-spin" />}
                Enregistrer l’interlocuteur
              </button>
            </div>
          </form>
        )}

        {detail.contacts.length === 0 ? (
          <p className="text-sm text-ink-muted">Aucun interlocuteur pour l’instant.</p>
        ) : (
          <ul className="divide-y divide-line/60">
            {detail.contacts.map((contact) => (
              <li
                key={contact.id}
                data-testid={TEST_IDS.customer.contactRow}
                data-contact-id={contact.id}
                className="py-2 flex items-center justify-between"
              >
                <div>
                  <p className="text-sm text-ink">
                    {contact.first_name} {contact.last_name}
                    {contact.role ? <span className="text-ink-muted"> — {contact.role}</span> : null}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {contact.email}
                    {contact.phone ? ` · ${contact.phone}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <ShopAccessBadgeAndAction
                    contact={contact}
                    pending={shopAccessPendingFor === contact.id}
                    onOpen={() => void openShopAccess(contact)}
                    onRevoke={(shopId) => void revokeShopAccess(contact, shopId)}
                  />
                  <button
                    type="button"
                    onClick={() => void setContactPrimary(contact.id, !contact.is_primary)}
                    className={`p-1 rounded hover:bg-bg ${contact.is_primary ? 'text-amber-500' : 'text-ink-muted'}`}
                    data-testid={TEST_IDS.customer.contactPrimaryToggle}
                    data-contact-id={contact.id}
                    aria-pressed={contact.is_primary}
                    title={contact.is_primary ? 'Contact principal' : 'Définir comme contact principal'}
                  >
                    <Star className="w-4 h-4" fill={contact.is_primary ? 'currentColor' : 'none'} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <ExtensionPointCard title="Projets" hint="E10.1" items={detail.projects} />
        <ExtensionPointCard title="Devis" hint="E10.3" items={detail.quotes} />
        <ExtensionPointCard title="Commandes" hint="E10.12" items={detail.orders} />
      </section>
    </div>
  );
}

/**
 * E10.5 CA3/CA4 — badge + action d ouverture/revocation d un acces boutique.
 * `data-status` vaut "none" | "invited" | "active" (jamais "suspended" : un
 * acces revoque disparait de `contact.shop_accesses`, cf. contrat OpenAPI).
 * Une seule ligne par interlocuteur : s il a plusieurs acces (plusieurs
 * boutiques), le badge reflete le premier — geree explicitement une seule
 * boutique a la fois reste le perimetre de cette story (pas de gestion de
 * compte boutique complete).
 */
function ShopAccessBadgeAndAction({
  contact,
  pending,
  onOpen,
  onRevoke,
}: {
  contact: CustomerContactDto;
  pending: boolean;
  onOpen: () => void;
  onRevoke: (shopId: string) => void;
}) {
  const access = contact.shop_accesses[0] ?? null;
  const status = access?.status ?? 'none';

  return (
    <div className="flex items-center gap-2">
      <span
        data-testid={TEST_IDS.customer.contactShopAccessBadge}
        data-status={status}
        className={
          'px-2 py-0.5 rounded-full text-xs font-medium ' +
          (status === 'active'
            ? 'bg-green-100 text-green-800'
            : status === 'invited'
              ? 'bg-amber-100 text-amber-800'
              : 'bg-bg text-ink-muted')
        }
      >
        {status === 'active' ? 'Accès boutique actif' : status === 'invited' ? 'Accès invité' : 'Aucun accès boutique'}
      </span>
      {access ? (
        <button
          type="button"
          onClick={() => onRevoke(access.shop_id)}
          disabled={pending}
          className={btnGhost}
          data-testid={TEST_IDS.customer.contactRevokeShopAccessBtn}
          data-contact-id={contact.id}
        >
          {pending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Révoquer
        </button>
      ) : (
        <button
          type="button"
          onClick={onOpen}
          disabled={pending}
          className={btnGhost}
          data-testid={TEST_IDS.customer.contactOpenShopAccessBtn}
          data-contact-id={contact.id}
        >
          {pending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Ouvrir un accès boutique
        </button>
      )}
    </div>
  );
}

function ExtensionPointCard({
  title,
  hint,
  items,
}: {
  title: string;
  hint: string;
  items: readonly unknown[];
}) {
  return (
    <div className="border border-line rounded-xl p-4">
      <h3 className="text-sm font-bold text-ink-2 uppercase tracking-wider">{title}</h3>
      <p className="text-sm text-ink-muted mt-2">
        {items.length === 0 ? `Aucun(e) — module ${hint} à venir.` : `${items.length}`}
      </p>
    </div>
  );
}
