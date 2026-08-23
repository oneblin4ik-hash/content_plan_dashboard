import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router";
import { runTrendsRefresh } from "../server/routers/trends";
import {
  handleTelegramWebhook,
  handleTelegramSetup,
} from "./telegram-webhook";
import { d1Execute, d1Query, isD1Configured } from "../server/_core/d1";
import { parseSessionFromCookies, verifyJWT } from "../server/_core/auth";
import type { AuthUser, TrpcContext } from "../server/_core/context";

type Env = {
  ASSETS: { fetch: (req: Request) => Promise<Response> };
  /* D1 binding из wrangler.toml — даёт прямой service binding к базе.
     Через него server/_core/d1.ts делает batch без HTTP-subrequests. */
  DB?: unknown;
  JWT_SECRET?: string;
  ADMIN_EMAILS?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_D1_DATABASE_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
  BUILT_IN_FORGE_API_URL?: string;
  BUILT_IN_FORGE_API_KEY?: string;
  GEMINI_API_KEY?: string;
  GEMINI_API_URL?: string;
  GEMINI_MODEL?: string;
  GEMINI_FALLBACK_MODEL?: string;
  GEMINI_REASONING_EFFORT?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  OWNER_OPEN_ID?: string;
  NODE_ENV?: string;
  ADMIN_MIGRATE_SECRET?: string;
};

/* Минимальный admin-эндпоинт для применения D1-миграций в проде.
   Защищён общим секретом ADMIN_MIGRATE_SECRET — если он не задан,
   эндпоинт автоматически закрыт (always 403). Принимает POST JSON
   { sql: string | string[] } и прогоняет каждое statement через
   d1Execute. Используется только владельцем, до полноценной CI-
   миграционной системы. */
async function handleAdminMigrate(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  const expected = process.env.ADMIN_MIGRATE_SECRET ?? "";
  const got = req.headers.get("x-admin-secret") ?? "";
  if (!expected || got !== expected) {
    return new Response(JSON.stringify({ ok: false, error: "forbidden" }), {
      status: 403,
      headers: { "content-type": "application/json" },
    });
  }
  if (!isD1Configured()) {
    return new Response(JSON.stringify({ ok: false, error: "D1 not configured" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
  let body: { sql?: string | string[] };
  try {
    body = (await req.json()) as { sql?: string | string[] };
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "bad JSON" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  const statements = Array.isArray(body.sql) ? body.sql : body.sql ? [body.sql] : [];
  if (statements.length === 0) {
    return new Response(JSON.stringify({ ok: false, error: "no sql" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  const results: Array<{ sql: string; ok: boolean; error?: string }> = [];
  for (const sql of statements) {
    try {
      await d1Execute(sql);
      results.push({ sql: sql.slice(0, 120), ok: true });
    } catch (e) {
      results.push({
        sql: sql.slice(0, 120),
        ok: false,
        error: e instanceof Error ? e.message.slice(0, 240) : String(e),
      });
    }
  }
  return new Response(JSON.stringify({ ok: true, results }, null, 2), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

/* Достаёт юзера из cookie запроса: parse session JWT → SELECT users.
   Любая ошибка/невалидный токен/невалидный юзер → null (становится
   неавторизованным контекстом). Это OK — публичные процедуры всё
   равно работают, protectedProcedure отвалится сам. */
async function loadUserFromRequest(request: Request): Promise<AuthUser | null> {
  if (!isD1Configured()) return null;
  const token = parseSessionFromCookies(request.headers.get("cookie"));
  if (!token) return null;
  const secret = process.env.JWT_SECRET ?? "";
  if (!secret) return null;
  const payload = await verifyJWT(token, secret);
  if (!payload) return null;
  try {
    const rows = await d1Query<{
      id: string;
      email: string;
      name: string | null;
      plan: string;
      trial_ends_at: number;
      tokens_remaining: number;
      email_verified_at: number | null;
    }>(
      "SELECT id, email, name, plan, trial_ends_at, tokens_remaining, email_verified_at FROM users WHERE id = ? LIMIT 1",
      [payload.sub],
    );
    const u = rows[0];
    if (!u) return null;
    /* Админ = email в ADMIN_EMAILS (CSV, env-секрет). Никакого UI
       для назначения админов — добавляются только через wrangler secret. */
    const adminList = (process.env.ADMIN_EMAILS ?? "")
      .toLowerCase()
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const isAdmin = adminList.includes(u.email.toLowerCase());
    const role: "user" | "admin" = isAdmin ? "admin" : "user";
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      plan: u.plan,
      trialEndsAt: u.trial_ends_at,
      tokensRemaining: u.tokens_remaining,
      role,
      /* Админ всегда считается «подтверждённым», чтобы не получать
         баннер «подтверди email» в админ-аккаунте, у которого
         фактически верификация может ещё не пройти. */
      emailVerified: isAdmin || u.email_verified_at != null,
    };
  } catch {
    return null;
  }
}

function syncProcessEnv(env: Env) {
  // server/_core/env.ts reads process.env at import time, but ENV is `const`
  // pointing at the same getters. Re-assign each key so subsequent reads pick
  // up Worker-bound values.
  const target = (globalThis as any).process?.env ?? {};
  for (const [k, v] of Object.entries(env)) {
    if (typeof v === "string") target[k] = v;
  }
  if (!(globalThis as any).process) (globalThis as any).process = { env: target };
  /* Кладём D1 binding в globalThis, чтобы d1Batch() в server/_core/d1.ts
     мог им воспользоваться без передачи через ctx tRPC. Это в разы
     дешевле по subrequests, чем REST-вызовы для каждого statement. */
  if (env.DB) (globalThis as any).__d1_binding = env.DB;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    syncProcessEnv(env);

    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/trpc")) {
      /* Каждый запрос: читаем JWT из cookie, грузим юзера из D1,
         кладём в ctx. setCookies — буфер для login/logout, который
         потом склеиваем в Set-Cookie через responseMeta.headers. */
      const ctxSetCookies: string[] = [];
      const ctxUser = await loadUserFromRequest(request);
      return fetchRequestHandler({
        endpoint: "/api/trpc",
        req: request,
        router: appRouter,
        createContext: (): TrpcContext => ({
          req: null,
          res: null,
          user: ctxUser,
          setCookies: ctxSetCookies,
        }),
        responseMeta() {
          if (ctxSetCookies.length === 0) return {};
          const headers = new Headers();
          for (const c of ctxSetCookies) headers.append("set-cookie", c);
          return { headers };
        },
        onError({ error, path }) {
          console.error(`[tRPC] ${path ?? "<root>"}:`, error);
        },
      });
    }

    if (url.pathname === "/api/health") {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "content-type": "application/json" },
      });
    }

    if (url.pathname === "/api/telegram/webhook") {
      return handleTelegramWebhook(request);
    }

    if (url.pathname === "/api/telegram/setup-webhook") {
      return handleTelegramSetup(request);
    }

    if (url.pathname === "/api/_admin/migrate") {
      return handleAdminMigrate(request);
    }


    return env.ASSETS.fetch(request);
  },

  async scheduled(
    _event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    syncProcessEnv(env);
    /* Раз в сутки обновляем тренды конкурентов. Если что-то упало —
       залогируем, но не падаем (cron не должен ронять worker). */
    ctx.waitUntil(
      runTrendsRefresh().catch((err) => {
        console.error("[cron trends.refresh] failed", err);
      }),
    );
  },
};
