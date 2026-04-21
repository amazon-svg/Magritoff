export type Plan = 'freemium' | 'pro' | 'enterprise';

const ORDER: Record<Plan, number> = {
  freemium: 0,
  pro: 1,
  enterprise: 2,
};

export const PLAN_LABEL: Record<Plan, string> = {
  freemium: 'Freemium',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

// Plan minimum requis par fonctionnalité.
export const FEATURE_MIN_PLAN = {
  library: 'pro' as Plan,
  shops: 'pro' as Plan,
} as const;

export type Feature = keyof typeof FEATURE_MIN_PLAN;

export function atLeast(plan: Plan, required: Plan): boolean {
  return ORDER[plan] >= ORDER[required];
}

export function canUse(plan: Plan, feature: Feature): boolean {
  return atLeast(plan, FEATURE_MIN_PLAN[feature]);
}

export const ALL_PLANS: Plan[] = ['freemium', 'pro', 'enterprise'];
