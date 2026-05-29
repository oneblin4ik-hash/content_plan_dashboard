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
  /* В воркере используем D1 binding (env.DB). Этот путь не тратит
     subrequest-квоту, в отличие от REST-вызовов. */
  const binding = getBinding();
  if (binding) {
    const stmt = binding.prepare(sql).bind(...(params as (string | number | null)[]));
    const res = (await stmt.all()) as { results?: T[] };
    return (res.results ?? []) as T[];
  }

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
  const binding = getBinding();
  if (binding) {
    await binding.prepare(sql).bind(...(params as (string | number | null)[])).run();
    return;
  }
  await d1Query(sql, params);
}

/* Batch endpoint — выполняет много SQL-statements за один subrequest.
   На free-tier Cloudflare Workers лимит 50 subrequests на инвокацию;
   когда мы пишем 50 UPDATE'ов по одному через REST — это исчерпывает
   квоту целиком и парсер падает с «Too many subrequests».

   Решение: на Worker используем D1Database binding (env.DB.batch),
   который проходит локально через service binding (0 subrequests на
   batch). Worker кладёт binding в globalThis.__d1_binding в
   syncProcessEnv. Если binding нет (Node/manus runtime) — фоллбэчимся
   на серию REST-вызовов через d1Execute. */
export type BatchStatement = {
  sql: string;
  params?: (string | number | null)[];
};

/* Минимальный type-shape D1Database из @cloudflare/workers-types,
   достаточный для batch(). Не импортируем библиотеку, чтобы не тянуть
   зависимость в Node-сборку. */
type D1PreparedStatement = {
  bind: (...values: (string | number | null)[]) => D1PreparedStatement;
  all: <R = D1Row>() => Promise<{ results?: R[] }>;
  run: () => Promise<unknown>;
};
type D1Database = {
  prepare: (sql: string) => D1PreparedStatement;
  batch: (statements: D1PreparedStatement[]) => Promise<unknown>;
};

function getBinding(): D1Database | null {
  const g = globalThis as { __d1_binding?: D1Database };
  return g.__d1_binding ?? null;
}

export async function d1Batch(statements: BatchStatement[]): Promise<void> {
  if (statements.length === 0) return;
  const binding = getBinding();
  if (binding) {
    const prepared = statements.map((s) =>
      binding.prepare(s.sql).bind(...((s.params ?? []) as (string | number | null)[])),
    );
    await binding.batch(prepared);
    return;
  }
  /* Fallback для Node-окружения (когда нет binding) — выполняем по
     одному через REST. Дороже по subrequests, но в Node-режиме нет
     subrequest-лимита. */
  for (const s of statements) {
    await d1Execute(s.sql, s.params ?? []);
  }
}
