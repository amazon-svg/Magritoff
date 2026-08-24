import { usePreferences } from '@/modules/account/ui/preferences';

export function useIsAdmin(): boolean {
  const { prefs } = usePreferences();
  return prefs.is_admin === true;
}
