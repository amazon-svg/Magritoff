import { describe, expect, it } from 'vitest';
import { SmtpInvitationEmailSender } from '../../src/adapters/smtp/invitation-email-sender.ts';
import { SmtpNotificationEmailSender } from '../../src/adapters/smtp/notification-email-sender.ts';
import { SmtpPasswordResetEmailSender } from '../../src/adapters/smtp/password-reset-email-sender.ts';
import { SmtpStorefrontActivationEmailSender } from '../../src/adapters/smtp/storefront-activation-email-sender.ts';
import { SmtpStorefrontPasswordRecoveryEmailSender } from '../../src/adapters/smtp/storefront-password-recovery-email-sender.ts';
import { SmtpTransport } from '../../src/adapters/smtp/transport.ts';

const enabled = process.env['MAGRIT_SMTP_INTEGRATION'] === '1';

(enabled ? describe : describe.skip)('adaptateurs SMTP — Mailpit réel', () => {
  it('livre invitations et récupération au serveur SMTP local', async () => {
    const transport = new SmtpTransport({ host: '127.0.0.1', port: 51025, secure: false });
    const from = 'Magrit <noreply@magrit.local>';
    const invitation = new SmtpInvitationEmailSender(transport, from);
    const password = new SmtpPasswordResetEmailSender(transport, from);
    const storefrontActivation = new SmtpStorefrontActivationEmailSender(transport, from);
    const storefrontRecovery = new SmtpStorefrontPasswordRecoveryEmailSender(transport, from);
    const notification = new SmtpNotificationEmailSender(transport, from);
    await expect(invitation.send({
      to: 'invitation@magrit.local', tenantName: 'Atelier local', role: 'member',
      link: 'http://127.0.0.1:5176/invitations/test', expiresAt: '2026-10-14T00:00:00.000Z',
    })).resolves.toEqual({ sent: true });
    await expect(password.send({
      to: 'recovery@magrit.local', displayName: 'Compte local',
      link: 'http://127.0.0.1:5176/reset-password?token=test',
    })).resolves.toEqual({ sent: true });
    await expect(storefrontActivation.send({
      to: 'activation-boutique@magrit.local', customerName: 'Client local', shopName: 'Boutique locale',
      link: 'http://127.0.0.1:5176/shop/locale/activate?token=test', expiresInSeconds: 3600,
    })).resolves.toEqual({ sent: true });
    await expect(storefrontRecovery.send({
      to: 'recovery-boutique@magrit.local', customerName: 'Client local', shopName: 'Boutique locale',
      link: 'http://127.0.0.1:5176/shop/locale/reset-password?token=test',
    })).resolves.toBeUndefined();
    await expect(notification.send({
      channel: 'email', to: 'orders@magrit.local', subject: 'Commande locale',
      body: 'Une commande locale attend votre validation.',
    })).resolves.toEqual({ sent: true });
  });
});
