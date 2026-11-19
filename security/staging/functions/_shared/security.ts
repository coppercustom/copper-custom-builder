import { isIP } from "node:net";

export function gatewayIp(headers: Headers, trustGateway: boolean): string | null {
  if (!trustGateway) return null;
  const ip = headers.get("cf-connecting-ip");
  if (!ip || ip.includes("%") || !isIP(ip)) return null;
  if (isIP(ip) === 4) return ip;
  // URL canonicalization gives equivalent IPv6 spellings the same identity.
  return new URL(`http://[${ip}]/`).hostname.slice(1, -1);
}

export async function limiterHash(ip: string | null, salt: string): Promise<string | null> {
  if (ip === null) return null;
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(salt), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const hash = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(ip));
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("");
}
