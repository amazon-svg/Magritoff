import { describe, expect, it, vi } from 'vitest';
import { ResendInvitationEmailSender } from '@/adapters/resend/invitation-email-sender';

const message = {
  to: 'buyer@example.com', tenantName: 'Imprimerie Test', role: 'member' as const,
  link: 'http://localhost:5176/invitations/token', expiresAt: '2026-08-25T12:00:00.000Z',
};

describe('ResendInvitationEmailSender', () => {
  it('retourne un lien manuel sans appeler le réseau si la clé manque', async () => {
    const fetchMock = vi.fn();
    const sender = new ResendInvitationEmailSender(null, 'Magrit <test@example.com>', fetchMock as typeof fetch);
    await expect(sender.send(message)).resolves.toMatchObject({ sent: false, reason: expect.stringContaining('RESEND_API_KEY') });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('envoie directement à Resend avec le contenu de l’invitation', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    const sender = new ResendInvitationEmailSender('secret', 'Magrit <test@example.com>', fetchMock as typeof fetch);
    await expect(sender.send(message)).resolves.toEqual({ sent: true });
    expect(fetchMock).toHaveBeenCalledWith('https://api.resend.com/emails', expect.objectContaining({ method: 'POST' }));
    const payload = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(payload.to).toEqual(['buyer@example.com']);
    expect(payload.html).toContain(message.link);
  });
});
