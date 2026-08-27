import { useEffect, useState, type FormEvent } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useWorkspaceApi, useWorkspaceUiRuntime } from '@/platform/runtime/workspace-ui-runtime';
import { HopeStudioApiClient } from '@/modules/hopstudio/api/client';
import type { HopeStudioTenantSettings } from '@/modules/hopstudio/api/tenant-settings';

type FormState = Readonly<{
  enabled: boolean;
  hopeStudioUrl: string;
  clariprintUser: string;
  clariprintPassword: string;
  clariprintUrl: string;
  passwordConfigured: boolean;
}>;

const EMPTY_FORM: FormState = {
  enabled: false,
  hopeStudioUrl: '',
  clariprintUser: '',
  clariprintPassword: '',
  clariprintUrl: '',
  passwordConfigured: false,
};

export function ClariprintStudioSettingsPage() {
  const api = useWorkspaceApi(HopeStudioApiClient);
  const { tenant } = useWorkspaceUiRuntime();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!tenant) return;
    const controller = new AbortController();
    setLoading(true);
    setMessage(null);
    api.getTenantSettings(tenant.id, controller.signal)
      .then((settings) => setForm(toForm(settings)))
      .catch((error) => {
        if ((error as Error).name !== 'AbortError') {
          setMessage({
            kind: 'error',
            text: error instanceof Error ? error.message : 'Configuration Clariprint Studio indisponible.',
          });
        }
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [api, tenant?.id]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!tenant) return;
    setSaving(true);
    setMessage(null);
    try {
      await api.updateTenantSettings(tenant.id, {
        enabled: form.enabled,
        hopeStudioUrl: nullable(form.hopeStudioUrl),
        clariprintUser: nullable(form.clariprintUser),
        clariprintUrl: nullable(form.clariprintUrl),
        ...(form.clariprintPassword ? { clariprintPassword: form.clariprintPassword } : {}),
      });
      setForm((current) => ({
        ...current,
        clariprintPassword: '',
        passwordConfigured: current.passwordConfigured || Boolean(current.clariprintPassword),
      }));
      setMessage({ kind: 'ok', text: 'Configuration Clariprint Studio enregistrée.' });
    } catch (error) {
      setMessage({
        kind: 'error',
        text: error instanceof Error ? error.message : 'Enregistrement impossible.',
      });
    } finally {
      setSaving(false);
    }
  };

  if (!tenant) return <p className="text-sm text-ink-muted">Aucun tenant actif.</p>;

  return (
    <form onSubmit={submit} className="max-w-2xl space-y-6" data-testid="clariprint-studio-settings">
      <div>
        <h2 className="text-xl font-semibold text-ink">Clariprint Studio</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Configurez la connexion utilisée pour ce tenant. Les identifiants sont transmis uniquement
          par le backend aux serveurs HopeStudio.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-ink-muted">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement de la configuration…
        </div>
      ) : (
        <>
          <section className="space-y-4 rounded-lg border border-line bg-paper p-5">
            <label className="flex items-center justify-between gap-4">
              <span>
                <span className="block text-sm font-medium text-ink">Activer Clariprint Studio</span>
                <span className="block text-xs text-ink-muted">Utiliser cette connexion pour le tenant actif.</span>
              </span>
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(event) => update('enabled', event.target.checked)}
                className="h-4 w-4"
              />
            </label>

            <TextField
              label="URL du serveur HopeStudio"
              type="url"
              placeholder="https://hopstudio.example.com/json.wcl"
              value={form.hopeStudioUrl}
              onChange={(value) => update('hopeStudioUrl', value)}
              optional
            />
          </section>

          <section className="space-y-4 rounded-lg border border-line bg-paper p-5">
            <div>
              <h3 className="text-sm font-semibold text-ink">Connexion Clariprint</h3>
              <p className="mt-1 text-xs text-ink-muted">
                Si l’identifiant et le mot de passe sont renseignés, ils alimentent les en-têtes
                HTTP X-CLARIPRINT-USER et X-CLARIPRINT-PASS. L’URL ajoute X-CLARIPRINT-URL.
              </p>
            </div>
            <TextField
              label="Identifiant"
              value={form.clariprintUser}
              onChange={(value) => update('clariprintUser', value)}
              autoComplete="off"
              optional
            />
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-muted" htmlFor="clariprint-studio-password">
                Mot de passe <span className="font-normal">(optionnel)</span>
              </label>
              <div className="flex rounded-md border border-line bg-white focus-within:border-line-2">
                <input
                  id="clariprint-studio-password"
                  type={showPassword ? 'text' : 'password'}
                  value={form.clariprintPassword}
                  onChange={(event) => update('clariprintPassword', event.target.value)}
                  placeholder={form.passwordConfigured ? 'Laisser vide pour conserver le mot de passe' : 'Mot de passe Clariprint'}
                  autoComplete="new-password"
                  className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-ink outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="px-3 text-ink-muted"
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {form.passwordConfigured && (
                <p className="mt-1 text-xs text-green-700">Un mot de passe est actuellement configuré.</p>
              )}
            </div>
            <TextField
              label="URL Clariprint"
              type="url"
              placeholder="https://clariprint.example.com/json.wcl"
              value={form.clariprintUrl}
              onChange={(value) => update('clariprintUrl', value)}
              optional
            />
          </section>

          {message && (
            <p className={`text-sm ${message.kind === 'ok' ? 'text-green-700' : 'text-red-700'}`} role="alert">
              {message.text}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper disabled:opacity-40"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Enregistrer
          </button>
        </>
      )}
    </form>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  optional = false,
  autoComplete,
}: Readonly<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'url';
  placeholder?: string;
  optional?: boolean;
  autoComplete?: string;
}>) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink-muted">
        {label}{optional && <span className="ml-1 font-normal">(optionnelle)</span>}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-line-2"
      />
    </label>
  );
}

function nullable(value: string): string | null {
  const trimmed = value.trim();
  return trimmed || null;
}

function toForm(settings: HopeStudioTenantSettings): FormState {
  return {
    enabled: settings.enabled,
    hopeStudioUrl: settings.hopeStudioUrl ?? '',
    clariprintUser: settings.clariprintUser ?? '',
    clariprintPassword: '',
    clariprintUrl: settings.clariprintUrl ?? '',
    passwordConfigured: settings.clariprintPasswordConfigured,
  };
}
