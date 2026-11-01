import { resolve4, resolve6 } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';

const blocked = new BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 3],
] as const)
  blocked.addSubnet(address, prefix, 'ipv4');

const globalIpv6 = new BlockList();
globalIpv6.addSubnet('2000::', 3, 'ipv6');
blocked.addSubnet('2001::', 23, 'ipv6');
blocked.addSubnet('2001:db8::', 32, 'ipv6');
blocked.addSubnet('2002::', 16, 'ipv6');

/** Accepts global unicast addresses and rejects IPv4-mapped IPv6. */
export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !blocked.check(address, 'ipv4');
  return family === 6 && globalIpv6.check(address, 'ipv6') && !blocked.check(address, 'ipv6');
}

/** Rejects private destinations and obvious credential-bearing URLs before disclosure. */
export function parsePublicUrl(raw: string): URL {
  const url = new URL(raw);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
    throw new Error('Only credential-free HTTP(S) URLs are supported');
  if (url.port && !['80', '443'].includes(url.port)) throw new Error('Unsupported source port');
  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (hostname === 'localhost' || /\.(localhost|local|internal)$/.test(hostname))
    throw new Error('Local URLs are not supported');
  if (isIP(hostname) && !isPublicAddress(hostname)) throw new Error('Private URL');
  rejectSensitiveQuery(url);
  url.hash = '';
  return url;
}

/** Rejects obvious secrets without claiming to detect every sensitive URL. */
function rejectSensitiveQuery(url: URL): void {
  for (const key of url.searchParams.keys()) {
    if (
      /token|secret|password|signature|credential|api[-_]?key|authorization|^sig$|^code$/i.test(key)
    )
      throw new Error('Sensitive URLs cannot be sent to Reader');
  }
}

/** Bounds DNS waiting independently of the Reader HTTP timeout. */
async function resolveAddresses(hostname: string): Promise<string[]> {
  const cancel = new AbortController();
  const timeout = delay(5000, undefined, { signal: cancel.signal }).then(() => {
    throw new Error('URL resolution timed out');
  });
  try {
    const resolution = Promise.all([
      resolve4(hostname).catch(() => []),
      resolve6(hostname).catch(() => []),
    ]).then((addresses) => addresses.flat());
    return await Promise.race([resolution, timeout]);
  } finally {
    cancel.abort();
  }
}

/** Validates every resolved address; Reader must independently protect redirects and DNS changes. */
export async function validatePublicUrl(raw: string): Promise<URL> {
  const url = parsePublicUrl(raw);
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(hostname)) return url;
  const addresses = await resolveAddresses(hostname);
  if (!addresses.length || !addresses.every(isPublicAddress))
    throw new Error('URL does not resolve exclusively to public addresses');
  return url;
}
