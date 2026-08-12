import type { UserId } from '../../../kernel/ids/index.ts';
import type { ClientGroupDto, ClientPriceRuleDto, CommercialOverview, CreatePriceRule } from '../api/contracts.ts';
export interface CommercialRepository {
  overview(actor: UserId, tenantId: string): Promise<CommercialOverview>;
  createGroup(actor: UserId, tenantId: string, name: string): Promise<ClientGroupDto>;
  removeGroup(actor: UserId, tenantId: string, groupId: string): Promise<void>;
  groupMembers(actor: UserId, tenantId: string, groupId: string): Promise<string[]>;
  setGroupMember(actor: UserId, tenantId: string, groupId: string, userId: string, member: boolean): Promise<void>;
  createRule(actor: UserId, tenantId: string, input: CreatePriceRule): Promise<ClientPriceRuleDto>;
  setRuleActive(actor: UserId, tenantId: string, ruleId: string, active: boolean): Promise<ClientPriceRuleDto>;
  removeRule(actor: UserId, tenantId: string, ruleId: string): Promise<void>;
}
