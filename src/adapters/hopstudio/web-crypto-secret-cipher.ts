import { HopeStudioSettingsRejectedError } from '../../modules/hopstudio/application/hopstudio-tenant-settings-service.ts';

export interface HopeStudioSecretCipher {
  encrypt(plainText: string, tenantId: string): Promise<string>;
  decrypt(payload: string, tenantId: string): Promise<string>;
}

const VERSION = 'v1';

/** Chiffrement AES-256-GCM ; l identifiant tenant est authentifié comme AAD. */
export class WebCryptoHopeStudioSecretCipher implements HopeStudioSecretCipher {
  private keyPromise: Promise<CryptoKey> | null = null;

  constructor(private readonly encodedKey: string | null) {}

  async encrypt(plainText: string, tenantId: string): Promise<string> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: buffer(iv), additionalData: buffer(text(tenantId)) },
      await this.key(),
      buffer(text(plainText)),
    );
    return `${VERSION}.${base64Url(iv)}.${base64Url(new Uint8Array(encrypted))}`;
  }

  async decrypt(payload: string, tenantId: string): Promise<string> {
    const [version, encodedIv, encodedCiphertext] = payload.split('.');
    if (version !== VERSION || !encodedIv || !encodedCiphertext) {
      throw unavailable('Le format du secret Clariprint stocké est invalide.');
    }
    try {
      const decrypted = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: buffer(fromBase64Url(encodedIv)),
          additionalData: buffer(text(tenantId)),
        },
        await this.key(),
        buffer(fromBase64Url(encodedCiphertext)),
      );
      return new TextDecoder().decode(decrypted);
    } catch (error) {
      if (error instanceof HopeStudioSettingsRejectedError) throw error;
      throw unavailable('Le secret Clariprint ne peut pas être déchiffré.');
    }
  }

  private key(): Promise<CryptoKey> {
    if (!this.keyPromise) this.keyPromise = importKey(this.encodedKey);
    return this.keyPromise;
  }
}

async function importKey(encodedKey: string | null): Promise<CryptoKey> {
  if (!encodedKey) {
    throw unavailable('HOPSTUDIO_CONFIG_ENCRYPTION_KEY n est pas configurée côté serveur.');
  }
  let bytes: Uint8Array;
  try {
    bytes = /^[0-9a-f]{64}$/i.test(encodedKey)
      ? Uint8Array.from(encodedKey.match(/.{2}/g) ?? [], (value) => Number.parseInt(value, 16))
      : fromBase64Url(encodedKey);
  } catch {
    throw unavailable('HOPSTUDIO_CONFIG_ENCRYPTION_KEY est invalide.');
  }
  if (bytes.byteLength !== 32) {
    throw unavailable('HOPSTUDIO_CONFIG_ENCRYPTION_KEY doit contenir exactement 32 octets.');
  }
  return crypto.subtle.importKey('raw', buffer(bytes), 'AES-GCM', false, ['encrypt', 'decrypt']);
}

function text(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function buffer(value: Uint8Array): ArrayBuffer {
  return Uint8Array.from(value).buffer;
}

function base64Url(value: Uint8Array): string {
  let binary = '';
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function unavailable(message: string): HopeStudioSettingsRejectedError {
  return new HopeStudioSettingsRejectedError('encryption_unavailable', message);
}
