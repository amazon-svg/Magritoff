import { describe, expect, it } from 'vitest';
import { readLocalAuthenticationConfiguration } from '../../../src/server/auth/local-authentication.ts';

describe('configuration de l authentification locale', () => {
  it('reste desactivee sans configuration', () => {
    expect(readLocalAuthenticationConfiguration({})).toBeNull();
  });

  it('refuse une configuration partielle ou un secret faible', () => {
    expect(() => readLocalAuthenticationConfiguration({
      APP_BASE_URL: 'http://127.0.0.1:5176',
    })).toThrow(/MAGRIT_AUTH_SECRET/);
    expect(() => readLocalAuthenticationConfiguration({
      APP_BASE_URL: 'http://127.0.0.1:5176',
      MAGRIT_AUTH_SECRET: 'trop-court',
    })).toThrow(/32 caracteres/);
  });

  it('autorise HTTP uniquement en local et normalise l URL', () => {
    const secret = 'a'.repeat(32);
    expect(readLocalAuthenticationConfiguration({
      APP_BASE_URL: 'http://localhost:5176/',
      MAGRIT_AUTH_SECRET: secret,
    })).toEqual({ baseUrl: 'http://localhost:5176', secret });
    expect(() => readLocalAuthenticationConfiguration({
      APP_BASE_URL: 'http://magrit.example',
      MAGRIT_AUTH_SECRET: secret,
    })).toThrow(/HTTPS/);
  });
});
