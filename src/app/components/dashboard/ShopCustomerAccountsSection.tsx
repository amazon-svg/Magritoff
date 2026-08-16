import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Loader2, Plus, RefreshCw, UserRound } from 'lucide-react';
import type { ShopCustomerAccount } from '../../../modules/shop-customers';
import { useShopCustomersApi } from '../../contexts/ModuleClientsContext';

type Props = Readonly<{
  tenantId: string;
  shopId: string;
}>;

const STATUS_LABELS: Record<ShopCustomerAccount['status'], string> = {
  delegated_only: 'Préparé',
  invited: 'Invitation en attente',
  active: 'Actif',
  suspended: 'Suspendu',
};

export function ShopCustomerAccountsSection({ tenantId, shopId }: Props) {
  const api = useShopCustomersApi();
  const [accounts, setAccounts] = useState<ShopCustomerAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setAccounts(await api.list(tenantId, shopId));
    } catch (cause) {
      setError(messageFrom(cause, 'Impossible de charger les comptes boutique.'));
    } finally {
      setLoading(false);
    }
  }, [api, shopId, tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const createAccount = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const account = await api.create(tenantId, shopId, {
        email,
        fullName,
        initialStatus: 'delegated_only',
      });
      setAccounts((current) => [account, ...current]);
      setEmail('');
      setFullName('');
      setShowForm(false);
    } catch (cause) {
      setError(messageFrom(cause, 'Impossible de créer ce compte boutique.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="border border-line rounded-xl bg-paper overflow-hidden">
      <div className="p-4 flex flex-wrap items-start justify-between gap-3 border-b border-line">
        <div>
          <h3 className="font-semibold text-ink flex items-center gap-2">
            <UserRound className="w-5 h-5" strokeWidth={1.5} />
            Comptes clients de cette boutique
          </h3>
          <p className="text-xs text-ink-muted mt-1 max-w-2xl">
            Ces comptes sont propres à cette boutique et ne sont pas des utilisateurs Magrit.
            Une même adresse utilisée dans une autre boutique créera un autre compte.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-line-2 text-sm text-ink-2 hover:bg-bg disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
          <button
            type="button"
            onClick={() => setShowForm((visible) => !visible)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-ink text-paper text-sm hover:opacity-90"
          >
            <Plus className="w-4 h-4" />
            Créer un compte
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={createAccount} className="p-4 grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 border-b border-line bg-bg/50">
          <label className="text-xs font-medium text-ink-2">
            Nom complet
            <input
              required
              maxLength={200}
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              className="mt-1 w-full px-3 py-2 border border-line-2 rounded-lg bg-paper text-sm"
            />
          </label>
          <label className="text-xs font-medium text-ink-2">
            Email dans cette boutique
            <input
              required
              type="email"
              maxLength={320}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full px-3 py-2 border border-line-2 rounded-lg bg-paper text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={saving}
            className="self-end inline-flex justify-center items-center gap-1.5 px-4 py-2 rounded-lg bg-ink text-paper text-sm disabled:opacity-50"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Créer
          </button>
          <p className="md:col-span-3 text-xs text-ink-muted m-0">
            Cette étape prépare uniquement le compte métier. Aucun email, mot de passe ou
            accès storefront n’est encore créé.
          </p>
        </form>
      )}

      {error && (
        <p role="alert" className="m-4 rounded-lg border border-err-fg/20 bg-err-bg px-3 py-2 text-sm text-err-fg">
          {error}
        </p>
      )}

      {loading ? (
        <div className="p-8 grid place-items-center text-ink-muted">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : accounts.length === 0 ? (
        <p className="p-6 text-sm text-ink-muted text-center">
          Aucun compte client n’est encore rattaché à cette boutique.
        </p>
      ) : (
        <div className="divide-y divide-line">
          {accounts.map((account) => (
            <div key={account.id} className="px-4 py-3 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink truncate">{account.fullName}</p>
                <p className="text-xs text-ink-muted truncate">{account.email}</p>
              </div>
              <span className="shrink-0 rounded-full border border-line px-2.5 py-1 text-xs text-ink-2">
                {STATUS_LABELS[account.status]}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function messageFrom(cause: unknown, fallback: string): string {
  return cause instanceof Error && cause.message ? cause.message : fallback;
}
