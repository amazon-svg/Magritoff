import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Check, Copy, ExternalLink, Loader2, Mail, Plus, RefreshCw, UserRound } from 'lucide-react';
import type { IssueStorefrontActivationResult, ShopCustomerAccount } from '../../../modules/shop-customers';
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
  const [issuingFor, setIssuingFor] = useState<string | null>(null);
  const [activation, setActivation] = useState<IssueStorefrontActivationResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [delegating, setDelegating] = useState(false);

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

  const issueActivation = async (account: ShopCustomerAccount) => {
    setIssuingFor(account.id);
    setActivation(null);
    setCopied(false);
    setError(null);
    try {
      const result = await api.issueActivation(tenantId, shopId, account.id);
      setActivation(result);
    } catch (cause) {
      setError(messageFrom(cause, 'Impossible de générer le lien d’activation.'));
    } finally {
      setIssuingFor(null);
    }
  };

  const copyActivationLink = async () => {
    if (!activation) return;
    try {
      await navigator.clipboard.writeText(activation.link);
      setCopied(true);
    } catch {
      setError('La copie automatique a échoué. Sélectionnez le lien manuellement.');
    }
  };

  const openAsSelf = async () => {
    const storefrontWindow = window.open('about:blank', '_blank');
    if (storefrontWindow) storefrontWindow.opener = null;
    setDelegating(true);
    setError(null);
    try {
      const result = await api.startSelfDelegation(tenantId, shopId, {
        reason: 'Accès depuis l’éditeur de boutique',
      });
      if (storefrontWindow) {
        storefrontWindow.location.replace(result.storefrontPath);
      } else {
        window.location.assign(result.storefrontPath);
      }
    } catch (cause) {
      storefrontWindow?.close();
      setError(messageFrom(cause, 'Impossible d’ouvrir la boutique en mode délégué.'));
    } finally {
      setDelegating(false);
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
            onClick={() => void openAsSelf()}
            disabled={delegating}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-line-2 text-sm font-medium text-ink hover:bg-bg disabled:opacity-50"
          >
            {delegating ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
            Se connecter à la boutique
          </button>
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

      {activation && (
        <div className="m-4 rounded-lg border border-line-2 bg-bg p-3">
          <p className="text-sm font-medium text-ink">
            {activation.sent ? 'Email d’activation envoyé.' : 'Email non envoyé : transmettez ce lien manuellement.'}
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            Ce lien ouvre la page où l’invité choisit son mot de passe. Il ne doit pas essayer de se connecter avant cette activation.
          </p>
          {!activation.sent && activation.reason && (
            <p className="mt-1 text-xs text-ink-muted">{activation.reason}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            <input aria-label="Lien d’activation manuel" readOnly value={activation.link} className="min-w-0 flex-1 rounded-lg border border-line-2 bg-paper px-3 py-2 text-xs text-ink" />
            <button type="button" onClick={() => void copyActivationLink()} className="inline-flex items-center gap-1.5 rounded-lg border border-line-2 bg-paper px-3 py-2 text-sm text-ink-2">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copié' : 'Copier'}
            </button>
            <a
              href={activation.link}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-2 text-sm text-paper"
            >
              <ExternalLink className="h-4 w-4" />
              Ouvrir l’activation
            </a>
          </div>
        </div>
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
              <div className="shrink-0 flex items-center gap-2">
                <span className="rounded-full border border-line px-2.5 py-1 text-xs text-ink-2">
                  {STATUS_LABELS[account.status]}
                </span>
                {(account.status === 'delegated_only' || account.status === 'invited') && (
                  <button
                    type="button"
                    disabled={issuingFor === account.id}
                    onClick={() => void issueActivation(account)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-line-2 px-2.5 py-1.5 text-xs font-medium text-ink-2 disabled:opacity-50"
                  >
                    {issuingFor === account.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                    {account.status === 'invited' ? 'Renvoyer' : 'Inviter'}
                  </button>
                )}
              </div>
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
