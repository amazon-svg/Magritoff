import { API_V1_BASE_PATH, FetchApiClient } from '../../../platform/api/index.ts';
import { clientGroupSchema, clientPriceRuleSchema, commercialOverviewSchema, commercialRemovedSchema, commercialUpdatedSchema, createClientGroupSchema, createPriceRuleSchema, groupMembersSchema, setRuleActiveSchema, type CommercialOverview, type CreatePriceRule } from './contracts.ts';

export class CommercialApiClient {
  constructor(private readonly client: FetchApiClient) {}
  overview(tenantId: string): Promise<CommercialOverview> {
    return this.client.request({ path: `${API_V1_BASE_PATH}/tenants/${tenantId}/commercial`, responseSchema: commercialOverviewSchema });
  }
  createGroup(tenantId: string, name: string) { return this.client.request({ method: 'POST', path: `${this.base(tenantId)}/groups`, body: createClientGroupSchema.parse({ name }), responseSchema: clientGroupSchema }); }
  removeGroup(tenantId: string, groupId: string): Promise<void> { return this.client.request({ method: 'DELETE', path: `${this.base(tenantId)}/groups/${groupId}`, responseSchema: commercialRemovedSchema }).then(() => undefined); }
  groupMembers(tenantId: string, groupId: string): Promise<string[]> { return this.client.request({ path: `${this.base(tenantId)}/groups/${groupId}/members`, responseSchema: groupMembersSchema }); }
  setGroupMember(tenantId: string, groupId: string, userId: string, member: boolean): Promise<void> { return this.client.request({ method: member ? 'PUT' : 'DELETE', path: `${this.base(tenantId)}/groups/${groupId}/members/${userId}`, responseSchema: commercialUpdatedSchema }).then(() => undefined); }
  createRule(tenantId: string, input: CreatePriceRule) { return this.client.request({ method: 'POST', path: `${this.base(tenantId)}/rules`, body: createPriceRuleSchema.parse(input), responseSchema: clientPriceRuleSchema }); }
  setRuleActive(tenantId: string, ruleId: string, active: boolean) { return this.client.request({ method: 'PATCH', path: `${this.base(tenantId)}/rules/${ruleId}`, body: setRuleActiveSchema.parse({ active }), responseSchema: clientPriceRuleSchema }); }
  removeRule(tenantId: string, ruleId: string): Promise<void> { return this.client.request({ method: 'DELETE', path: `${this.base(tenantId)}/rules/${ruleId}`, responseSchema: commercialRemovedSchema }).then(() => undefined); }
  private base(tenantId: string) { return `${API_V1_BASE_PATH}/tenants/${tenantId}/commercial`; }
}
