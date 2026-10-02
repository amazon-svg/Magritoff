import { describe, expect, it } from 'vitest';
import { readSmtpConfiguration } from '../../../src/adapters/smtp/transport.ts';

describe('configuration SMTP', () => {
  it('reste inactive sans variables et accepte Mailpit local', () => {
    expect(readSmtpConfiguration({})).toBeNull();
    expect(readSmtpConfiguration({ MAIL_HOST: '127.0.0.1', MAIL_PORT: '51025' }))
      .toEqual({ host: '127.0.0.1', port: 51025, secure: false });
  });

  it('refuse les configurations partielles ou ambiguës', () => {
    expect(() => readSmtpConfiguration({ MAIL_HOST: 'smtp.example.test' })).toThrow(/MAIL_PORT/);
    expect(() => readSmtpConfiguration({ MAIL_HOST: 'smtp.example.test', MAIL_PORT: '0' }))
      .toThrow(/port TCP/);
    expect(() => readSmtpConfiguration({
      MAIL_HOST: 'smtp.example.test', MAIL_PORT: '587', MAIL_USER: 'magrit',
    })).toThrow(/MAIL_PASSWORD/);
    expect(() => readSmtpConfiguration({
      MAIL_HOST: 'smtp.example.test', MAIL_PORT: '587', MAIL_SECURE: 'maybe',
    })).toThrow(/MAIL_SECURE/);
  });
});
