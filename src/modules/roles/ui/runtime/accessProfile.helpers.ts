import type { UserAccessProfile } from '@/modules/roles';

const WORKSPACE_CAPABILITY_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  'shops.manage': 'can_manage_shops',
  'orders.read.tenant': 'can_validate',
  'orders.transition': 'can_modify',
});

const MEMBER_QUOTE_FOUNDATION = new Set([
  'account.self.manage',
  'quotes.read.tenant',
  'quotes.validate',
  'quotes.manage',
]);

export function normalizeWorkspaceCapability(capability: string): string {
  return WORKSPACE_CAPABILITY_ALIASES[capability] ?? capability;
}

export function resolveCapability(
  profile: UserAccessProfile | null,
  loading: boolean,
  isSuperAdmin: boolean,
  capability: string,
): boolean | null {
  if (isSuperAdmin) return true;
  if (loading) return null;
  if (!profile) return false;
  if (profile.isAdmin) return true;
  if (MEMBER_QUOTE_FOUNDATION.has(capability)) return true;
  return profile.capabilities.includes(normalizeWorkspaceCapability(capability));
}
