import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('StorefrontUnavailable', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'src/modules/shops/ui/storefront/StorefrontUnavailable.tsx'),
    'utf8',
  );

  it('distingue une indisponibilité technique d un refus d accès', () => {
    expect(source).toContain('Boutique temporairement indisponible');
    expect(source).toContain('Votre accès n’est pas remis en cause');
    expect(source).toContain('Réessayer');
  });
});
