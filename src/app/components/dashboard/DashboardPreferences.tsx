import { usePreferences } from '../../contexts/PreferencesContext';

export function DashboardPreferences() {
  const { prefs, update } = usePreferences();

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Préférences</h2>
        <p className="text-sm text-gray-600">Personnalisez votre expérience Magrit.</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Thème</label>
        <select
          value={prefs.theme}
          onChange={(e) => update({ theme: e.target.value as 'light' | 'dark' })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
        >
          <option value="light">Clair</option>
          <option value="dark">Sombre</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Langue</label>
        <select
          value={prefs.language}
          onChange={(e) => update({ language: e.target.value as 'fr' | 'en' })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
        >
          <option value="fr">Français</option>
          <option value="en">English</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Zone de livraison par défaut</label>
        <input
          type="text"
          value={prefs.default_delivery_zone}
          onChange={(e) => update({ default_delivery_zone: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
        />
      </div>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={prefs.notifications_email}
          onChange={(e) => update({ notifications_email: e.target.checked })}
        />
        <span className="text-sm text-gray-700">Recevoir les notifications par email</span>
      </label>
    </div>
  );
}
