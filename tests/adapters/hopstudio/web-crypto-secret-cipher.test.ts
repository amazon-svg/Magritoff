import { describe, expect, it } from 'vitest';
import { WebCryptoHopeStudioSecretCipher } from '@/adapters/hopstudio/web-crypto-secret-cipher';

const key = '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f';

describe('WebCryptoHopeStudioSecretCipher', () => {
  it('chiffre puis déchiffre un secret pour le même tenant', async () => {
    const cipher = new WebCryptoHopeStudioSecretCipher(key);
    const payload = await cipher.encrypt('mot-de-passe', 'tenant-1');

    expect(payload).toMatch(/^v1\./);
    expect(payload).not.toContain('mot-de-passe');
    await expect(cipher.decrypt(payload, 'tenant-1')).resolves.toBe('mot-de-passe');
  });

  it('interdit de déchiffrer le secret sous un autre tenant', async () => {
    const cipher = new WebCryptoHopeStudioSecretCipher(key);
    const payload = await cipher.encrypt('mot-de-passe', 'tenant-1');
    await expect(cipher.decrypt(payload, 'tenant-2')).rejects.toMatchObject({
      code: 'encryption_unavailable',
    });
  });

  it('refuse une clé absente', async () => {
    const cipher = new WebCryptoHopeStudioSecretCipher(null);
    await expect(cipher.encrypt('secret', 'tenant-1')).rejects.toMatchObject({
      code: 'encryption_unavailable',
    });
  });
});
