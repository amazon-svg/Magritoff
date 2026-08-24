export type NotifyPolicy = 'chain_next' | 'all_roles' | 'none';
export type RoleScope = 'tenant' | 'shop';

export interface TenantRoleDefinition {
  id: string;
  tenant_id: string;
  name: string;
  description: string;
  capabilities: Record<string, boolean>;
  notify_policy: NotifyPolicy;
  scope: RoleScope;
  scope_shop_id: string | null;
  ordering_index: number;
  archived_at: string | null;
}

export interface RoleAssignmentView {
  role_definition_id: string;
  user_id: string;
  user_email: string | null;
}
