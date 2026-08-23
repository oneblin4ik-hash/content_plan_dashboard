import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { GeneratedMaterial, Material, Overview } from "../shared/types";
import { buildMaterialPrompt, parseMaterial } from "../worker/llm";
import { call, json, login, migrate, reset, testEnv } from "./helpers";

const realFetch = globalThis.fetch;

beforeAll(migrate);

beforeEach(async () => {
  await reset();
  testEnv.GEMINI_API_KEY = "test-key";
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

function stubFetch(handler: () => Response) {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    return handler();
  }) as typeof fetch;
  return () => calls;
}

function reelPayload(overrides: Partial<GeneratedMaterial> = {}): GeneratedMaterial {
  return {
    title: "Двадцать минут вместо часа",
    hook: "Ты не бросила спорт — у тебя просто не осталось часа.",
    body: "Короткая тренировка честнее пропуска.",
    scenes: [
      {
        time: "0–3 сек",
        shot: "Крупный план: будильник показывает 6:40.",
        speech: "Час на зал ты сегодня не найдёшь. И не надо.",
        caption: "Час не нужен",
        edit: "Резкий срез на движении руки.",
      },
      {
        time: "4–12 сек",
        shot: "Средний план: разминка у стены.",
        speech: "Двадцать минут закрывают неделю лучше, чем один пропущенный час.",
        caption: "20 минут",
        edit: "Ускорение вдвое.",
      },
    ],
    visual: "Домашний коврик у окна, утренний свет.",
    cta: "Сохрани, если утро вечно спешит",
    ...overrides,
  };
}

function postPayload(overrides: Partial<GeneratedMaterial> = {}): GeneratedMaterial {
  return {
    title: "Почему идеальный понедельник не приходит",
    hook: "Каждый понедельник ты начинаешь заново — и это не про лень.",
    body: "Первый абзац разбирает ожидание.\n\nВторой предлагает рабочий минимум.",
    scenes: [],
    visual: "Фото блокнота с расписанием.",
    cta: "Напиши, какой у тебя минимум",
    ...overrides,
  };
}

function geminiResponse(payload: GeneratedMaterial): Response {
  return new Response(
    JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] }),
    { headers: { "content-type": "application/json" } },
  );
}

async function makeIdea(cookie: string, title = "Тренировка на двадцать минут") {
  const response = await call("/api/ideas", {
    method: "POST",
    cookie,
    body: JSON.stringify({
      title,
      hook: "Хук про нехватку времени",
      format: "Контраст",
      angle: "Минимум вместо идеала",
      visual: "Коврик у окна",
      cta: "Сохрани",
      channel: "reels",
      segmentCode: "S3",
    }),
  });
  expect(response.status).toBe(201);
  return (await json<{ id: number }>(response)).id;
}

describe("промпт материала", () => {
  it("для Reels просит кадры, для поста — текст", () => {
    const reel = buildMaterialPrompt({
      kind: "reel",
      topic: "Тренировка на двадцать минут",
      segmentCode: "S3",
      length: "medium",
      goal: "",
      source: null,
    });
    expect(reel.user).toContain('"scenes"');
    expect(reel.user).toContain("5–7 кадров");

    const post = buildMaterialPrompt({
      kind: "post",
      topic: "Идеальный понедельник",
      segmentCode: "S3",
      length: "long",
      goal: "",
      source: null,
    });
    expect(post.user).toContain("2500–3500 знаков");
    expect(post.user).toContain('"scenes" оставь пустым');
  });

  it("передаёт угол исходной идеи, чтобы сценарий её не переписал", () => {
    const { user } = buildMaterialPrompt({
      kind: "reel",
      topic: "Тема",
      segmentCode: "S3",
      length: "short",
      goal: "сохранения",
      source: {
        hook: "Особый хук",
        format: "Миф",
        angle: "Строго этот угол",
        visual: "Этот кадр",
        cta: "Этот призыв",
      },
    });
    expect(user).toContain("Строго этот угол");
    expect(user).toContain("Особый хук");
    expect(user).toContain("сохранения");
  });

  it("отказывается работать без темы", () => {
    expect(() =>
      buildMaterialPrompt({
        kind: "post",
        topic: "   ",
        segmentCode: "S3",
        length: "medium",
        goal: "",
        source: null,
      }),
    ).toThrow();
  });
});

describe("разбор ответа модели", () => {
  it("принимает валидный сценарий", () => {
    const parsed = parseMaterial(JSON.stringify(reelPayload()), "reel");
    expect(parsed.scenes).toHaveLength(2);
    expect(parsed.scenes[0]?.time).toBe("0–3 сек");
  });

  it("снимает markdown-обёртку", () => {
    const wrapped = "```json\n" + JSON.stringify(postPayload()) + "\n```";
    expect(parseMaterial(wrapped, "post").title).toBe("Почему идеальный понедельник не приходит");
  });

  it("не пропускает сценарий без кадров", () => {
    expect(() => parseMaterial(JSON.stringify(reelPayload({ scenes: [] })), "reel")).toThrow();
  });

  it("не пропускает пост без текста", () => {
    expect(() => parseMaterial(JSON.stringify(postPayload({ body: "" })), "post")).toThrow();
  });

  it("режет выдуманный отзыв клиента внутри кадра", () => {
    const fabricated = reelPayload();
    fabricated.scenes[0]!.speech = "Моя клиентка сбросила восемь килограммов за месяц.";
    expect(() => parseMaterial(JSON.stringify(fabricated), "reel")).toThrow(/выдуманный/i);
  });
});

describe("генерация материала", () => {
  it("сохраняет сценарий сразу и связывает его с идеей", async () => {
    const cookie = await login();
    const ideaId = await makeIdea(cookie);
    stubFetch(() => geminiResponse(reelPayload()));

    const response = await call("/api/materials/generate", {
      method: "POST",
      cookie,
      body: JSON.stringify({ kind: "reel", ideaId, length: "medium" }),
    });
    expect(response.status).toBe(201);

    const material = await json<Material>(response);
    expect(material.ideaId).toBe(ideaId);
    expect(material.kind).toBe("reel");
    expect(material.status).toBe("draft");
    expect(material.scenes).toHaveLength(2);

    // Persisted, not merely returned: a closed tab must not lose a paid-for run.
    const listed = await json<Material[]>(await call("/api/materials", { cookie }));
    expect(listed.map((item) => item.id)).toContain(material.id);
  });

  it("возвращает квоту, когда модель ответила ошибкой", async () => {
    const cookie = await login();
    stubFetch(() => new Response("nope", { status: 500 }));

    const response = await call("/api/materials/generate", {
      method: "POST",
      cookie,
      body: JSON.stringify({ kind: "post", topic: "Тема поста", length: "short" }),
    });
    expect(response.status).toBe(502);

    const overview = await json<Overview>(await call("/api/overview", { cookie }));
    expect(overview.usage.used).toBe(0);
    expect(overview.totals.materials).toBe(0);
  });

  it("не пускает генерацию сверх дневного лимита", async () => {
    const cookie = await login();
    stubFetch(() => geminiResponse(postPayload()));

    const limit = Number(testEnv.DAILY_GENERATION_LIMIT);
    for (let i = 0; i < limit; i += 1) {
      const ok = await call("/api/materials/generate", {
        method: "POST",
        cookie,
        body: JSON.stringify({ kind: "post", topic: `Тема ${i}`, length: "short" }),
      });
      expect(ok.status).toBe(201);
    }

    const blocked = await call("/api/materials/generate", {
      method: "POST",
      cookie,
      body: JSON.stringify({ kind: "post", topic: "Лишняя тема", length: "short" }),
    });
    expect(blocked.status).toBe(429);
  });

  it("отказывает по несуществующей идее, не тратя квоту", async () => {
    const cookie = await login();
    const calls = stubFetch(() => geminiResponse(reelPayload()));

    const response = await call("/api/materials/generate", {
      method: "POST",
      cookie,
      body: JSON.stringify({ kind: "reel", ideaId: 999_999, length: "medium" }),
    });
    expect(response.status).toBe(404);
    expect(calls()).toBe(0);

    const overview = await json<Overview>(await call("/api/overview", { cookie }));
    expect(overview.usage.used).toBe(0);
  });
});

describe("правка и удаление", () => {
  async function seedMaterial(cookie: string) {
    stubFetch(() => geminiResponse(reelPayload()));
    const response = await call("/api/materials/generate", {
      method: "POST",
      cookie,
      body: JSON.stringify({ kind: "reel", topic: "Тема сценария", length: "medium" }),
    });
    return json<Material>(response);
  }

  it("правит текст и статус", async () => {
    const cookie = await login();
    const material = await seedMaterial(cookie);

    const patched = await call(`/api/materials/${material.id}`, {
      method: "PATCH",
      cookie,
      body: JSON.stringify({ title: "Новое название", status: "ready", isFavorite: true }),
    });
    expect(patched.status).toBe(200);

    const updated = await json<Material>(await call(`/api/materials/${material.id}`, { cookie }));
    expect(updated.title).toBe("Новое название");
    expect(updated.status).toBe("ready");
    expect(updated.isFavorite).toBe(true);
    // Untouched fields survive a partial patch.
    expect(updated.scenes).toHaveLength(2);
  });

  it("различает «кадры не трогали» и «кадры очистили»", async () => {
    const cookie = await login();
    const material = await seedMaterial(cookie);

    await call(`/api/materials/${material.id}`, {
      method: "PATCH",
      cookie,
      body: JSON.stringify({ hook: "Другой хук" }),
    });
    const afterPartial = await json<Material>(await call(`/api/materials/${material.id}`, { cookie }));
    expect(afterPartial.scenes).toHaveLength(2);

    await call(`/api/materials/${material.id}`, {
      method: "PATCH",
      cookie,
      body: JSON.stringify({ scenes: null }),
    });
    const afterClear = await json<Material>(await call(`/api/materials/${material.id}`, { cookie }));
    expect(afterClear.scenes).toBeNull();
  });

  it("убирает материал из списка после удаления", async () => {
    const cookie = await login();
    const material = await seedMaterial(cookie);

    expect((await call(`/api/materials/${material.id}`, { method: "DELETE", cookie })).status).toBe(200);
    expect((await call(`/api/materials/${material.id}`, { cookie })).status).toBe(404);

    const listed = await json<Material[]>(await call("/api/materials", { cookie }));
    expect(listed).toHaveLength(0);

    // Second delete finds nothing left to soft-delete.
    expect((await call(`/api/materials/${material.id}`, { method: "DELETE", cookie })).status).toBe(404);
  });

  it("фильтрует по виду и статусу", async () => {
    const cookie = await login();
    stubFetch(() => geminiResponse(postPayload()));
    const post = await json<Material>(
      await call("/api/materials/generate", {
        method: "POST",
        cookie,
        body: JSON.stringify({ kind: "post", topic: "Тема поста", length: "short" }),
      }),
    );
    stubFetch(() => geminiResponse(reelPayload()));
    await call("/api/materials/generate", {
      method: "POST",
      cookie,
      body: JSON.stringify({ kind: "reel", topic: "Тема сценария", length: "short" }),
    });

    const reels = await json<Material[]>(await call("/api/materials?kind=reel", { cookie }));
    expect(reels).toHaveLength(1);
    expect(reels[0]?.kind).toBe("reel");

    await call(`/api/materials/${post.id}`, {
      method: "PATCH",
      cookie,
      body: JSON.stringify({ status: "published" }),
    });
    const published = await json<Material[]>(await call("/api/materials?status=published", { cookie }));
    expect(published.map((item) => item.id)).toEqual([post.id]);
  });

  it("требует входа", async () => {
    expect((await call("/api/materials")).status).toBe(401);
    expect(
      (
        await call("/api/materials/generate", {
          method: "POST",
          body: JSON.stringify({ kind: "post", topic: "Тема" }),
        })
      ).status,
    ).toBe(401);
  });
});
