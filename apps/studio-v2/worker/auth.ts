import type { Env } from "./env";

export const COOKIE_NAME = "crimson_session";
const MAX_AGE_SECONDS = 90 * 24 * 60 * 60;

const encoder = new TextEncoder();

function base64url(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const byte of view) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return base64url(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
}

/**
 * Compares two strings without leaking length or position through timing.
 * Both sides are hashed first so the comparison always runs over 32 bytes.
 */
async function safeEqual(a: string, b: string): Promise<boolean> {
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(a)),
    crypto.subtle.digest("SHA-256", encoder.encode(b)),
  ]);
  const va = new Uint8Array(ha);
  const vb = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < va.length; i += 1) diff |= (va[i] ?? 0) ^ (vb[i] ?? 0);
  return diff === 0;
}

function authSecret(env: Env): string {
  // The passphrase doubles as key material when no separate secret is set, so
  // rotating the passphrase also invalidates every issued session.
  return env.AUTH_SECRET || env.STUDIO_PASSPHRASE || "";
}

export async function issueSession(env: Env): Promise<string> {
  const expires = Date.now() + MAX_AGE_SECONDS * 1000;
  const payload = String(expires);
  const signature = await hmac(authSecret(env), payload);
  return `${payload}.${signature}`;
}

export async function verifySession(env: Env, token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const separator = token.lastIndexOf(".");
  if (separator <= 0) return false;
  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  const expires = Number.parseInt(payload, 10);
  if (!Number.isFinite(expires) || expires < Date.now()) return false;
  const expected = await hmac(authSecret(env), payload);
  return safeEqual(expected, signature);
}

export async function checkPassphrase(env: Env, candidate: string): Promise<boolean> {
  const expected = env.STUDIO_PASSPHRASE;
  if (!expected) return false;
  return safeEqual(expected, candidate);
}

export function sessionCookie(token: string): string {
  return [
    `${COOKIE_NAME}=${token}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    `Max-Age=${MAX_AGE_SECONDS}`,
  ].join("; ");
}

export function clearCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function readCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return undefined;
}
