import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Folder, Idea } from "../shared/types";
import { call, json, login, makeFolder, migrate, reset } from "./helpers";

beforeAll(migrate);
beforeEach(reset);

async function makeIdea(cookie: string, title: string, folderId: number | null) {
  const response = await call("/api/ideas", {
    method: "POST",
    cookie,
    body: JSON.stringify({ title, folderId }),
  });
  return (await json<{ id: number }>(response)).id;
}

describe("папки", () => {
  it("создаёт папку и считает идеи внутри", async () => {
    const cookie = await login();
    const folderId = await makeFolder(cookie, "Лайфхаки-2");
    await makeIdea(cookie, "Первая идея в папке", folderId);
    await makeIdea(cookie, "Вторая идея в папке", folderId);

    const overview = await json<{ folders: Folder[] }>(await call("/api/overview", { cookie }));
    const folder = overview.folders.find((entry) => entry.id === folderId);
    expect(folder?.count).toBe(2);
  });

  it("не даёт создать две папки с одним названием", async () => {
    const cookie = await login();
    await makeFolder(cookie, "Дубликат");
    const second = await call("/api/folders", {
      method: "POST",
      cookie,
      body: JSON.stringify({ name: "Дубликат", color: "#D8232A" }),
    });
    expect(second.status).toBe(409);
  });

  it("переименовывает и перекрашивает папку", async () => {
    const cookie = await login();
    const folderId = await makeFolder(cookie, "Старое имя", "#D8232A");

    const patched = await call(`/api/folders/${folderId}`, {
      method: "PATCH",
      cookie,
      body: JSON.stringify({ name: "Новое имя", color: "#FF525A" }),
    });
    expect(patched.status).toBe(200);

    const overview = await json<{ folders: Folder[] }>(await call("/api/overview", { cookie }));
    const folder = overview.folders.find((entry) => entry.id === folderId);
    expect(folder?.name).toBe("Новое имя");
    expect(folder?.color).toBe("#FF525A");
  });

  it("отклоняет цвет в неверном формате", async () => {
    const cookie = await login();
    const response = await call("/api/folders", {
      method: "POST",
      cookie,
      body: JSON.stringify({ name: "Плохой цвет", color: "красный" }),
    });
    expect(response.status).toBe(400);
  });

  // The important guarantee: deleting a folder must never destroy ideas.
  it("при удалении папки идеи переезжают в «Без папки»", async () => {
    const cookie = await login();
    const folderId = await makeFolder(cookie, "На удаление");
    await makeIdea(cookie, "Идея должна выжить", folderId);

    await call(`/api/folders/${folderId}`, { method: "DELETE", cookie });

    const list = await json<{ ideas: Idea[] }>(await call("/api/ideas?folderId=none", { cookie }));
    expect(list.ideas.map((idea) => idea.title)).toContain("Идея должна выжить");

    const overview = await json<{ folders: Folder[]; totals: { unfiled: number } }>(
      await call("/api/overview", { cookie }),
    );
    expect(overview.folders.find((entry) => entry.id === folderId)).toBeUndefined();
    expect(overview.totals.unfiled).toBe(1);
  });
});

describe("идеи: фильтр, сортировка, корзина", () => {
  it("фильтрует по папке", async () => {
    const cookie = await login();
    const first = await makeFolder(cookie, "Папка А");
    const second = await makeFolder(cookie, "Папка Б");
    await makeIdea(cookie, "Тема из папки А", first);
    await makeIdea(cookie, "Тема из папки Б", second);

    const list = await json<{ ideas: Idea[] }>(
      await call(`/api/ideas?folderId=${first}`, { cookie }),
    );
    expect(list.ideas).toHaveLength(1);
    expect(list.ideas[0]?.title).toBe("Тема из папки А");
  });

  it("сортирует по алфавиту", async () => {
    const cookie = await login();
    await makeIdea(cookie, "Ягоды на завтрак", null);
    await makeIdea(cookie, "Автопилот недели", null);

    const list = await json<{ ideas: Idea[] }>(await call("/api/ideas?sort=alpha", { cookie }));
    expect(list.ideas[0]?.title).toBe("Автопилот недели");
  });

  it("ищет по теме", async () => {
    const cookie = await login();
    await makeIdea(cookie, "Тренировка в обед за 11 минут", null);
    await makeIdea(cookie, "Питание в командировке", null);

    const list = await json<{ ideas: Idea[] }>(
      await call(`/api/ideas?search=${encodeURIComponent("обед")}`, { cookie }),
    );
    expect(list.ideas).toHaveLength(1);
    expect(list.ideas[0]?.title).toContain("обед");
  });

  it("удаление прячет идею в корзину, а не стирает", async () => {
    const cookie = await login();
    const ideaId = await makeIdea(cookie, "Идея под удаление", null);

    await call(`/api/ideas/${ideaId}`, { method: "DELETE", cookie });

    const list = await json<{ ideas: Idea[] }>(await call("/api/ideas", { cookie }));
    expect(list.ideas).toHaveLength(0);

    const bin = await json<{ ideas: Array<{ id: number }> }>(await call("/api/bin", { cookie }));
    expect(bin.ideas.map((idea) => idea.id)).toContain(ideaId);

    await call(`/api/ideas/${ideaId}/restore`, { method: "POST", cookie });
    const restored = await json<{ ideas: Idea[] }>(await call("/api/ideas", { cookie }));
    expect(restored.ideas).toHaveLength(1);
  });

  it("отмечает избранное и фильтрует по нему", async () => {
    const cookie = await login();
    const ideaId = await makeIdea(cookie, "Идея в избранное", null);
    await makeIdea(cookie, "Обычная идея", null);

    await call(`/api/ideas/${ideaId}`, {
      method: "PATCH",
      cookie,
      body: JSON.stringify({ isFavorite: true }),
    });

    const list = await json<{ ideas: Idea[] }>(
      await call("/api/ideas?favoritesOnly=true", { cookie }),
    );
    expect(list.ideas).toHaveLength(1);
    expect(list.ideas[0]?.title).toBe("Идея в избранное");
  });

  /*
   * Regression: the update schema used to be derived with `.partial()`, which
   * leaves zod defaults in place. Every omitted field parsed to null, so one
   * tap on the heart — the UI sends `{isFavorite}` alone — silently emptied
   * the idea and dropped it out of its folder.
   */
  it("не стирает остальную идею, когда меняют одно поле", async () => {
    const cookie = await login();
    const folderId = await makeFolder(cookie, "Папка для сохранности");
    const created = await call("/api/ideas", {
      method: "POST",
      cookie,
      body: JSON.stringify({
        title: "Идея со всеми полями",
        folderId,
        hook: "Хук, который должен уцелеть",
        format: "Миф",
        angle: "Угол подачи",
        visual: "Кадр у окна",
        cta: "Сохрани",
        objective: "сохранения",
        channel: "telegram",
        priority: "high",
        segmentCode: "S2",
      }),
    });
    const ideaId = (await json<{ id: number }>(created)).id;

    await call(`/api/ideas/${ideaId}`, {
      method: "PATCH",
      cookie,
      body: JSON.stringify({ isFavorite: true }),
    });

    const list = await json<{ ideas: Idea[] }>(await call("/api/ideas", { cookie }));
    const idea = list.ideas.find((entry) => entry.id === ideaId);
    expect(idea).toBeDefined();
    expect(idea?.isFavorite).toBe(true);
    expect(idea?.hook).toBe("Хук, который должен уцелеть");
    expect(idea?.format).toBe("Миф");
    expect(idea?.angle).toBe("Угол подачи");
    expect(idea?.visual).toBe("Кадр у окна");
    expect(idea?.cta).toBe("Сохрани");
    expect(idea?.objective).toBe("сохранения");
    expect(idea?.channel).toBe("telegram");
    expect(idea?.priority).toBe("high");
    expect(idea?.segmentCode).toBe("S2");
    expect(idea?.folderId).toBe(folderId);
  });

  it("всё ещё умеет очистить поле явным null", async () => {
    const cookie = await login();
    const created = await call("/api/ideas", {
      method: "POST",
      cookie,
      body: JSON.stringify({ title: "Идея с хуком", hook: "Хук на удаление" }),
    });
    const ideaId = (await json<{ id: number }>(created)).id;

    await call(`/api/ideas/${ideaId}`, {
      method: "PATCH",
      cookie,
      body: JSON.stringify({ hook: null }),
    });

    const list = await json<{ ideas: Idea[] }>(await call("/api/ideas", { cookie }));
    expect(list.ideas.find((entry) => entry.id === ideaId)?.hook).toBeNull();
  });

  it("отклоняет слишком короткую тему", async () => {
    const cookie = await login();
    const response = await call("/api/ideas", {
      method: "POST",
      cookie,
      body: JSON.stringify({ title: "я" }),
    });
    expect(response.status).toBe(400);
  });
});
