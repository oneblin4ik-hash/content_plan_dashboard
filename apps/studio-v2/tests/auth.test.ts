import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { call, json, login, migrate, reset } from "./helpers";

beforeAll(migrate);
beforeEach(reset);

describe("доступ по код-фразе", () => {
  it("не пускает к данным без входа", async () => {
    const response = await call("/api/overview");
    expect(response.status).toBe(401);
  });

  it("отклоняет неверную фразу", async () => {
    const response = await call("/api/session", {
      method: "POST",
      body: JSON.stringify({ passphrase: "неверно" }),
    });
    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("выдаёт куку на верную фразу и открывает данные", async () => {
    const response = await call("/api/session", {
      method: "POST",
      body: JSON.stringify({ passphrase: "test-pass" }),
    });
    expect(response.status).toBe(200);

    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");

    const overview = await call("/api/overview", { cookie: cookie.split(";")[0] });
    expect(overview.status).toBe(200);
  });

  it("не принимает подделанную подпись", async () => {
    const cookie = await login();
    const tampered = `${cookie.split(".")[0]}.tampered-signature`;
    const response = await call("/api/overview", { cookie: tampered });
    expect(response.status).toBe(401);
  });

  it("создаёт папки по умолчанию при первом входе", async () => {
    const cookie = await login();
    const overview = await json<{ folders: Array<{ name: string }> }>(
      await call("/api/overview", { cookie }),
    );
    expect(overview.folders.length).toBeGreaterThan(0);
    expect(overview.folders.map((folder) => folder.name)).toContain("Лайфхаки");
  });
});

describe("защита от подбора", () => {
  it("блокирует после десяти неудачных попыток с одного адреса", async () => {
    const attempt = () =>
      call("/api/session", {
        method: "POST",
        ip: "203.0.113.9",
        body: JSON.stringify({ passphrase: "wrong" }),
      });

    for (let i = 0; i < 10; i += 1) {
      expect((await attempt()).status).toBe(401);
    }
    expect((await attempt()).status).toBe(429);
  });
});
