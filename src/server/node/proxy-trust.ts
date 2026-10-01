import { BlockList, isIP } from 'node:net';

export function readTrustedProxyRanges(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): readonly string[] {
  const value = environment['MAGRIT_TRUSTED_PROXIES']?.trim();
  if (!value) return Object.freeze([]);

  const ranges = value.split(',').map((entry) => entry.trim()).filter(Boolean);
  for (const range of ranges) validateRange(range);
  return Object.freeze(ranges);
}

/**
 * Resout l'adresse du client sans faire confiance a un en-tete public par
 * defaut. X-Forwarded-For n'est examine que lorsque le pair TCP appartient a
 * la liste explicite des proxies approuves.
 */
export function resolveTrustedClientIp(
  remoteAddress: string | undefined,
  forwardedFor: string | null,
  trustedProxyRanges: readonly string[],
): string | null {
  const peer = normalizeAddress(remoteAddress);
  if (peer === null) return null;
  if (!matchesAnyRange(peer, trustedProxyRanges)) return peer;

  const forwarded = forwardedFor?.split(',').map((entry) => normalizeAddress(entry.trim())) ?? [];
  if (forwarded.length === 0 || forwarded.some((entry) => entry === null)) return peer;

  for (let index = forwarded.length - 1; index >= 0; index -= 1) {
    const candidate = forwarded[index]!;
    if (!matchesAnyRange(candidate, trustedProxyRanges)) return candidate;
  }
  return peer;
}

function validateRange(range: string): void {
  const [address, prefix, ...extra] = range.split('/');
  const family = address === undefined ? 0 : isIP(address);
  if (extra.length > 0 || family === 0) throw invalidRange(range);
  if (prefix === undefined) return;
  const parsedPrefix = /^\d+$/.test(prefix) ? Number(prefix) : Number.NaN;
  const maximum = family === 4 ? 32 : 128;
  if (!Number.isInteger(parsedPrefix) || parsedPrefix < 0 || parsedPrefix > maximum) {
    throw invalidRange(range);
  }
}

function matchesAnyRange(address: string, ranges: readonly string[]): boolean {
  const family = isIP(address);
  if (family === 0) return false;
  return ranges.some((range) => {
    const [network, prefix] = range.split('/');
    if (network === undefined || isIP(network) !== family) return false;
    const blockList = new BlockList();
    if (prefix === undefined) blockList.addAddress(network, family === 4 ? 'ipv4' : 'ipv6');
    else blockList.addSubnet(network, Number(prefix), family === 4 ? 'ipv4' : 'ipv6');
    return blockList.check(address, family === 4 ? 'ipv4' : 'ipv6');
  });
}

function normalizeAddress(value: string | undefined): string | null {
  const address = value?.trim();
  if (!address) return null;
  const ipv4Mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(address)?.[1];
  const normalized = ipv4Mapped ?? address;
  return isIP(normalized) === 0 ? null : normalized;
}

function invalidRange(range: string): Error {
  return new Error(`MAGRIT_TRUSTED_PROXIES contient une adresse ou un CIDR invalide : ${range}`);
}

