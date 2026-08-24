import { SessionApiClient } from '@/modules/session';
import { useTenant } from '@/modules/tenants/ui/runtime';
import { useWorkspaceApi } from '@/platform/runtime/workspace-ui-runtime';
import { canUse, Feature, Plan } from '@/modules/plans/ui/helpers/plans';

export function usePlan() {
  const { currentTenant, reload } = useTenant();
  const sessionApi = useWorkspaceApi(SessionApiClient);
  const plan = currentTenant?.plan ?? 'freemium';
  return {
    plan,
    canUse: (feature: Feature) => canUse(plan, feature),
    setPlan: async (to: Plan) => {
      if (!currentTenant) throw new Error('Aucun espace actif.');
      await sessionApi.updateTenantSettings(currentTenant.id, { plan: to });
      await reload();
    },
  };
}
