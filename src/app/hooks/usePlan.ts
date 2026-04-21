import { usePreferences } from '../contexts/PreferencesContext';
import { canUse, Feature, Plan } from '../utils/plans';

export function usePlan() {
  const { prefs, update } = usePreferences();
  return {
    plan: prefs.plan,
    canUse: (feature: Feature) => canUse(prefs.plan, feature),
    setPlan: (to: Plan) => update({ plan: to }),
  };
}
