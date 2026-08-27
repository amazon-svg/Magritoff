import { describe, expect, it, vi } from 'vitest';
import { handleHopeStudioWorkflow } from '@/server/hopstudio/workflow-handler';

function request(tenantId = 'tenant-1') {
  return new Request(`https://magrit.test/api/v1/tenants/${tenantId}/integrations/hopstudio/workflow`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Request-Id': 'trace-1' },
    body: JSON.stringify({
      hook: 'magrit.workspace.home',
      event: 'callHopesServer',
      provider: 'hopstudio',
      context: {
        tenantId,
        userId: 'user-navigateur',
        method: 'POST',
        body: 'action=loadBasket',
      },
    }),
  });
}

describe('handler du callback HLUX', () => {
  it('utilise l identité serveur pour exécuter le workflow', async () => {
    const execute = vi.fn(async () => ({ status: 'ok', datas: [] }));
    const response = await handleHopeStudioWorkflow(request(), {
      userId: 'user-authentifie',
      async isTenantMember() { return true; },
      gateway: { execute },
    });

    expect(response.status).toBe(200);
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-1',
      userId: 'user-authentifie',
      traceId: 'trace-1',
      body: 'action=loadBasket',
    }));
  });

  it('refuse un tenant hors périmètre avant l appel externe', async () => {
    const execute = vi.fn();
    const response = await handleHopeStudioWorkflow(request('tenant-tierce'), {
      userId: 'user-1',
      async isTenantMember() { return false; },
      gateway: { execute },
    });
    expect(response.status).toBe(403);
    expect(execute).not.toHaveBeenCalled();
  });
});
