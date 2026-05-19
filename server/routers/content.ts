import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { SERBOLIN_SYSTEM_PROMPT as SERBOLIN_SYSTEM } from "../_core/brand-knowledge";

/* ============================================================
   Content Studio — Mr. Serbolin
   tRPC content router. LLM = Gemini 2.5 Flash via Forge proxy
   or direct AI Studio (server/_core/llm.ts).

   Brand voice + viral hook patterns + anti-AI checklist live in
   server/_core/brand-knowledge.ts. To tune what the generator
   knows about Mr. Serbolin (audience, slogans, voice rules, etc.)
   edit that file — not the prompts below.
   ============================================================ */

const formatBlock = (tone: string) => {
  if (tone === "expert")
    return "экспертный, авторитетный, со ссылками на физиологию и опыт зала";
  if (tone === "friend")
    return "дружеский, эмпатичный, как с подругой за чашкой кофе";
  return "провокационный, цепляющий на эмоциях — но без жёлтых заголовков";
};

const callLLM = async (system: string, user: string) => {
  const r = await invokeLLM({
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  const out = r.choices[0]?.message.content;
  if (!out || typeof out !== "string")
    throw new Error("LLM вернул пустой ответ");
  return out;
};

export const contentRouter = router({
  /* ---------- POST ---------- */
  generatePost: publicProcedure
    .input(
      z.object({
        title: z.string().min(5, "Заголовок минимум 5 символов"),
        tone: z.enum(["expert", "friend", "provocative"]).default("expert"),
        platform: z.enum(["telegram", "instagram"]).default("telegram"),
        length: z.enum(["short", "medium", "long"]).default("medium"),
      })
    )
    .mutation(async ({ input }) => {
      const lengthWords =
        input.length === "short"
          ? "180–280 слов"
          : input.length === "long"
            ? "600–900 слов"
            : "350–500 слов";

      const system = `${SERBOLIN_SYSTEM}

Текущая задача: ${formatBlock(input.tone)} пост для ${
        input.platform === "telegram" ? "Telegram" : "Instagram"
      }.
Сегмент аудитории по умолчанию — женщины 25–45 (если в теме явно не указан
другой сегмент, например IT-предприниматель или мужчина 30+).`;

      const user = `Напиши готовый пост на тему: «${input.title}».

Структура:
1) Хук (2–3 строки) — используй один из паттернов из блока «ВИРАЛЬНЫЕ
   ПАТТЕРНЫ ЗАГОЛОВКОВ» в системном промпте. Не смешивай несколько
   паттернов в одном хуке.
2) Тело (3–5 коротких абзацев, без воды). Минимум одна конкретная цифра
   или конкретный пример из зала / клиента.
3) Завершение — вопрос, который реально тянет на ответ в комментариях
   (не риторический). Слоган уместен, но не обязателен.

Объём: ${lengthWords}.
Никаких подзаголовков «Хук:», «Тело:» — выдай только готовый текст поста.
Перед выдачей мысленно прогони текст через АНТИ-AI ЧЕК-ЛИСТ из системного
промпта и убери все нарушения.`;

      const post = await callLLM(system, user);
      return {
        post,
        title: input.title,
        platform: input.platform,
        tone: input.tone,
        length: input.length,
      };
    }),

  /* ---------- REELS SCRIPT ---------- */
  generateReelsScript: publicProcedure
    .input(
      z.object({
        title: z.string().min(5),
        duration: z.enum(["15-30s", "30-60s"]).default("15-30s"),
      })
    )
    .mutation(async ({ input }) => {
      const system = `${SERBOLIN_SYSTEM}

Текущая задача: вирусный сценарий Reels по формуле «БОЛЬ → РЕШЕНИЕ → CTA В БОТ»
из блока «ФОРМУЛЫ КОНТЕНТА» системного промпта. Архетип — справедливый
друг-эксперт. Тон умеренно жёсткий, контраст, парадокс. CTA — всегда в бот
Эдуарда (ссылка в шапке/описании), потому что весь трафик идёт туда.`;

      const user = `Сценарий Reels на ${input.duration} по теме: «${input.title}».

Формат — строго по разделам, ничего не добавляй вне них:
**ХУК (0–3 с):** [одна фраза по одному из паттернов A–H из системного промпта]
**ТЕЛО (3–${input.duration === "15-30s" ? "25" : "50"} с):** [личный пример или 1–3 микро-шага с тайм-кодами через "—"]
**ТРИГГЕР (${input.duration === "15-30s" ? "25–28" : "50–58"} с):** [эмоциональный пик]
**CTA (последние 2–3 с):** [конкретный призыв забрать гайд/разбор в боте]
**КАДРЫ:** [3–4 буллета описаний планов в квадратных скобках]`;

      const script = await callLLM(system, user);
      return { script, title: input.title, duration: input.duration };
    }),

  /* ---------- HOOK VARIATIONS — новая фича ---------- */
  generateHooks: publicProcedure
    .input(
      z.object({
        title: z.string().min(5),
        count: z.number().int().min(3).max(10).default(7),
      })
    )
    .mutation(async ({ input }) => {
      const system = `${SERBOLIN_SYSTEM}

Текущая задача: альтернативные первые фразы (хуки). Каждый хук —
самостоятельная короткая строка 6–14 слов. Без эмодзи. Без «вы».
Хуки должны опираться на блок «ВИРАЛЬНЫЕ ПАТТЕРНЫ ЗАГОЛОВКОВ» (паттерны
A–H) из системного промпта — это выжимка из анализа 20 топовых
фитнес-блогеров. Распределяй ${input.count} хуков по РАЗНЫМ паттернам, не
дублируй один и тот же паттерн в соседних строках.`;

      const user = `Дай ${input.count} разных хуков для контента на тему «${input.title}».
По одному в строке. Без нумерации, без префиксов. Без кавычек.

Распредели хуки минимум по 4 разным паттернам из списка:
A. Отрицание клише («Кардио не нужно»)
B. Быстрый результат с цифрой («Пресс за 14 дней»)
C. Провокационный вопрос («Сколько раз ты уже бросала?»)
D. Локальная проблема (ягодицы / отёки / живот / осанка / ушки)
E. Ошибки и исправления («3 ошибки в приседе»)
F. Секрет или разоблачение мифа («Правда про жир на животе»)
G. Личная история эксперта («Я тоже думал, что...»)
H. Ожидание vs реальность («Думала, нужен час — хватило 12 минут»)

В каждом хуке должно быть минимум одно: конкретная цифра, узнаваемая боль
ЦА, или контекст «без чего-то».`;

      const raw = await callLLM(system, user);
      const hooks = raw
        .split("\n")
        .map((l) => l.replace(/^[\s•\-*\d.»"«]+/, "").trim())
        .filter((l) => l.length > 4 && l.length < 220)
        .slice(0, input.count);

      return { hooks, title: input.title };
    }),

  /* ---------- HASHTAGS — новая фича ---------- */
  generateHashtags: publicProcedure
    .input(
      z.object({
        title: z.string().min(5),
        platform: z.enum(["instagram", "telegram"]).default("instagram"),
      })
    )
    .mutation(async ({ input }) => {
      const system = `${SERBOLIN_SYSTEM}

Текущая задача: подбор хештегов. Без spam-тегов вида #fitness2024. Только релевантные.
Смешай категории: тема, аудитория, ниша, бренд.`;

      const user = `Подбери 15 хештегов для ${input.platform} к теме «${input.title}».
Выдай одной строкой через пробел, начиная с #. Без объяснений.`;

      const raw = await callLLM(system, user);
      const tags = Array.from(
        new Set(
          raw
            .replace(/[\n,]/g, " ")
            .split(/\s+/)
            .filter((t) => t.startsWith("#") && t.length > 2)
        )
      ).slice(0, 20);

      return { hashtags: tags, title: input.title };
    }),

  /* ---------- CAROUSEL — новая фича ---------- */
  generateCarousel: publicProcedure
    .input(
      z.object({
        title: z.string().min(5),
        slides: z.number().int().min(5).max(10).default(7),
      })
    )
    .mutation(async ({ input }) => {
      const system = `${SERBOLIN_SYSTEM}

Текущая задача: контент-карусель для Instagram (${input.slides} слайдов).
Один слайд — одна мысль. Короткие фразы. Sentence case.`;

      const user = `Карусель на ${input.slides} слайдов по теме «${input.title}».
Формат — каждый слайд отдельным блоком:
СЛАЙД 1 — заголовок (≤ 7 слов):
текст (1–2 короткие фразы, ≤ 25 слов всего)

Слайд 1 — обложка-хук. Последний слайд — CTA в духе «Напиши Эдуарду» или «Забери план».`;

      const carousel = await callLLM(system, user);
      return { carousel, slides: input.slides, title: input.title };
    }),

  /* ---------- BRAND-VOICE VALIDATOR — новая фича ---------- */
  validateVoice: publicProcedure
    .input(z.object({ text: z.string().min(20) }))
    .query(({ input }) => {
      const text = input.text;
      const issues: { rule: string; example: string; severity: "warn" | "error" }[] =
        [];

      const forbidden: { re: RegExp; rule: string; severity: "warn" | "error" }[] = [
        { re: /\bвы\b|\bвас\b|\bвам\b|\bвами\b/gi, rule: "Обращение на «вы» — нужно «ты»", severity: "error" },
        { re: /\bданн(ый|ая|ое|ые)\b/gi, rule: "Канцеляризм «данный»", severity: "error" },
        { re: /\bосуществ(ить|ляется|ление)\b/gi, rule: "Канцеляризм «осуществить»", severity: "error" },
        { re: /в\s+рамках\b/gi, rule: "Канцеляризм «в рамках»", severity: "warn" },
        { re: /согласно\s+регламент/gi, rule: "Канцеляризм «согласно регламенту»", severity: "warn" },
        { re: /как\s+всем\s+известно/gi, rule: "Покровительство «как всем известно»", severity: "error" },
        { re: /очевидно,?\s+что/gi, rule: "Покровительство «очевидно, что»", severity: "warn" },
        { re: /купи\s+сейчас/gi, rule: "Агрессивный sales «купи сейчас»", severity: "error" },
        { re: /успей\s+до/gi, rule: "Countdown-давление «успей до»", severity: "warn" },
      ];

      for (const f of forbidden) {
        const m = text.match(f.re);
        if (m) issues.push({ rule: f.rule, example: m[0], severity: f.severity });
      }

      // Эмодзи у Эдуарда — часть подачи (см. brand-knowledge.ts → VOICE_TICS).
      // Запрещаем только реальный спам (декоративные гирлянды): больше 30
      // эмодзи на пост или больше 4 одного типа подряд вне фирменного
      // разделителя 🤝🤝🤝🤝🤝🤝🤝🤝🤝.
      const emojiMatches = text.match(/[\uD83C-\uD83E]./g);
      const emojiCount = emojiMatches?.length ?? 0;
      if (emojiCount > 30) {
        issues.push({
          rule: `Эмодзи > 30 (${emojiCount}) — слишком много даже для стиля Эдуарда.`,
          example: emojiMatches!.slice(0, 6).join(""),
          severity: "warn",
        });
      }

      // Score: 100 - 25 per error, -8 per warn, floor 0
      let score = 100;
      for (const i of issues) score -= i.severity === "error" ? 25 : 8;
      score = Math.max(0, score);

      return {
        score,
        passed: issues.filter((i) => i.severity === "error").length === 0,
        issues,
        wordCount: text.trim().split(/\s+/).length,
      };
    }),

  /* ---------- FULL PACK — пост + reels + хуки + хештеги одной кнопкой ---------- */
  generateFullPack: publicProcedure
    .input(
      z.object({
        title: z.string().min(5),
        platform: z.enum(["telegram", "instagram"]).default("instagram"),
      })
    )
    .mutation(async ({ input }) => {
      const system = `${SERBOLIN_SYSTEM}

Текущая задача: целый пакет контента вокруг одной темы.`;

      const user = `Тема: «${input.title}».
Платформа: ${input.platform}.
Сделай ОДИН ответ строго в формате JSON без обёртки в markdown-блок:
{
  "post": "<готовый пост 350–500 слов>",
  "reelsScript": "<сценарий reels 15–30 секунд с разделами ХУК/ТЕЛО/ТРИГГЕР/CTA>",
  "hooks": ["<хук1>", "<хук2>", "<хук3>", "<хук4>", "<хук5>"],
  "hashtags": ["#тег1", "#тег2", "..."],
  "caption": "<подпись 1–2 предложения для соцсетей>"
}
Без пояснений вне JSON.`;

      const raw = await callLLM(system, user);
      const cleaned = raw
        .replace(/^```(json)?/i, "")
        .replace(/```$/i, "")
        .trim();
      try {
        const parsed = JSON.parse(cleaned);
        return { ...parsed, title: input.title, platform: input.platform };
      } catch {
        return {
          post: raw,
          reelsScript: "",
          hooks: [],
          hashtags: [],
          caption: "",
          title: input.title,
          platform: input.platform,
          parseError: true,
        };
      }
    }),
});
