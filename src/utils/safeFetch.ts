import { lookup } from 'dns/promises';
import { isIP } from 'net';
import { logger } from '../config/logger';

export class BlockedUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BlockedUrlError';
  }
}

/** IPv4 ranges that must never be reachable from a user-supplied URL. */
const BLOCKED_V4: Array<[string, number]> = [
  ['0.0.0.0', 8], // "this" network
  ['10.0.0.0', 8], // private
  ['100.64.0.0', 10], // carrier-grade NAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local, incl. cloud metadata at 169.254.169.254
  ['172.16.0.0', 12], // private
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.0.2.0', 24], // TEST-NET-1
  ['192.168.0.0', 16], // private
  ['198.18.0.0', 15], // benchmarking
  ['198.51.100.0', 24], // TEST-NET-2
  ['203.0.113.0', 24], // TEST-NET-3
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved
];

const toV4 = (ip: string): number | null => {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) {
    return null;
  }
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
};

const isBlockedV4 = (ip: string): boolean => {
  const value = toV4(ip);
  if (value === null) return true;
  return BLOCKED_V4.some(([network, bits]) => {
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return (value & mask) >>> 0 === (toV4(network)! & mask) >>> 0;
  });
};

const isBlockedV6 = (ip: string): boolean => {
  const lower = ip.toLowerCase().split('%')[0];
  // ::ffff:1.2.3.4 and ::1 and the unspecified address
  if (lower === '::' || lower === '::1') return true;
  const v4Mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
  if (v4Mapped) return isBlockedV4(v4Mapped[1]);
  // Unique local (fc00::/7) and link-local (fe80::/10).
  return /^f[cd]/.test(lower) || /^fe[89ab]/.test(lower);
};

export const isBlockedAddress = (ip: string): boolean => {
  const family = isIP(ip);
  if (family === 4) return isBlockedV4(ip);
  if (family === 6) return isBlockedV6(ip);
  return true;
};

/**
 * Assert that `rawUrl` is safe to have the server fetch on a user's behalf.
 *
 * Without this, any user who can register a webhook (or an application to
 * scan) can point the server at `http://169.254.169.254/...` and read the
 * response back through the API — a full SSRF with exfiltration, which on a
 * cloud host discloses the instance IAM credentials.
 */
export const assertSafeUrl = async (rawUrl: string): Promise<URL> => {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new BlockedUrlError('URL is not valid.');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new BlockedUrlError('Only http and https URLs are allowed.');
  }
  if (url.username || url.password) {
    throw new BlockedUrlError('URLs with embedded credentials are not allowed.');
  }

  const host = url.hostname.replace(/^\[|\]$/g, '');

  if (isIP(host)) {
    if (isBlockedAddress(host)) {
      throw new BlockedUrlError('URL resolves to a private or reserved address.');
    }
    return url;
  }

  let addresses: Array<{ address: string }>;
  try {
    addresses = await lookup(host, { all: true });
  } catch (err) {
    throw new BlockedUrlError(`Host could not be resolved: ${(err as Error).message}`);
  }

  if (addresses.length === 0) {
    throw new BlockedUrlError('Host could not be resolved.');
  }

  // Every answer must be safe, otherwise a host with one public and one private
  // record bypasses the check.
  for (const { address } of addresses) {
    if (isBlockedAddress(address)) {
      logger.warn({ host, address }, 'blocked outbound request to a private address');
      throw new BlockedUrlError('URL resolves to a private or reserved address.');
    }
  }

  return url;
};

export interface SafeFetchOptions extends RequestInit {
  timeoutMs?: number;
}

/**
 * `fetch` with SSRF protection and a hard timeout. Redirects are surfaced to
 * the caller rather than followed, since a 302 to an internal host would
 * otherwise bypass the check performed on the original URL.
 */
export const safeFetch = async (rawUrl: string, options: SafeFetchOptions = {}): Promise<Response> => {
  const { timeoutMs = 10000, ...init } = options;
  const url = await assertSafeUrl(rawUrl);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, redirect: 'manual', signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};
