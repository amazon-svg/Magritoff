import { describe, expect, it } from 'vitest';
import { publicAssetUrl, storedAssetReference } from '../../../src/adapters/supabase/shops-repository';

describe('URL publiques des assets boutique', () => {
  it('remplace l’origine Docker interne par l’origine publique locale', () => {
    expect(publicAssetUrl(
      'http://kong:8000/storage/v1/object/public/shop_backgrounds/shop/logo.png?v=1',
      'http://127.0.0.1:54321',
    )).toBe('http://127.0.0.1:54321/storage/v1/object/public/shop_backgrounds/shop/logo.png?v=1');
  });

  it('répare une URL Storage loopback enregistrée sans le port local', () => {
    expect(publicAssetUrl(
      'http://127.0.0.1/storage/v1/object/public/shop_backgrounds/shop/logo.png',
      'http://127.0.0.1:54321',
    )).toBe('http://127.0.0.1:54321/storage/v1/object/public/shop_backgrounds/shop/logo.png');
  });

  it('préserve une autre URL loopback qui ne cible pas Storage', () => {
    expect(publicAssetUrl('http://127.0.0.1/logo.png', 'http://127.0.0.1:54321'))
      .toBe('http://127.0.0.1/logo.png');
  });

  it('préserve une URL externe qui ne vient pas du réseau Docker', () => {
    expect(publicAssetUrl('https://cdn.example.com/logo.png', 'http://127.0.0.1:54321')).toBe('https://cdn.example.com/logo.png');
  });

  it('reconstruit une référence Storage portable avec l origine publique courante', () => {
    expect(publicAssetUrl(
      '/storage/v1/object/public/shop_backgrounds/shop/logo.png?v=2',
      'https://assets.magrit.example',
    )).toBe('https://assets.magrit.example/storage/v1/object/public/shop_backgrounds/shop/logo.png?v=2');
  });

  it('retire l origine des objets Storage avant persistance', () => {
    expect(storedAssetReference(
      'http://127.0.0.1:54321/storage/v1/object/public/shop_backgrounds/shop/logo.png?v=3',
    )).toBe('/storage/v1/object/public/shop_backgrounds/shop/logo.png?v=3');
  });

  it('préserve les URL externes lors de la persistance', () => {
    expect(storedAssetReference('https://cdn.example.com/logo.png'))
      .toBe('https://cdn.example.com/logo.png');
  });
});
