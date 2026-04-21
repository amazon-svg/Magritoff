import { useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { usePlan } from '../../hooks/usePlan';
import { ALL_PLANS, PLAN_LABEL, Plan } from '../../utils/plans';

const FEATURES: Record<Plan, string[]> = {
  freemium: [
    'Chat Copilot & devis',
    'Historique de conversations',
    'Fiche clients (CRM)',
  ],
  pro: [
    'Tout le Freemium',
    '📚 Bibliothèque de produits réutilisables',
    '🛍️ Création de boutiques en ligne',
    'Partage via URL privée',
  ],
  enterprise: [
    'Tout le Pro',
    'Boutiques illimitées',
    'Support prioritaire',
    'Fonctions avancées à venir',
  ],
};

const PRICES: Record<Plan, string> = {
  freemium: 'Gratuit',
  pro: '29 €/mois',
  enterprise: 'Sur devis',
};

export function DashboardPlan() {
  const { plan, setPlan } = usePlan();
  const [saving, setSaving] = useState<Plan | null>(null);

  const handleChange = async (to: Plan) => {
    setSaving(to);
    await setPlan(to);
    setSaving(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Plan & abonnement</h2>
        <p className="text-sm text-gray-600">
          Votre plan actuel : <strong>{PLAN_LABEL[plan]}</strong>. Choisissez le plan qui vous correspond.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {ALL_PLANS.map((p) => {
          const isCurrent = plan === p;
          return (
            <div
              key={p}
              className={`border-2 rounded-2xl p-5 flex flex-col ${
                isCurrent ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-bold text-gray-900">{PLAN_LABEL[p]}</h3>
                {isCurrent && (
                  <span className="text-xs font-semibold bg-blue-600 text-white px-2 py-0.5 rounded-full">
                    Actuel
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold text-gray-900 mb-4">{PRICES[p]}</p>
              <ul className="space-y-2 mb-5 flex-1">
                {FEATURES[p].map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                    <Check className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleChange(p)}
                disabled={isCurrent || saving === p}
                className={`w-full px-4 py-2 rounded-lg font-medium text-sm flex items-center justify-center gap-2 ${
                  isCurrent
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-gray-900 text-white hover:bg-gray-800'
                }`}
              >
                {saving === p && <Loader2 className="w-4 h-4 animate-spin" />}
                {isCurrent ? 'Plan actuel' : `Passer à ${PLAN_LABEL[p]}`}
              </button>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-500">
        Les changements de plan sont appliqués immédiatement. Un downgrade désactive les fonctionnalités associées aux plans supérieurs (vos données sont conservées).
      </p>
    </div>
  );
}
