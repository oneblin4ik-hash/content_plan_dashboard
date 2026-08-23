import { applyD1Migrations, env } from "cloudflare:test";
import type { D1Migration } from "@cloudflare/vitest-pool-workers";
import worker from "../worker/index";
import type { Env } from "../worker/env";

export const testEnv = env as unknown as Env;

const migrations = (env as unknown as { TEST_MIGRATIONS: D1Migration[] }).TEST_MIGRATIONS;

/**
 * Applies the real migration files, so tests run against the same schema the
 * deployed worker gets rather than a hand-written copy.
 */
export async function migrate(): Promise<void> {
  await applyD1Migrations(testEnv.DB, migrations);
}

export async function reset(): Promise<void> {
  for (const table of ["materials", "ideas", "drafts", "folders", "usage", "settings"]) {
    await testEnv.DB.exec(`DELETE FROM ${table}`);
  }
}

export function call(
  path: string,
  init?: RequestInit & { cookie?: string; ip?: string },
): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (init?.body) headers.set("content-type", "application/json");
  if (init?.cookie) headers.set("cookie", init.cookie);
  if (init?.ip) headers.set("cf-connecting-ip", init.ip);

  const request = new Request(`https://studio.test${path}`, { ...init, headers });
  return Promise.resolve(
    worker.fetch(request, testEnv, {
      waitUntil() {},
      passThroughOnException() {},
      props: {},
    } as unknown as ExecutionContext),
  );
}

let deviceCounter = 0;

/**
 * Logs in with the test passphrase and returns the session cookie. Each call
 * uses a distinct client IP so the login throttle (deliberately tight) does
 * not treat a whole test file as one machine guessing.
 */
export async function login(): Promise<string> {
  deviceCounter += 1;
  const response = await call("/api/session", {
    method: "POST",
    ip: `10.0.0.${deviceCounter % 250}`,
    body: JSON.stringify({ passphrase: "test-pass" }),
  });
  const setCookie = response.headers.get("set-cookie") ?? "";
  return setCookie.split(";")[0] ?? "";
}

export async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

/**
 * Seeds one folder and returns its id. Throws on anything but a clean create,
 * so a name colliding with a default folder fails here rather than silently
 * yielding an undefined id further down the test.
 */
export async function makeFolder(cookie: string, name = "Тестовая", color = "#D8232A") {
  const response = await call("/api/folders", {
    method: "POST",
    cookie,
    body: JSON.stringify({ name, color }),
  });
  if (response.status !== 201) {
    throw new Error(`Не удалось создать папку «${name}»: ${response.status}`);
  }
  return (await json<{ id: number }>(response)).id;
}
