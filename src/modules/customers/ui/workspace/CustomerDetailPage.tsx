/**
 * CustomerDetailPage — fiche client complete (CA1, CA4, CA6, CA7, TF-165).
 *
 * Affiche les coordonnees, les interlocuteurs (ajout + bascule du contact
 * principal), l etat de verification SIRET, et les points d extension
 * projets/devis/commandes — vides tant que E10.1/E10.3/E10.12 ne sont pas
 * livrees (pas de donnee inventee).
 */
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, CheckCircle2, Loader2, Plus, Star } from 'lucide-react';
import { useTenantPath } from '@/modules/tenants/ui/hooks';
import { TEST_IDS } from '@/shared/presentation/testIds';
import { useCustomerDetail } from '@/modules/customers/ui/hooks';

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
  } = useCustomerDetail(customerId ?? null);
  const [showAddContact, setShowAddContact] = useState(false);
  const [contactFirstName, setContactFirstName] = useState('');
  const [contactLastName, setContactLastName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [savingContact, setSavingContact] = useState(false);

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
      : `${detail.first_name ?? ''} ${detail.last_name ?? ''}`.trim();

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
          {detail.vat_number && <p className="text-sm text-ink-muted">TVA : {detail.vat_number}</p>}
        </section>
      )}

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
