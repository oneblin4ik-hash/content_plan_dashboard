/**
 * Cloudflare D1 client over REST API.
 *
 * Used by the server (running on Manus or anywhere else with Node fetch) to
 * persist cross-device data for Content Studio. Requires three env vars:
 *
 *   CLOUDFLARE_ACCOUNT_ID    — found in Cloudflare dashboard
 *   CLOUDFLARE_D1_DATABASE_ID — uuid printed by `wrangler d1 create`
 *   CLOUDFLARE_API_TOKEN     — token with "D1 → Edit" permission
 *
 * If any of those is missing, `isD1Configured()` returns false and the
 * sync router falls back to telling clients to use localStorage only.
 */

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID ?? "";
const DATABASE_ID = process.env.CLOUDFLARE_D1_DATABASE_ID ?? "";
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN ?? "";

export function isD1Configured(): boolean {
  return Boolean(ACCOUNT_ID && DATABASE_ID && API_TOKEN);
}

type D1Row = Record<string, string | number | null>;

type D1QueryResult = {
  result: Array<{
    success: boolean;
    results?: D1Row[];
    meta?: Record<string, unknown>;
  }>;
  success: boolean;
  errors?: Array<{ code: number; message: string }>;
};

export async function d1Query<T = D1Row>(
  sql: string,
  params: (string | number | null)[] = []
): Promise<T[]> {
  if (!isD1Configured()) {
    throw new Error(
      "Cloudflare D1 is not configured (missing CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_D1_DATABASE_ID / CLOUDFLARE_API_TOKEN)."
    );
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/query`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${API_TOKEN}`,
    },
    body: JSON.stringify({ sql, params }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`D1 query failed: ${res.status} ${res.statusText} — ${body}`);
  }
  const json = (await res.json()) as D1QueryResult;
  if (!json.success) {
    throw new Error(
      `D1 error: ${json.errors?.map((e) => e.message).join("; ") || "unknown"}`
    );
  }
  return (json.result[0]?.results ?? []) as T[];
}

export async function d1Execute(
  sql: string,
  params: (string | number | null)[] = []
): Promise<void> {
  await d1Query(sql, params);
}
