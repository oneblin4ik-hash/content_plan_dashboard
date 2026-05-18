import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";

/* ============================================================
   Content Studio — Mr. Serbolin
   tRPC content router. LLM = Gemini 2.5 Flash via Forge proxy
   (server/_core/llm.ts). Voice locked to Serbolin brand:
   - всегда «ты», никогда «вы»
   - один акцент (золотой) → одна идея = один пост
   - без канцеляризмов, без агрессивного продаж-стиля
   - sentence case в заголовках
   ============================================================ */

const SERBOLIN_SYSTEM = `Ты — голос бренда Эдуарда Серболина (Mr. Serbolin).
Эдуард — персональный фитнес-тренер с 12-летним стажем, 2-кратный абсолютный
чемпион по бодибилдингу (Muscular 2022/2024), МСМК, чемпион мира по жиму.
Целевая аудитория: женщины 25–45, которым нужна система, а не марафон.

ПРАВИЛА ГОЛОСА (нарушение запрещено):
- ВСЕГДА обращение на «ты». «Вы» — никогда, ни в каком контексте.
- Без канцеляризмов: «данный», «осуществить», «в рамках», «согласно».
- Без покровительства: «как всем известно», «очевидно, что», «это все знают».
- Без агрессивного продаж-стиля: «купи сейчас!», countdown-давление, «успей».
- Без жалоб — всегда решение: «вот что сделаем», а не «вот почему сложно».
- Истории > факты. Победы и провалы показываем одинаково честно.
- Sentence case для заголовков. ALL-CAPS только в коротких ярлыках.
- Эмодзи практически не используем. Допустимо ≤2 и только если они контентно
  оправданы (например, ⚡ маркер пункта). Никаких декоративных гирлянд.

СЛОГАНЫ (используй верботно, не модифицируй):
- «Терпение + Дисциплина = Результат»
- «Будь в форме не к лету, а всегда»
- «Не жди результат — научись получать удовольствие от процесса»
- «Система важнее мотивации»`;

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
      }.`;

      const user = `Напиши готовый пост на тему: «${input.title}».

Структура:
1) Хук (2–3 строки, вызывают боль или интерес).
2) Тело (3–5 коротких абзацев, без воды).
3) Завершение вопросом для engagement.

Объём: ${lengthWords}.
Никаких подзаголовков «Хук:» «Тело:» — выдай только готовый текст.`;

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

Текущая задача: вирусный сценарий Reels. Архетип — справедливый друг-эксперт.
Тон умеренно жёсткий, контраст, парадокс. Без жёлтых заголовков.`;

      const user = `Сценарий Reels на ${input.duration} по теме: «${input.title}».

Формат — строго по разделам, ничего не добавляй вне их:
**ХУК (0–3 с):** [одна фраза, вызывающая боль или удивление]
**ТЕЛО (3–${input.duration === "15-30s" ? "25" : "50"} с):** [основной аргумент с тайм-кодами через "—"]
**ТРИГГЕР (${input.duration === "15-30s" ? "25–28" : "50–58"} с):** [эмоциональный пик]
**CTA (последние 2–3 с):** [действие]
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

Текущая задача: альтернативные первые фразы (хуки). Каждый хук — самостоятельная
короткая строка 6–14 слов. Без эмодзи. Без «вы».`;

      const user = `Дай ${input.count} разных хуков для контента на тему «${input.title}».
По одному в строке. Без нумерации, без префиксов. Без кавычек.
Каждый хук — отдельный паттерн: вопрос / парадокс / личный шок / разоблачение / статистика / признание / вызов.`;

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

      // Emoji budget — не больше 2 эмодзи на пост
      // Emoji-ish detection without /u flag (tsconfig target compatibility):
      // count high-surrogate code units (most pictographs sit in supplementary
      // planes encoded as surrogate pairs).
      const emojiMatches = text.match(/[\uD83C-\uD83E]./g);
      const emojiCount = emojiMatches?.length ?? 0;
      if (emojiCount > 2) {
        issues.push({
          rule: `Эмодзи > 2 (${emojiCount}). Бренд использует эмодзи только когда они и есть контент.`,
          example: emojiMatches!.slice(0, 5).join(""),
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
