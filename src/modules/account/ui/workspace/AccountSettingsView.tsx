import { Loader2, SlidersHorizontal, User } from 'lucide-react';
import { TEST_IDS } from '@/shared/presentation/testIds';

export type AccountPreferencesViewModel = Readonly<{
  theme: 'light' | 'dark';
  language: 'fr' | 'en';
  defaultDeliveryZone: string;
  notificationsEmail: boolean;
}>;

export type AccountSettingsViewProps = Readonly<{
  email: string;
  fullName: string;
  saving: boolean;
  message: string | null;
  preferences: AccountPreferencesViewModel;
  onFullNameChange(value: string): void;
  onSaveProfile(): void;
  onThemeChange(value: 'light' | 'dark'): void;
  onLanguageChange(value: 'fr' | 'en'): void;
  onDeliveryZoneChange(value: string): void;
  onNotificationsEmailChange(value: boolean): void;
}>;

const inputCls =
  'w-full px-3 py-2 border border-line-2 rounded-lg bg-paper text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand';
const labelCls = 'block text-sm font-medium text-ink-2 mb-1';

export function AccountSettingsView(props: AccountSettingsViewProps) {
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

      <section className="border border-line rounded-xl p-5 bg-paper space-y-4">
        <h3 className="font-medium text-ink flex items-center gap-2">
          <User className="w-4 h-4" strokeWidth={1.5} />
          Profil
        </h3>
        <div>
          <label className={labelCls}>Email</label>
          <input
            type="email"
            value={props.email}
            disabled
            className="w-full px-3 py-2 border border-line rounded-lg bg-bg text-ink-muted text-sm"
          />
        </div>
        <div>
          <label className={labelCls}>Nom complet</label>
          <input
            type="text"
            value={props.fullName}
            onChange={(event) => props.onFullNameChange(event.target.value)}
            className={inputCls}
          />
        </div>
        {props.message && (
          <p className={`text-sm ${props.message.startsWith('Erreur') ? 'text-err-fg' : 'text-ok-fg'}`}>
            {props.message}
          </p>
        )}
        <button
          onClick={props.onSaveProfile}
          disabled={props.saving}
          className="px-4 py-2 bg-brand text-brand-ink rounded-lg hover:opacity-90 disabled:opacity-50 text-sm font-medium flex items-center gap-2"
        >
          {props.saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Enregistrer
        </button>
      </section>

      <section className="border border-line rounded-xl p-5 bg-paper space-y-4">
        <h3 className="font-medium text-ink flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4" strokeWidth={1.5} />
          Préférences
        </h3>
        <div>
          <label className={labelCls}>Thème</label>
          <select
            value={props.preferences.theme}
            onChange={(event) => props.onThemeChange(event.target.value as 'light' | 'dark')}
            className={inputCls}
          >
            <option value="light">Clair</option>
            <option value="dark">Sombre</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Langue</label>
          <select
            value={props.preferences.language}
            onChange={(event) => props.onLanguageChange(event.target.value as 'fr' | 'en')}
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
            value={props.preferences.defaultDeliveryZone}
            onChange={(event) => props.onDeliveryZoneChange(event.target.value)}
            className={inputCls}
          />
        </div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={props.preferences.notificationsEmail}
            onChange={(event) => props.onNotificationsEmailChange(event.target.checked)}
          />
          <span className="text-sm text-ink-2">Recevoir les notifications par email</span>
        </label>
      </section>
    </div>
  );
}
