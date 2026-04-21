import { usePreferences } from '../contexts/PreferencesContext';

export function useIsAdmin(): boolean {
  const { prefs } = usePreferences();
  return prefs.is_admin === true;
}
