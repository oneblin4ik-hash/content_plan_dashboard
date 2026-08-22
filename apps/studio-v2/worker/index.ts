import { Hono } from "hono";
import { loginSchema } from "../shared/types";
import type { Env } from "./env";
import {
  COOKIE_NAME,
  checkPassphrase,
  clearCookie,
  issueSession,
  readCookie,
  sessionCookie,
  verifySession,
} from "./auth";
import { api } from "./routes/api";
import { createDb, ensureSeeded } from "./store";

const app = new Hono<{ Bindings: Env }>();

/** Login attempts are throttled per isolate to blunt passphrase guessing. */
const attempts = new Map<string, { count: number; resetAt: number }>();
const ATTEMPT_WINDOW_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 10;

function tooManyAttempts(key: string): boolean {
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + ATTEMPT_WINDOW_MS });
    return false;
  }
  current.count += 1;
  return current.count > MAX_ATTEMPTS;
}

function clientKey(request: Request): string {
  const forwarded = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "anonymous";
}

app.get("/api/session", async (c) => {
  const token = readCookie(c.req.header("cookie") ?? null, COOKIE_NAME);
  const authorized = await verifySession(c.env, token);
  return c.json({
    authorized,
    // Surfaced so the UI can explain a blank deployment instead of just failing.
    configured: Boolean(c.env.STUDIO_PASSPHRASE),
  });
});

app.post("/api/session", async (c) => {
  if (!c.env.STUDIO_PASSPHRASE) {
    return c.json({ error: "Код-фраза не настроена на сервере. Добавьте секрет STUDIO_PASSPHRASE." }, 503);
  }
  if (tooManyAttempts(clientKey(c.req.raw))) {
    return c.json({ error: "Слишком много попыток. Подождите пять минут." }, 429);
  }

  const parsed = loginSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "Введите код-фразу." }, 400);

  if (!(await checkPassphrase(c.env, parsed.data.passphrase))) {
    return c.json({ error: "Код-фраза не подошла." }, 401);
  }

  await ensureSeeded(createDb(c.env.DB));
  c.header("set-cookie", sessionCookie(await issueSession(c.env)));
  return c.json({ authorized: true });
});

app.delete("/api/session", (c) => {
  c.header("set-cookie", clearCookie());
  return c.json({ authorized: false });
});

// Everything below /api requires a valid session.
app.use("/api/*", async (c, next) => {
  const token = readCookie(c.req.header("cookie") ?? null, COOKIE_NAME);
  if (!(await verifySession(c.env, token))) {
    return c.json({ error: "Нужно войти заново." }, 401);
  }
  await next();
});

app.route("/api", api);

app.notFound((c) => {
  if (c.req.path.startsWith("/api")) return c.json({ error: "Не найдено." }, 404);
  return c.env.ASSETS.fetch(c.req.raw);
});

app.onError((error, c) => {
  console.error("[crimson-studio]", error);
  return c.json({ error: "Внутренняя ошибка. Попробуйте ещё раз." }, 500);
});

export default app;
