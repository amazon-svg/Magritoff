import type { UserId } from '../../../kernel/ids/index.ts';
import type { CreatePriceRule } from '../api/contracts.ts';
import type { CommercialRepository } from './commercial-repository.ts';
export class CommercialService {
  constructor(private readonly repository: CommercialRepository) {}
  overview(actor: UserId, tenantId: string) { return this.repository.overview(actor, tenantId); }
  createGroup(actor: UserId, tenantId: string, name: string) { return this.repository.createGroup(actor, tenantId, name); }
  async removeGroup(actor: UserId, tenantId: string, groupId: string) { await this.repository.removeGroup(actor, tenantId, groupId); return { removed: true as const }; }
  groupMembers(actor: UserId, tenantId: string, groupId: string) { return this.repository.groupMembers(actor, tenantId, groupId); }
  async setGroupMember(actor: UserId, tenantId: string, groupId: string, userId: string, member: boolean) { await this.repository.setGroupMember(actor, tenantId, groupId, userId, member); return { updated: true as const }; }
  createRule(actor: UserId, tenantId: string, input: CreatePriceRule) { return this.repository.createRule(actor, tenantId, input); }
  setRuleActive(actor: UserId, tenantId: string, ruleId: string, active: boolean) { return this.repository.setRuleActive(actor, tenantId, ruleId, active); }
  async removeRule(actor: UserId, tenantId: string, ruleId: string) { await this.repository.removeRule(actor, tenantId, ruleId); return { removed: true as const }; }
}
