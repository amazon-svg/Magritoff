import { usePreferences } from '@/modules/account/ui/preferences';
import { canUse, Feature, Plan } from '@/modules/plans/ui/helpers/plans';

export function usePlan() {
  const { prefs, update } = usePreferences();
  return {
    plan: prefs.plan,
    canUse: (feature: Feature) => canUse(prefs.plan, feature),
    setPlan: (to: Plan) => update({ plan: to }),
  };
}
