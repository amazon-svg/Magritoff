/**
 * REFONTE-UX (2026-08-08) — Mon compte : fusion Profil + Preferences.
 *
 * Demande Arnaud (points 3 et 4 de la refonte tableau de bord) : Profil et
 * Preferences etaient deux entrees esseulees de la nav ; elles deviennent une
 * seule page rangee dans le groupe Parametres.
 *
 * Style : charte Magrit v2 (.design-handoff) — tokens ink/paper/line/brand,
 * composants sobres, pas de gray-* ad hoc.
 */
import { useState } from 'react';
import { Loader2, User, SlidersHorizontal } from 'lucide-react';
import { supabase } from '/utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { usePreferences } from '../../contexts/PreferencesContext';
import { TEST_IDS } from '../../lib/testIds';

const inputCls =
  'w-full px-3 py-2 border border-line-2 rounded-lg bg-paper text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand';
const labelCls = 'block text-sm font-medium text-ink-2 mb-1';

export function DashboardAccount() {
  const { user } = useAuth();
  const { prefs, update } = usePreferences();
  const [fullName, setFullName] = useState<string>((user?.user_metadata?.full_name as string) ?? '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    const { error } = await supabase.auth.updateUser({ data: { full_name: fullName } });
    setSaving(false);
    setMessage(error ? `Erreur : ${error.message}` : 'Profil mis à jour.');
  };

  return (
    <div data-testid={TEST_IDS.dashboard.welcomeCard} className="space-y-8 max-w-xl">
      <div>
        <h2 className="text-lg font-medium text-ink mb-1" style={{ letterSpacing: '-0.015em' }}>
          Mon compte
        </h2>
        <p className="text-sm text-ink-muted">
          Vos informations personnelles et vos préférences d'utilisation.
        </p>
      </div>

      {/* ── Profil ── */}
      <section className="border border-line rounded-xl p-5 bg-paper space-y-4">
        <h3 className="font-medium text-ink flex items-center gap-2">
          <User className="w-4 h-4" strokeWidth={1.5} />
          Profil
        </h3>
        <div>
          <label className={labelCls}>Email</label>
          <input
            type="email"
            value={user?.email ?? ''}
            disabled
            className="w-full px-3 py-2 border border-line rounded-lg bg-bg text-ink-muted text-sm"
          />
        </div>
        <div>
          <label className={labelCls}>Nom complet</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className={inputCls}
          />
        </div>
        {message && (
          <p className={`text-sm ${message.startsWith('Erreur') ? 'text-err-fg' : 'text-ok-fg'}`}>
            {message}
          </p>
        )}
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-2 bg-brand text-brand-ink rounded-lg hover:opacity-90 disabled:opacity-50 text-sm font-medium flex items-center gap-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Enregistrer
        </button>
      </section>

      {/* ── Preferences ── */}
      <section className="border border-line rounded-xl p-5 bg-paper space-y-4">
        <h3 className="font-medium text-ink flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4" strokeWidth={1.5} />
          Préférences
        </h3>
        <div>
          <label className={labelCls}>Thème</label>
          <select
            value={prefs.theme}
            onChange={(e) => update({ theme: e.target.value as 'light' | 'dark' })}
            className={inputCls}
          >
            <option value="light">Clair</option>
            <option value="dark">Sombre</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Langue</label>
          <select
            value={prefs.language}
            onChange={(e) => update({ language: e.target.value as 'fr' | 'en' })}
            className={inputCls}
          >
            <option value="fr">Français</option>
            <option value="en">English</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Zone de livraison par défaut</label>
          <input
            type="text"
            value={prefs.default_delivery_zone}
            onChange={(e) => update({ default_delivery_zone: e.target.value })}
            className={inputCls}
          />
        </div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={prefs.notifications_email}
            onChange={(e) => update({ notifications_email: e.target.checked })}
          />
          <span className="text-sm text-ink-2">Recevoir les notifications par email</span>
        </label>
      </section>
    </div>
  );
}
