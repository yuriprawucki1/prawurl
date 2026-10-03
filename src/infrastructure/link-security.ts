import type { LinkSafetyStatus } from "../shared/contracts";

export const LINK_PASSWORD_ITERATIONS = 100_000;
export const LINK_UNLOCK_COOKIE_TTL_SECONDS = 15 * 60;

const encoder = new TextEncoder();

export interface PasswordHash {
  hash: string;
  salt: string;
  iterations: number;
}

export interface UnlockTokenPayload {
  linkId: string;
  passwordVersion: string | null;
  expiresAt: string;
}

export interface SafetyAnalysis {
  status: LinkSafetyStatus;
  reason: string | null;
}

export function buildUnlockCookieName(linkId: string): string {
  return `prawurl_unlock_${linkId.replace(/-/g, "")}`;
}

export function cookieMaxAgeSeconds(ttlSeconds: number): number {
  return Math.max(0, Math.floor(ttlSeconds));
}

export async function hashPassword(password: string, salt = randomHex(16), iterations = LINK_PASSWORD_ITERATIONS): Promise<PasswordHash> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: hexToBytes(salt),
      iterations
    },
    key,
    256
  );

  return {
    hash: bytesToHex(new Uint8Array(bits)),
    salt,
    iterations
  };
}

export async function verifyPassword(password: string, expected: PasswordHash): Promise<boolean> {
  const actual = await hashPassword(password, expected.salt, expected.iterations);
  return timingSafeEqual(actual.hash, expected.hash);
}

export async function signUnlockToken(payload: UnlockTokenPayload, secret: string): Promise<string> {
  const encoded = base64UrlEncode(JSON.stringify(payload));
  const signature = await hmacHex(secret, encoded);
  return `${encoded}.${signature}`;
}

export async function verifyUnlockToken(token: string, secret: string): Promise<UnlockTokenPayload | null> {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) {
    return null;
  }

  const expectedSignature = await hmacHex(secret, encoded);
  if (!timingSafeEqual(signature, expectedSignature)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encoded)) as UnlockTokenPayload;
    if (!payload.linkId || !payload.expiresAt) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function analyzeDestinationSafety(destinationUrl: string): SafetyAnalysis {
  try {
    const parsed = new URL(destinationUrl);
    const hostname = parsed.hostname.toLowerCase();

    if (parsed.username || parsed.password) {
      return { status: "suspect", reason: "URL com credenciais embutidas." };
    }

    if (isIpLiteral(hostname)) {
      return { status: "suspect", reason: "Destino usa endereço IP direto." };
    }

    if (hostname.includes("xn--")) {
      return { status: "suspect", reason: "Destino usa domínio punycoded." };
    }

    if (hostname.length > 64 || hostname.split(".").some((part) => part.length > 24)) {
      return { status: "suspect", reason: "Hostname incomum ou excessivamente longo." };
    }

    return { status: "clean", reason: null };
  } catch {
    return { status: "suspect", reason: "Destino inválido para análise de segurança." };
  }
}

export function extractDestinationDomain(destinationUrl: string): string {
  return new URL(destinationUrl).hostname.toLowerCase();
}

export function normalizeCountryCodes(values: string[] | undefined): string[] {
  if (!values) {
    return [];
  }

  return [...new Set(values.map((value) => value.trim().toUpperCase()).filter(Boolean))].sort();
}

function randomHex(bytes: number): string {
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);
  return bytesToHex(array);
}

async function hmacHex(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return bytesToHex(new Uint8Array(signature));
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const pairs = hex.match(/.{1,2}/g) ?? [];
  return new Uint8Array(pairs.map((pair) => Number.parseInt(pair, 16)));
}

function base64UrlEncode(value: string): string {
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string): string {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return atob(padded);
}

function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }

  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return result === 0;
}

function isIpLiteral(hostname: string): boolean {
  return /^(?:\d{1,3}\.){3}\d{1,3}$/.test(hostname) || hostname.startsWith("[");
}
