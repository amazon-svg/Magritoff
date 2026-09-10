import { describe, expect, it, vi } from 'vitest';
import { ResendEmailDeliveryStatusGateway } from '@/adapters/resend/resend-email-delivery-status-gateway';

describe('ResendEmailDeliveryStatusGateway', () => {
  it('rend null sans accès réseau lorsque RESEND_API_KEY est absente', async () => {
    const fetchMock = vi.fn();
    const gateway = new ResendEmailDeliveryStatusGateway(null, fetchMock as typeof fetch);
    await expect(gateway.fetchStatus('msg-1')).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rend null (jamais une exception) quand Resend répond en erreur', async () => {
    const fetchMock = vi.fn(async () => new Response('not found', { status: 404 }));
    const gateway = new ResendEmailDeliveryStatusGateway('secret', fetchMock as typeof fetch);
    await expect(gateway.fetchStatus('msg-1')).resolves.toBeNull();
  });

  it('rend null (jamais une exception) quand fetch rejette (Resend injoignable)', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('network down');
    });
    const gateway = new ResendEmailDeliveryStatusGateway('secret', fetchMock as typeof fetch);
    await expect(gateway.fetchStatus('msg-1')).resolves.toBeNull();
  });

  it("remonte last_event TEL QUEL, sans interpretation (c est PurgeSweepService qui decide)", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ last_event: 'delivered' }), { status: 200 }));
    const gateway = new ResendEmailDeliveryStatusGateway('secret', fetchMock as typeof fetch);
    await expect(gateway.fetchStatus('msg-1')).resolves.toEqual({ lastEvent: 'delivered' });

    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toBe('https://api.resend.com/emails/msg-1');
  });

  it('lastEvent null si le champ est absent ou non exploitable (defensif)', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    const gateway = new ResendEmailDeliveryStatusGateway('secret', fetchMock as typeof fetch);
    await expect(gateway.fetchStatus('msg-1')).resolves.toEqual({ lastEvent: null });
  });

  it('encode l identifiant de message dans le chemin', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ last_event: 'sent' }), { status: 200 }));
    const gateway = new ResendEmailDeliveryStatusGateway('secret', fetchMock as typeof fetch);
    await gateway.fetchStatus('msg with space');
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('https://api.resend.com/emails/msg%20with%20space');
  });
});
