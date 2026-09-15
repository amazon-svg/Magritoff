import { describe, expect, it } from 'vitest';
import {
  hmacSha256Hex,
  normalizeIpForRateLimit,
  resolveClientIp,
} from '@/modules/clariprint/application/clariprint-quote-rate-limit';

describe('BCP-0b — resolveClientIp', () => {
  it('lit une IP unique valide', () => {
    expect(resolveClientIp('203.0.113.7')).toEqual({ ok: true, ip: '203.0.113.7' });
  });

  it('rejette une valeur absente (en-tete manquant)', () => {
    expect(resolveClientIp(null)).toEqual({ ok: false });
  });

  it('rejette une valeur vide', () => {
    expect(resolveClientIp('')).toEqual({ ok: false });
    expect(resolveClientIp('   ')).toEqual({ ok: false });
  });

  it('rejette plusieurs entrees (Headers.get() les fusionne avec ", ")', () => {
    expect(resolveClientIp('203.0.113.7, 198.51.100.9')).toEqual({ ok: false });
  });

  it('accepte une IP entouree d espaces (fusion propre)', () => {
    expect(resolveClientIp('  203.0.113.7  ')).toEqual({ ok: true, ip: '203.0.113.7' });
  });
});

describe('BCP-0b — normalizeIpForRateLimit', () => {
  it('laisse une IPv4 inchangee', () => {
    expect(normalizeIpForRateLimit('203.0.113.7')).toBe('203.0.113.7');
  });

  it('ramene une IPv6 a son prefixe /64', () => {
    expect(normalizeIpForRateLimit('2001:db8::1')).toBe('2001:0db8:0000:0000/64');
  });

  it('deux IPv6 du meme /64 produisent la MEME cle normalisee', () => {
    expect(normalizeIpForRateLimit('2001:db8::1')).toBe(normalizeIpForRateLimit('2001:db8::ffff'));
  });

  it('deux IPv6 de /64 differents produisent des cles differentes', () => {
    expect(normalizeIpForRateLimit('2001:db8:0:0::1')).not.toBe(normalizeIpForRateLimit('2001:db8:0:1::1'));
  });

  it('accepte une adresse IPv6 totalement developpee (sans ::)', () => {
    expect(normalizeIpForRateLimit('2001:0db8:0000:0000:0000:0000:0000:0001')).toBe('2001:0db8:0000:0000/64');
  });
});

describe('BCP-0b — hmacSha256Hex', () => {
  it('rend une empreinte hexadecimale de 64 caracteres (SHA-256)', async () => {
    const digest = await hmacSha256Hex('secret-de-test', '203.0.113.7');
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('est deterministe pour une meme entree', async () => {
    const a = await hmacSha256Hex('secret-de-test', '203.0.113.7');
    const b = await hmacSha256Hex('secret-de-test', '203.0.113.7');
    expect(a).toBe(b);
  });

  it('deux IP differentes ne donnent jamais la meme empreinte', async () => {
    const a = await hmacSha256Hex('secret-de-test', '203.0.113.7');
    const b = await hmacSha256Hex('secret-de-test', '203.0.113.8');
    expect(a).not.toBe(b);
  });

  it('deux secrets differents ne donnent jamais la meme empreinte pour la meme IP', async () => {
    const a = await hmacSha256Hex('secret-a', '203.0.113.7');
    const b = await hmacSha256Hex('secret-b', '203.0.113.7');
    expect(a).not.toBe(b);
  });

  it('rejette un secret vide', async () => {
    await expect(hmacSha256Hex('', '203.0.113.7')).rejects.toThrow(TypeError);
  });
});
