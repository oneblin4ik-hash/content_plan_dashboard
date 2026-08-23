import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Folder, GeneratedIdea, Idea, Overview } from "../shared/types";
import { buildPrompt, parseIdeas } from "../worker/llm";
import { createDb, D1_MAX_BOUND_PARAMS, insertAll, schema } from "../worker/store";
import { call, json, login, makeFolder, migrate, reset, testEnv } from "./helpers";

const realFetch = globalThis.fetch;

beforeAll(migrate);

beforeEach(async () => {
  await reset();
  testEnv.GEMINI_API_KEY = "test-key";
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

/** Every outbound call must be intercepted; a real one is a test bug. */
function stubFetch(handler: (url: string) => Response) {
  const calls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    calls.push(url);
    return handler(url);
  }) as typeof fetch;
  return calls;
}

function idea(title: string, channel: "telegram" | "reels" = "reels"): GeneratedIdea {
  return {
    title,
    hook: `Хук для темы «${title}»`,
    format: "Контраст дня",
    angle: "Разбор реальной недели без переезда графика.",
    visual: "Крупный план часов и спортивной сумки.",
    cta: "Сохрани, если узнала себя",
    channel,
    objective: "сохранения",
  };
}

/** Answers the Gemini call with the given ideas. */
function mockGemini(ideas: GeneratedIdea[]) {
  return stubFetch((url) => {
    expect(url).toContain("generativelanguage.googleapis.com");
    expect(url).toContain(":generateContent");
    return Response.json({
      candidates: [{ content: { parts: [{ text: JSON.stringify({ ideas }) }] } }],
    });
  });
}

function mockGeminiStatus(status: number, body: unknown = {}) {
  return stubFetch(() => Response.json(body, { status }));
}

describe("сборка промпта", () => {
  it("подставляет сегмент и голос автора", () => {
    const { system, user } = buildPrompt({
      segmentCode: "S3",
      channel: "reels",
      count: 6,
      focus: "питание в командировке",
    });

    expect(user).toContain("S3");
    expect(user).toContain("У меня нет времени");
    expect(user).toContain("питание в командировке");
    expect(user).toContain("Serbolin");
    expect(system).toContain("Запрещено");
  });

  it("падает на неизвестном сегменте", () => {
    expect(() =>
      buildPrompt({ segmentCode: "S9", channel: "reels", count: 6, focus: "" }),
    ).toThrowError();
  });
});

describe("разбор ответа модели", () => {
  it("снимает markdown-обёртку", () => {
    const raw = "```json\n" + JSON.stringify({ ideas: [idea("Тема из блока кода")] }) + "\n```";
    expect(parseIdeas(raw, 1)[0]?.title).toBe("Тема из блока кода");
  });

  it("обрезает лишние идеи до запрошенного числа", () => {
    const raw = JSON.stringify({
      ideas: [idea("Первая тема"), idea("Вторая тема"), idea("Третья тема")],
    });
    expect(parseIdeas(raw, 2)).toHaveLength(2);
  });

  it("отклоняет не-JSON", () => {
    expect(() => parseIdeas("совсем не json", 3)).toThrowError(/JSON/);
  });

  // The trainer would have to stand behind a fabricated story publicly.
  it("отсекает выдуманные отзывы и кейсы", () => {
    const fabricated = { ...idea("Реальная тема"), angle: "Моя клиентка сбросила 12 кг за месяц." };
    expect(() => parseIdeas(JSON.stringify({ ideas: [fabricated] }), 1)).toThrowError(/выдуманный/);
  });
});

describe("генерация целиком", () => {
  it("сохраняет черновик сразу, до нажатия «Сохранить»", async () => {
    const cookie = await login();
    mockGemini([idea("Одиннадцать минут вместо часа")]);

    const response = await call("/api/generate", {
      method: "POST",
      cookie,
      body: JSON.stringify({ segmentCode: "S3", channel: "reels", count: 3, focus: "" }),
    });
    expect(response.status).toBe(200);

    // A reload must restore the batch instead of losing a paid generation.
    const overview = await json<{ draft: { ideas: GeneratedIdea[] } | null }>(
      await call("/api/overview", { cookie }),
    );
    expect(overview.draft?.ideas[0]?.title).toBe("Одиннадцать минут вместо часа");
  });

  /**
   * The bug this rebuild exists to fix: a saved idea used to land unfiled.
   */
  it("кладёт сохранённые идеи в выбранную папку", async () => {
    const cookie = await login();
    const overviewBefore = await json<{ folders: Folder[] }>(
      await call("/api/overview", { cookie }),
    );
    const folderId = overviewBefore.folders[0]?.id;
    expect(folderId).toBeDefined();

    mockGemini([idea("Первая тема"), idea("Вторая тема"), idea("Третья тема")]);

    const generated = await json<{ draftId: number }>(
      await call("/api/generate", {
        method: "POST",
        cookie,
        body: JSON.stringify({
          segmentCode: "S3",
          channel: "reels",
          count: 3,
          focus: "",
          folderId,
        }),
      }),
    );

    const saved = await json<{ saved: number }>(
      await call("/api/drafts/save", {
        method: "POST",
        cookie,
        body: JSON.stringify({ draftId: generated.draftId, indexes: [0, 2], folderId }),
      }),
    );
    expect(saved.saved).toBe(2);

    const list = await json<{ ideas: Idea[] }>(
      await call(`/api/ideas?folderId=${folderId}`, { cookie }),
    );
    expect(list.ideas).toHaveLength(2);
    expect(list.ideas.every((entry) => entry.folderId === folderId)).toBe(true);
    expect(list.ideas.map((entry) => entry.title).sort()).toEqual(["Первая тема", "Третья тема"]);
    expect(list.ideas.every((entry) => entry.source === "generated")).toBe(true);
  });

  it("сохраняет только отмеченные идеи", async () => {
    const cookie = await login();
    mockGemini([idea("Оставить эту"), idea("Пропустить эту")]);

    const generated = await json<{ draftId: number }>(
      await call("/api/generate", {
        method: "POST",
        cookie,
        body: JSON.stringify({ segmentCode: "S1", channel: "telegram", count: 3, focus: "" }),
      }),
    );

    await call("/api/drafts/save", {
      method: "POST",
      cookie,
      body: JSON.stringify({ draftId: generated.draftId, indexes: [0], folderId: null }),
    });

    const list = await json<{ ideas: Idea[] }>(await call("/api/ideas", { cookie }));
    expect(list.ideas.map((entry) => entry.title)).toEqual(["Оставить эту"]);
  });

  it("после сохранения черновик больше не всплывает", async () => {
    const cookie = await login();
    mockGemini([idea("Разовая тема")]);

    const generated = await json<{ draftId: number }>(
      await call("/api/generate", {
        method: "POST",
        cookie,
        body: JSON.stringify({ segmentCode: "S2", channel: "reels", count: 3, focus: "" }),
      }),
    );
    await call("/api/drafts/save", {
      method: "POST",
      cookie,
      body: JSON.stringify({ draftId: generated.draftId, indexes: [0], folderId: null }),
    });

    const overview = await json<{ draft: unknown }>(await call("/api/overview", { cookie }));
    expect(overview.draft).toBeNull();
  });

  it("считает генерации и останавливается на дневном лимите", async () => {
    const cookie = await login();
    const calls = mockGemini([idea("Тема лимита")]);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await call("/api/generate", {
        method: "POST",
        cookie,
        body: JSON.stringify({ segmentCode: "S3", channel: "reels", count: 3, focus: "" }),
      });
      expect(response.status).toBe(200);
    }

    // The fourth request must not reach the model at all.
    const blocked = await call("/api/generate", {
      method: "POST",
      cookie,
      body: JSON.stringify({ segmentCode: "S3", channel: "reels", count: 3, focus: "" }),
    });
    expect(blocked.status).toBe(429);
    expect((await json<{ error: string }>(blocked)).error).toContain("лимит");
    expect(calls).toHaveLength(3);
  });

  it("объясняет отсутствие ключа вместо пустого экрана", async () => {
    const cookie = await login();
    testEnv.GEMINI_API_KEY = undefined;
    const calls = stubFetch(() => Response.json({}));

    const response = await call("/api/generate", {
      method: "POST",
      cookie,
      body: JSON.stringify({ segmentCode: "S3", channel: "reels", count: 3, focus: "" }),
    });
    expect(response.status).toBe(502);
    expect((await json<{ error: string }>(response)).error).toContain("GEMINI_API_KEY");
    expect(calls).toHaveLength(0);
  });

  it("переводит исчерпанную квоту Gemini в понятное сообщение", async () => {
    const cookie = await login();
    mockGeminiStatus(429);

    const response = await call("/api/generate", {
      method: "POST",
      cookie,
      body: JSON.stringify({ segmentCode: "S3", channel: "reels", count: 3, focus: "" }),
    });
    expect((await json<{ error: string }>(response)).error).toContain("лимит Gemini");
  });

  it("не тратит квоту, когда модель не ответила", async () => {
    const cookie = await login();
    mockGeminiStatus(500, { error: "boom" });

    await call("/api/generate", {
      method: "POST",
      cookie,
      body: JSON.stringify({ segmentCode: "S3", channel: "reels", count: 3, focus: "" }),
    });

    const overview = await json<{ usage: { used: number } }>(
      await call("/api/overview", { cookie }),
    );
    expect(overview.usage.used).toBe(0);
  });
});

describe("гонки", () => {
  /**
   * Two tabs, or a double tap, used to slip past the cap: every request read
   * the same count before any of them incremented it.
   */
  it("параллельные генерации не превышают дневной лимит", async () => {
    const cookie = await login();

    // Hold each provider call open so all six overlap inside the handler.
    const calls: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      calls.push(typeof input === "string" ? input : (input as Request).url ?? String(input));
      await new Promise((resolve) => setTimeout(resolve, 25));
      return Response.json({
        candidates: [
          {
            content: {
              parts: [{ text: JSON.stringify({ ideas: [idea("Параллельная тема")] }) }],
            },
          },
        ],
      });
    }) as typeof fetch;

    const responses = await Promise.all(
      Array.from({ length: 6 }, () =>
        call("/api/generate", {
          method: "POST",
          cookie,
          body: JSON.stringify({ segmentCode: "S3", channel: "reels", count: 3, focus: "" }),
        }),
      ),
    );

    const ok = responses.filter((response) => response.status === 200);
    const blocked = responses.filter((response) => response.status === 429);

    // DAILY_GENERATION_LIMIT is 3 in the test environment.
    expect(ok).toHaveLength(3);
    expect(blocked).toHaveLength(3);
    expect(calls).toHaveLength(3);

    const overview = await json<{ usage: { used: number } }>(
      await call("/api/overview", { cookie }),
    );
    expect(overview.usage.used).toBe(3);
  });

  it("повторное сохранение черновика не дублирует идеи", async () => {
    const cookie = await login();
    mockGemini([idea("Тема без дублей")]);

    const generated = await json<{ draftId: number }>(
      await call("/api/generate", {
        method: "POST",
        cookie,
        body: JSON.stringify({ segmentCode: "S3", channel: "reels", count: 3, focus: "" }),
      }),
    );

    const save = () =>
      call("/api/drafts/save", {
        method: "POST",
        cookie,
        body: JSON.stringify({ draftId: generated.draftId, indexes: [0], folderId: null }),
      });

    const [first, second] = await Promise.all([save(), save()]);
    const codes = [first?.status, second?.status].sort();
    expect(codes).toEqual([200, 409]);

    const list = await json<{ ideas: Idea[] }>(await call("/api/ideas", { cookie }));
    expect(list.ideas).toHaveLength(1);
  });

  it("сообщает понятно, когда черновика нет вовсе", async () => {
    const cookie = await login();
    const response = await call("/api/drafts/save", {
      method: "POST",
      cookie,
      body: JSON.stringify({ draftId: 999_999, indexes: [0], folderId: null }),
    });
    expect(response.status).toBe(404);
    expect((await json<{ error: string }>(response)).error).toContain("не найден");
  });
});

describe("снятая с обслуживания модель", () => {
  /*
   * Google retires a model and answers 404 with an English notice naming the
   * replacement. Left raw, that reads as a broken key; the actionable part is
   * which variable to change and to what.
   */
  it("называет переменную и модель на замену", async () => {
    const cookie = await login();
    stubFetch(
      () =>
        new Response(
          JSON.stringify({
            error: {
              code: 404,
              message:
                "This model models/gemini-2.5-flash is no longer available to new users. Please update your code to use models/gemini-3.6-flash for the equivalent.",
            },
          }),
          { status: 404 },
        ),
    );

    const response = await call("/api/generate", {
      method: "POST",
      cookie,
      body: JSON.stringify({ segmentCode: "S3", channel: "reels", count: 3 }),
    });
    expect(response.status).toBe(502);

    const { error } = await json<{ error: string }>(response);
    expect(error).toContain("LLM_MODEL");
    expect(error).toContain("gemini-3.6-flash");

    // A dead model must not burn the day's quota.
    const overview = await json<Overview>(await call("/api/overview", { cookie }));
    expect(overview.usage.used).toBe(0);
  });
});

describe("предел связанных параметров D1", () => {
  /*
   * Regression: saving the largest batch built one INSERT with 104 bound
   * parameters — D1 refuses anything past 100. The insert threw, the draft was
   * already marked consumed, and a whole generation vanished: empty bank,
   * spent quota, nothing to retry. Earlier tests used three ideas (39
   * parameters) and never came near the ceiling.
   *
   * Asserted on the statements themselves rather than on the local database,
   * which does not enforce the limit that production does.
   */
  it("ни один запрос вставки не выходит за сотню параметров", () => {
    const db = createDb(testEnv.DB);
    const row = {
      folderId: 1,
      segmentCode: "S2",
      channel: "telegram" as const,
      priority: "viral" as const,
      title: "Тема",
      hook: "хук",
      format: "формат",
      angle: "угол",
      visual: "визуал",
      cta: "призыв",
      objective: "охват",
      source: "generated" as const,
    };

    // The unbatched statement is what used to break; keep the proof visible.
    const wholeBatch = db.insert(schema.ideas).values(Array(8).fill(row)).toSQL();
    expect(wholeBatch.params.length).toBeGreaterThan(D1_MAX_BOUND_PARAMS);

    const sizes: number[] = [];
    void insertAll(Array(8).fill(row), (batch) => {
      sizes.push(db.insert(schema.ideas).values(batch).toSQL().params.length);
      return db.insert(schema.ideas).values(batch);
    });
    expect(sizes.length).toBeGreaterThan(1);
    for (const size of sizes) expect(size).toBeLessThanOrEqual(D1_MAX_BOUND_PARAMS);
  });

  it("сохраняет все восемь идей — самый большой выбор", async () => {
    const cookie = await login();
    const folderId = await makeFolder(cookie, "Папка на восемь");
    const batch = Array.from({ length: 8 }, (_, i) => idea(`Тема номер ${i + 1} про режим`, "telegram"));
    mockGemini(batch);

    const draft = await json<{ draftId: number }>(
      await call("/api/generate", {
        method: "POST",
        cookie,
        body: JSON.stringify({ segmentCode: "S3", channel: "telegram", count: 8, folderId }),
      }),
    );

    const saved = await call("/api/drafts/save", {
      method: "POST",
      cookie,
      body: JSON.stringify({ draftId: draft.draftId, indexes: [0, 1, 2, 3, 4, 5, 6, 7], folderId }),
    });
    expect(saved.status).toBe(200);
    expect((await json<{ saved: number }>(saved)).saved).toBe(8);

    const listed = await json<{ ideas: Idea[] }>(
      await call(`/api/ideas?folderId=${folderId}`, { cookie }),
    );
    expect(listed.ideas).toHaveLength(8);
  });

  /*
   * The draft has to survive a failed insert. Without that the ideas are lost
   * for good: the app stops offering the draft and the generation is spent.
   */
  it("возвращает черновик, если вставка сорвалась", async () => {
    const cookie = await login();
    mockGemini([idea("Тема для сорванной вставки", "reels")]);

    const draft = await json<{ draftId: number }>(
      await call("/api/generate", {
        method: "POST",
        cookie,
        body: JSON.stringify({ segmentCode: "S3", channel: "reels", count: 3 }),
      }),
    );

    // A folder that does not exist trips the foreign key inside the insert.
    const failed = await call("/api/drafts/save", {
      method: "POST",
      cookie,
      body: JSON.stringify({ draftId: draft.draftId, indexes: [0], folderId: 999_999 }),
    });
    expect(failed.status).toBe(500);

    // Offered again on the next open, rather than silently gone.
    const overview = await json<Overview>(await call("/api/overview", { cookie }));
    expect(overview.draft?.id).toBe(draft.draftId);
  });
});
