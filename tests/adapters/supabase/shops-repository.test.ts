import { describe, expect, it } from 'vitest';
import { publicAssetUrl } from '../../../src/adapters/supabase/shops-repository';

describe('URL publiques des assets boutique', () => {
  it('remplace l’origine Docker interne par l’origine publique locale', () => {
    expect(publicAssetUrl(
      'http://kong:8000/storage/v1/object/public/shop_backgrounds/shop/logo.png?v=1',
      'http://127.0.0.1:54321',
    )).toBe('http://127.0.0.1:54321/storage/v1/object/public/shop_backgrounds/shop/logo.png?v=1');
  });

  it('préserve une URL externe qui ne vient pas du réseau Docker', () => {
    expect(publicAssetUrl('https://cdn.example.com/logo.png', 'http://127.0.0.1:54321')).toBe('https://cdn.example.com/logo.png');
  });
});
