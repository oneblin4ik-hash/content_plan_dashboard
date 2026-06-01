/**
 * Auth helpers: пароли (PBKDF2 через Web Crypto) и сессии (JWT
 * HMAC-SHA256). Без сторонних зависимостей, чтобы запускалось и в
 * Cloudflare Workers, и в Node 22 (тесты/manus runtime).
 *
 * Формат сохранённого хеша: `pbkdf2-sha256$<iter>$<salt_b64>$<hash_b64>`.
 * Формат JWT: header.payload.signature (стандартный JWS HS256).
 */

const PBKDF2_ITER = 100_000;
const PBKDF2_LEN = 32;
const enc = new TextEncoder();
const dec = new TextDecoder();

function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
  const norm = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(norm);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function b64Std(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function b64StdDecode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function hashPassword(plain: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(plain),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: PBKDF2_ITER,
      hash: "SHA-256",
    },
    keyMaterial,
    PBKDF2_LEN * 8,
  );
  const hash = new Uint8Array(bits);
  return `pbkdf2-sha256$${PBKDF2_ITER}$${b64Std(salt)}$${b64Std(hash)}`;
}

export async function verifyPassword(
  plain: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2-sha256") return false;
  const iter = parseInt(parts[1], 10);
  if (!iter || iter < 1000) return false;
  const salt = b64StdDecode(parts[2]);
  const expected = b64StdDecode(parts[3]);
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(plain),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: iter, hash: "SHA-256" },
    keyMaterial,
    expected.length * 8,
  );
  const got = new Uint8Array(bits);
  if (got.length !== expected.length) return false;
  /* timingSafeEqual через XOR; обычный === тоже бы сработал, но так
     не теряем привычку. */
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got[i] ^ expected[i];
  return diff === 0;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export type JwtPayload = {
  sub: string; // user.id
  iat: number;
  exp: number;
};

const JWT_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 дней

export async function signJWT(
  sub: string,
  secret: string,
): Promise<string> {
  if (!secret) throw new Error("JWT_SECRET не задан");
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload: JwtPayload = {
    sub,
    iat: now,
    exp: now + JWT_TTL_SECONDS,
  };
  const headerB64 = b64url(enc.encode(JSON.stringify(header)));
  const payloadB64 = b64url(enc.encode(JSON.stringify(payload)));
  const data = `${headerB64}.${payloadB64}`;
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return `${data}.${b64url(new Uint8Array(sig))}`;
}

export async function verifyJWT(
  token: string,
  secret: string,
): Promise<JwtPayload | null> {
  if (!secret) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sigB64] = parts;
  const key = await hmacKey(secret);
  const ok = await crypto.subtle.verify(
    "HMAC",
    key,
    b64urlDecode(sigB64) as BufferSource,
    enc.encode(`${headerB64}.${payloadB64}`),
  );
  if (!ok) return null;
  let payload: JwtPayload;
  try {
    payload = JSON.parse(dec.decode(b64urlDecode(payloadB64))) as JwtPayload;
  } catch {
    return null;
  }
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || payload.exp < now) return null;
  if (typeof payload.sub !== "string" || payload.sub.length === 0) return null;
  return payload;
}

/* ─── Cookie helpers ──────────────────────────────────────────── */

export const SESSION_COOKIE = "cs_session";

export function buildSessionCookie(
  token: string,
  opts: { maxAgeSeconds?: number; secure: boolean } = { secure: true },
): string {
  const parts = [
    `${SESSION_COOKIE}=${token}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
  ];
  if (opts.secure) parts.push("Secure");
  parts.push(`Max-Age=${opts.maxAgeSeconds ?? JWT_TTL_SECONDS}`);
  return parts.join("; ");
}

export function buildClearCookie(secure: boolean): string {
  const parts = [
    `${SESSION_COOKIE}=`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    "Max-Age=0",
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function parseSessionFromCookies(
  cookieHeader: string | null,
): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [k, ...vRest] = part.trim().split("=");
    if (k === SESSION_COOKIE) return vRest.join("=") || null;
  }
  return null;
}
