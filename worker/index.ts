import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router";
import { runTrendsRefresh } from "../server/routers/trends";

type Env = {
  ASSETS: { fetch: (req: Request) => Promise<Response> };
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_D1_DATABASE_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
  BUILT_IN_FORGE_API_URL?: string;
  BUILT_IN_FORGE_API_KEY?: string;
  GEMINI_API_KEY?: string;
  GEMINI_API_URL?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  OWNER_OPEN_ID?: string;
  NODE_ENV?: string;
};

function syncProcessEnv(env: Env) {
  // server/_core/env.ts reads process.env at import time, but ENV is `const`
  // pointing at the same getters. Re-assign each key so subsequent reads pick
  // up Worker-bound values.
  const target = (globalThis as any).process?.env ?? {};
  for (const [k, v] of Object.entries(env)) {
    if (typeof v === "string") target[k] = v;
  }
  if (!(globalThis as any).process) (globalThis as any).process = { env: target };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    syncProcessEnv(env);

    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/trpc")) {
      return fetchRequestHandler({
        endpoint: "/api/trpc",
        req: request,
        router: appRouter,
        createContext: () => ({ req: null as any, res: null as any, user: null }),
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
