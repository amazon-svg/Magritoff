import { describe, expect, it } from 'vitest';
import {
  readTrustedProxyRanges,
  resolveTrustedClientIp,
} from '../../../src/server/node/proxy-trust.ts';

describe('confiance des reverse proxies', () => {
  it('ignore X-Forwarded-For quand le pair TCP n est pas approuve', () => {
    expect(resolveTrustedClientIp('198.51.100.10', '203.0.113.25', ['10.0.0.0/8']))
      .toBe('198.51.100.10');
  });

  it('retient le premier saut non approuve en partant du proxy', () => {
    expect(resolveTrustedClientIp(
      '10.0.0.2',
      '192.0.2.200, 203.0.113.25, 10.0.0.3',
      ['10.0.0.0/8'],
    )).toBe('203.0.113.25');
  });

  it('revient a l adresse du proxy si la chaine est invalide', () => {
    expect(resolveTrustedClientIp('10.0.0.2', 'adresse-invalide', ['10.0.0.0/8']))
      .toBe('10.0.0.2');
  });

  it('normalise les adresses IPv4 mappees en IPv6 de Node', () => {
    expect(resolveTrustedClientIp('::ffff:127.0.0.1', null, [])).toBe('127.0.0.1');
  });

  it('lit une liste explicite d adresses et de CIDR', () => {
    expect(readTrustedProxyRanges({ MAGRIT_TRUSTED_PROXIES: '10.0.0.0/8, 2001:db8::/32' }))
      .toEqual(['10.0.0.0/8', '2001:db8::/32']);
  });

  it('refuse une plage invalide au demarrage', () => {
    expect(() => readTrustedProxyRanges({ MAGRIT_TRUSTED_PROXIES: '10.0.0.0/99' }))
      .toThrow(/CIDR invalide/);
  });
});
