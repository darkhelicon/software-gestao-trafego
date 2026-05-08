import { lookup } from "dns/promises";
import { isIP } from "net";

// RFC1918 + loopback + link-local + APIPA + reserved ranges
const BLOCKED_PATTERNS: RegExp[] = [
  /^127\./,                              // 127.0.0.0/8 loopback
  /^10\./,                               // 10.0.0.0/8 RFC1918
  /^172\.(1[6-9]|2\d|3[01])\./,         // 172.16.0.0/12 RFC1918
  /^192\.168\./,                         // 192.168.0.0/16 RFC1918
  /^169\.254\./,                         // 169.254.0.0/16 APIPA / AWS metadata
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // 100.64.0.0/10 Carrier-grade NAT
  /^0\./,                                // 0.0.0.0/8 reserved
  /^::1$/,                               // IPv6 loopback
  /^fc[0-9a-f]{2}:/i,                   // IPv6 unique local fc00::/7
  /^fd[0-9a-f]{2}:/i,                   // IPv6 unique local
  /^fe80:/i,                             // IPv6 link-local
];

function isBlockedIp(ip: string): boolean {
  return BLOCKED_PATTERNS.some((p) => p.test(ip));
}

/**
 * Validates that a URL is safe to fetch (not pointing at internal infrastructure).
 * Resolves DNS and checks all resulting IPs.
 * Throws a descriptive Error if the URL is unsafe.
 */
export async function assertSafeUrl(rawUrl: string): Promise<void> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("URL inválida");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Apenas URLs HTTP/HTTPS são permitidas");
  }

  const hostname = url.hostname;

  // Reject numeric IP directly in the URL
  if (isIP(hostname)) {
    if (isBlockedIp(hostname)) {
      throw new Error("URL aponta para um endereço IP privado ou reservado");
    }
    return;
  }

  // Resolve hostname — throws if unresolvable
  let addresses: string[];
  try {
    const results = await lookup(hostname, { all: true });
    addresses = results.map((r) => r.address);
  } catch {
    throw new Error("Não foi possível resolver o hostname da URL");
  }

  if (!addresses.length) {
    throw new Error("Hostname não resolve para nenhum endereço IP");
  }

  for (const addr of addresses) {
    if (isBlockedIp(addr)) {
      throw new Error("URL resolve para um endereço IP privado ou reservado");
    }
  }
}
