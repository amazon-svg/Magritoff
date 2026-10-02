import { describe, expect, it, vi } from 'vitest';
import { ResendEmailVerificationSender } from '../../../src/adapters/resend/email-verification-sender.ts';

const message = {
  to: 'user@example.test',
  displayName: 'Camille',
  link: 'https://app.example.test/api/v1/auth/verify-email?token=verification',
};

describe('ResendEmailVerificationSender', () => {
  it('échoue explicitement sans clé', async () => {
    const fetchMock = vi.fn();
    const sender = new ResendEmailVerificationSender(
      null,
      'Magrit <test@example.test>',
      fetchMock as typeof fetch,
    );

    await expect(sender.send(message)).resolves.toMatchObject({
      sent: false,
      reason: expect.stringContaining('RESEND_API_KEY'),
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('envoie le lien de vérification via Resend', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    const sender = new ResendEmailVerificationSender(
      'secret',
      'Magrit <test@example.test>',
      fetchMock as typeof fetch,
    );

    await expect(sender.send(message)).resolves.toEqual({ sent: true });
    const payload = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(payload.to).toEqual([message.to]);
    expect(payload.text).toContain(message.link);
  });
});
