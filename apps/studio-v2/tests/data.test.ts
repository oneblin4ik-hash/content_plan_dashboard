import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Folder, Idea } from "../shared/types";
import { call, json, login, makeFolder, migrate, reset } from "./helpers";

beforeAll(migrate);
beforeEach(reset);

type Export = {
  version: number;
  exportedAt: string;
  folders: Array<{ name: string; color: string; sortOrder: number }>;
  ideas: Array<{ folderName: string | null; title: string; createdAt: number }>;
};

async function seedOne(cookie: string, title: string, folderId: number | null) {
  await call("/api/ideas", {
    method: "POST",
    cookie,
    body: JSON.stringify({ title, folderId }),
  });
}

describe("выгрузка", () => {
  it("отдаёт папки и идеи с именем папки, а не с идентификатором", async () => {
    const cookie = await login();
    const folderId = await makeFolder(cookie, "Выгрузка · проба", "#B4151C");
    await seedOne(cookie, "Тема с папкой", folderId);
    await seedOne(cookie, "Тема без папки", null);

    const dump = await json<Export>(await call("/api/export", { cookie }));

    expect(dump.version).toBe(1);
    expect(dump.folders.map((folder) => folder.name)).toContain("Выгрузка · проба");

    const withFolder = dump.ideas.find((idea) => idea.title === "Тема с папкой");
    const without = dump.ideas.find((idea) => idea.title === "Тема без папки");
    expect(withFolder?.folderName).toBe("Выгрузка · проба");
    expect(without?.folderName).toBeNull();
  });

  it("не выгружает то, что лежит в корзине", async () => {
    const cookie = await login();
    const created = await json<{ id: number }>(
      await call("/api/ideas", {
        method: "POST",
        cookie,
        body: JSON.stringify({ title: "Удалённая тема" }),
      }),
    );
    await call(`/api/ideas/${created.id}`, { method: "DELETE", cookie });

    const dump = await json<Export>(await call("/api/export", { cookie }));
    expect(dump.ideas.map((idea) => idea.title)).not.toContain("Удалённая тема");
  });
});

describe("загрузка", () => {
  it("восстанавливает данные в пустой студии и раскладывает по папкам", async () => {
    const first = await login();
    const folderId = await makeFolder(first, "Перенос · проба", "#F4363D");
    await seedOne(first, "Тема для переноса", folderId);
    const dump = await json<Export>(await call("/api/export", { cookie: first }));

    await reset();
    const second = await login();

    const result = await json<{ addedFolders: number; addedIdeas: number; skipped: number }>(
      await call("/api/import", { method: "POST", cookie: second, body: JSON.stringify(dump) }),
    );
    expect(result.addedIdeas).toBe(1);
    expect(result.skipped).toBe(0);

    const overview = await json<{ folders: Folder[] }>(await call("/api/overview", { cookie: second }));
    const restored = overview.folders.find((folder) => folder.name === "Перенос · проба");
    expect(restored?.count).toBe(1);

    const list = await json<{ ideas: Idea[] }>(
      await call(`/api/ideas?folderId=${restored?.id}`, { cookie: second }),
    );
    expect(list.ideas[0]?.title).toBe("Тема для переноса");
  });

  // Re-importing the same backup must be safe — no duplicate ideas.
  it("повторная загрузка того же файла не плодит дубли", async () => {
    const cookie = await login();
    await seedOne(cookie, "Единственная тема", null);
    const dump = await json<Export>(await call("/api/export", { cookie }));

    await call("/api/import", { method: "POST", cookie, body: JSON.stringify(dump) });
    const second = await json<{ addedIdeas: number; skipped: number }>(
      await call("/api/import", { method: "POST", cookie, body: JSON.stringify(dump) }),
    );

    expect(second.addedIdeas).toBe(0);
    expect(second.skipped).toBe(1);

    const list = await json<{ ideas: Idea[] }>(await call("/api/ideas", { cookie }));
    expect(list.ideas).toHaveLength(1);
  });

  it("добавляет к существующему, ничего не затирая", async () => {
    const cookie = await login();
    await seedOne(cookie, "Уже была в студии", null);

    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      folders: [{ name: "Из файла", color: "#FF525A", sortOrder: 0 }],
      ideas: [
        {
          folderName: "Из файла",
          title: "Приехала из файла",
          createdAt: 1_700_000_000,
          isFavorite: false,
          source: "manual" as const,
        },
      ],
    };

    await call("/api/import", { method: "POST", cookie, body: JSON.stringify(payload) });

    const list = await json<{ ideas: Idea[] }>(await call("/api/ideas", { cookie }));
    expect(list.ideas.map((idea) => idea.title).sort()).toEqual([
      "Приехала из файла",
      "Уже была в студии",
    ]);
  });

  it("отклоняет посторонний файл понятной ошибкой", async () => {
    const cookie = await login();
    const response = await call("/api/import", {
      method: "POST",
      cookie,
      body: JSON.stringify({ что: "угодно" }),
    });

    expect(response.status).toBe(400);
    expect((await json<{ error: string }>(response)).error).toContain("выгрузку студии");
  });
});
