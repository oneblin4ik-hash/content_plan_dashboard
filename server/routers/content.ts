import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { invokeForUser } from "../_core/llm-guard";
import { getPerformanceContextStats } from "../_core/performance";
import { templateBlock } from "../_core/viral-templates";
import { recordGeneration } from "../_core/generation-history";

/* ============================================================
   Content Studio — Mr. Serbolin
   tRPC content router. LLM = Gemini 2.5 Flash via Forge proxy
   or direct AI Studio (server/_core/llm.ts).

   Brand voice + viral hook patterns + anti-AI checklist live in
   server/_core/brand-knowledge.ts. To tune what the generator
   knows about Mr. Serbolin (audience, slogans, voice rules, etc.)
   edit that file — not the prompts below.
   ============================================================ */

/* 8 тонов голоса — все совместимы с брендом Mr. Serbolin.
   Если добавляешь новый — синхронизируй с TONE_OPTIONS в
   client/src/pages/ContentGenerator.tsx. */
export const TONES = [
  "expert", "friend", "provocative",
  "tough_champion", "caring_mentor", "ironic_humor",
  "motivational_drive", "mythbuster",
] as const;
type Tone = typeof TONES[number];

const TONE_DESCRIPTIONS: Record<Tone, string> = {
  expert: "экспертный, авторитетный, с опорой на физиологию и опыт зала",
  friend: "дружеский, эмпатичный, как с подругой за чашкой кофе",
  provocative: "провокационный, цепляющий на эмоциях — но без жёлтых заголовков",
  tough_champion:
    "жёсткий чемпион: прямота, минимум сантиментов, выкладываешь как есть, " +
    "лёгкая колкость по лени и отговоркам — но без агрессии в адрес читателя",
  caring_mentor:
    "заботливый наставник: тёплый, поддерживающий тон, признаёшь сложность, " +
    "даёшь маленькие шаги, человек чувствует себя на твоей стороне",
  ironic_humor:
    "ироничный юмор: стёб, парадоксы, лёгкая самоирония Эдуарда, " +
    "разоблачение через смех, без сарказма в адрес читателя",
  motivational_drive:
    "мотивационный драйв: энергия, короткие рубленые фразы, призыв к действию " +
    "прямо сейчас — но через конкретный шаг, не через лозунги",
  mythbuster:
    "разоблачитель мифов: спокойно и с фактами объясняешь почему " +
    "общепринятое неверно, ссылки на физиологию и собственный опыт",
};

const formatBlock = (tone: string) =>
  TONE_DESCRIPTIONS[tone as Tone] ?? TONE_DESCRIPTIONS.expert;

/* 10 рубрик — задают структуру поста и подачу.
   Применяются и к режиму post, и к pack. */
export const RUBRICS = [
  "general", "lifehack", "overheard",
  "case", "personal_story", "myth_debunk",
  "checklist", "before_after", "q_and_a", "science",
] as const;
type Rubric = typeof RUBRICS[number];

const RUBRIC_BLUEPRINTS: Record<Rubric, string> = {
  general: "",
  lifehack:
    "ФОРМАТ: лайфхак. Один конкретный приём, который читатель применит " +
    "сегодня же. Без длинной теории, сразу «вот что делаешь».",
  overheard:
    "ФОРМАТ: рубрика «🎙 ПОДСЛУШАНО У ТРЕНЕРА». Начни с прямой реплики " +
    "клиента в кавычках (это должна быть типовая фраза, без реальных " +
    "имён). Дальше — реакция Эдуарда от первого лица. Без морали в финале.",
  case:
    "ФОРМАТ: кейс. Структура: краткая ситуация «до» (обобщённый клиент, " +
    "без реального имени) → что меняли по системе (3 шага с 🤝) → " +
    "реалистичный результат с диапазоном цифр → один урок-вывод для " +
    "читателя.",
  personal_story:
    "ФОРМАТ: личная история Эдуарда. Эпизод из жизни (зал, спорт, " +
    "карьера) → инсайт → как это применимо к читателю. Уместен геймерский " +
    "слой (задрот-геймер, прокачка персонажа) — он часть бренда.",
  myth_debunk:
    "ФОРМАТ: разбор мифа. 1) распространённое заблуждение (в кавычках), " +
    "2) почему это бред и откуда взялось, 3) что на самом деле, " +
    "4) что делать вместо этого. Спокойно, без снобизма.",
  checklist:
    "ФОРМАТ: чек-лист. 5–7 пунктов с маркером 🤝, каждый в одну фразу. " +
    "В шапке — для кого это и зачем. В конце — какие пункты приоритетные.",
  before_after:
    "ФОРМАТ: до/после. Опиши «до» (типовая ситуация, обобщённый клиент) " +
    "→ что изменили → как теперь. Цифры — реалистичный диапазон, не " +
    "вау-кейс. Подходит для постов с фото или клиентского трансформа.",
  q_and_a:
    "ФОРМАТ: вопрос-ответ. Начало — короткий типовой вопрос аудитории " +
    "(2–3 строки). Дальше — ответ Эдуарда: разбор + 1–2 конкретных шага. " +
    "Никакого «отличный вопрос» — сразу к делу.",
  science:
    "ФОРМАТ: научный разбор. Простой язык, опора на физиологию или " +
    "конкретное исследование. Если ссылаешься на «свежие исследования» — " +
    "указывай год и направление, а не выдумывай конкретные проценты.",
};

const buildRubricBlock = (rubric: string) =>
  RUBRIC_BLUEPRINTS[rubric as Rubric] ?? "";

/* Лёгкий endpoint для UI Студии — показывает badge «учитывает N
   твоих постов и K конкурентов». Помогает юзеру понять, что петля
   работает (или что её нужно «заполнить»). */
const contextStatsProcedure = protectedProcedure.query(({ ctx }) =>
  getPerformanceContextStats(ctx.user.id),
);

export const contentRouter = router({
  contextStats: contextStatsProcedure,

  /* ---------- POST ---------- */
  generatePost: protectedProcedure
    .input(
      z.object({
        title: z.string().min(5, "Заголовок минимум 5 символов"),
        tone: z.enum(TONES).default("expert"),
        platform: z.enum(["telegram", "instagram"]).default("telegram"),
        length: z.enum(["short", "medium", "long"]).default("medium"),
        rubric: z.enum(RUBRICS).default("general"),
        /* Опциональный вирусный шаблон (P1.1). Если указан, в
           system добавляется блок «жёстко следуй такой структуре».
           Если шаблон неизвестен — игнорируем тихо. */
        templateId: z.string().max(60).optional(),
      })
      )
      .mutation(async ({ input, ctx }) => {
      const lengthWords =
        input.length === "short"
          ? "180–280 слов"
          : input.length === "long"
            ? "600–900 слов"
            : "350–500 слов";

      const rubricBlock = buildRubricBlock(input.rubric);
      const tmplBlock = templateBlock(input.templateId);
      const system = `Текущая задача: ${formatBlock(input.tone)} пост для ${
        input.platform === "telegram" ? "Telegram" : "Instagram"
      }.
${rubricBlock ? rubricBlock + "\n" : ""}Сегмент аудитории по умолчанию — женщины 25–45 (если в теме явно не указан
другой сегмент, например IT-предприниматель или мужчина 30+).${tmplBlock}`;

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

      const { text: post, model } = await invokeForUser(ctx.user, system, user);
      const result = {
        post,
        title: input.title,
        platform: input.platform,
        tone: input.tone,
        length: input.length,
        rubric: input.rubric,
        templateId: input.templateId ?? null,
        model,
      };
      /* В историю — для сравнения версий (P1.2). Не await'им —
         запись истории не должна замедлять ответ юзеру. Workers
         кладёт промис в ctx.waitUntil? У нас нет ctx env здесь, но
         JSON.stringify+INSERT занимает <10ms, можно await. */
      await recordGeneration({
        userId: ctx.user.id,
        kind: "post",
        title: input.title,
        payload: result,
      });
      return result;
    }),

  /* ---------- REELS SCRIPT ---------- */
  generateReelsScript: protectedProcedure
    .input(
      z.object({
        title: z.string().min(5),
        duration: z.enum(["15-30s", "30-60s"]).default("15-30s"),
      })
      )
      .mutation(async ({ input, ctx }) => {
      const system = `Текущая задача: вирусный сценарий Reels по формуле «БОЛЬ → РЕШЕНИЕ → CTA В БОТ»
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

      const { text: script, model } = await invokeForUser(ctx.user, system, user);
      return { script, title: input.title, duration: input.duration, model };
    }),

  /* ---------- HOOK VARIATIONS — со scoring'ом (idea #6) ---------- */
  generateHooks: protectedProcedure
    .input(
      z.object({
        title: z.string().min(5),
        count: z.number().int().min(3).max(10).default(7),
      })
      )
      .mutation(async ({ input, ctx }) => {
      const system = `Текущая задача: сгенерировать N виральных хуков + оценить каждый по
predicted engagement (1-10). Опирайся на блок «ВИРАЛЬНЫЕ ПАТТЕРНЫ
ЗАГОЛОВКОВ» (паттерны A-H) из системного промпта — это выжимка из
анализа 20 топовых фитнес-блогеров. Используй минимум 4 разных
паттерна в наборе из ${input.count} хуков.

КРИТЕРИИ СКОРИНГА (1-10):
- 9-10: попадает в острую боль ЦА, конкретная цифра/обещание, новизна,
  один из самых сильных паттернов (A/B/C/D).
- 7-8: цепляет, но без сильной конкретики или с уставшим паттерном.
- 5-6: грамотный, но «обычный» — без вау.
- ≤4: слабый, плоский, или нарушение бренд-голоса (нельзя выдавать).
Чем выше score, тем выше ожидаемый CTR/ER. Будь честным —
не лепи всем 9. Среди ${input.count} хуков должно быть 1-2 уверенных
9-10, остальные — реалистично 6-8.`;

      const user = `Тема: «${input.title}».
Сгенерируй ${input.count} хуков. Каждый — самостоятельная фраза 6-14 слов,
без эмодзи, без «вы», без нумерации. Распредели по разным паттернам.

Выдай результат строго в JSON без markdown-обёрток:
{
  "hooks": [
    {
      "text": "Кардио не нужно — миф 2026",
      "pattern": "A",
      "score": 9,
      "reason": "острое отрицание клише + конкретный год = свежо и кликабельно"
    }
  ]
}`;

      const { text: raw, model } = await invokeForUser(ctx.user, system, user);
      const cleaned = raw
        .replace(/^```(json)?/i, "")
        .replace(/```$/i, "")
        .trim();

      type ScoredHook = {
        text: string;
        pattern: string;
        score: number;
        reason: string;
      };
      let hooks: ScoredHook[] = [];
      try {
        const parsed = JSON.parse(cleaned) as { hooks: ScoredHook[] };
        hooks = (parsed.hooks ?? []).filter(
          (h) =>
            typeof h.text === "string" &&
            h.text.length > 4 &&
            h.text.length < 220
        );
      } catch {
        /* Если LLM сорвался и не отдал JSON — фолбэк к старому формату:
           парсим построчно, ставим всем дефолтный score 7. */
        hooks = cleaned
          .split("\n")
          .map((l) => l.replace(/^[\s•\-*\d.»"«]+/, "").trim())
          .filter((l) => l.length > 4 && l.length < 220)
          .slice(0, input.count)
          .map((text) => ({
            text,
            pattern: "?",
            score: 7,
            reason: "auto-fallback: LLM не отдал JSON",
          }));
      }
      /* Сортируем по убыванию score, чтобы лучшие были сверху. */
      hooks.sort((a, b) => b.score - a.score);
      hooks = hooks.slice(0, input.count);

      return { hooks, title: input.title, model };
    }),

  /* ---------- HASHTAGS — новая фича ---------- */
  generateHashtags: protectedProcedure
    .input(
      z.object({
        title: z.string().min(5),
        platform: z.enum(["instagram", "telegram"]).default("instagram"),
      })
      )
      .mutation(async ({ input, ctx }) => {
      const system = `Текущая задача: подбор хештегов. Без spam-тегов вида #fitness2024. Только релевантные.
Смешай категории: тема, аудитория, ниша, бренд.`;

      const user = `Подбери 15 хештегов для ${input.platform} к теме «${input.title}».
Выдай одной строкой через пробел, начиная с #. Без объяснений.`;

      const { text: raw, model } = await invokeForUser(ctx.user, system, user);
      const tags = Array.from(
        new Set(
          raw
            .replace(/[\n,]/g, " ")
            .split(/\s+/)
            .filter((t) => t.startsWith("#") && t.length > 2)
        )
      ).slice(0, 20);

      return { hashtags: tags, title: input.title, model };
    }),

  /* ---------- CAROUSEL — новая фича ---------- */
  generateCarousel: protectedProcedure
    .input(
      z.object({
        title: z.string().min(5),
        slides: z.number().int().min(5).max(10).default(7),
      })
      )
      .mutation(async ({ input, ctx }) => {
      const system = `Текущая задача: контент-карусель для Instagram (${input.slides} слайдов).
Один слайд — одна мысль. Короткие фразы. Sentence case.`;

      const user = `Карусель на ${input.slides} слайдов по теме «${input.title}».
Формат — каждый слайд отдельным блоком:
СЛАЙД 1 — заголовок (≤ 7 слов):
текст (1–2 короткие фразы, ≤ 25 слов всего)

Слайд 1 — обложка-хук. Последний слайд — CTA в духе «Напиши Эдуарду» или «Забери план».`;

      const { text: carousel, model } = await invokeForUser(ctx.user, system, user);
      return { carousel, slides: input.slides, title: input.title, model };
    }),

  /* ---------- CAROUSEL STUDIO — структурированные слайды ----------
     Для визуального конструктора (/carousel) нужен не текстовый блок,
     а массив слайдов с ролями (cover/content/cta), заголовком и телом.
     Возвращаем строгий JSON, парсим и чистим. */
  generateCarouselSlides: protectedProcedure
    .input(
      z.object({
        title: z.string().min(5),
        slides: z.number().int().min(3).max(12).default(7),
        segment: z
          .enum(["women_25_45", "men_30_45", "ambitious_pro", "mixed"])
          .default("mixed"),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const segmentHint =
        input.segment === "women_25_45"
          ? "Женщины 25-45: похудение, отёки, нет времени, психология срывов."
          : input.segment === "men_30_45"
            ? "Мужчины 30-45: офис, лишний вес, грудь/руки, практичное питание."
            : input.segment === "ambitious_pro"
              ? "Амбициозные профи 30-45: статус, биохакинг, плато, стресс."
              : "Смешанная ЦА.";

      const system = `Текущая задача: контент-карусель для Instagram на ${input.slides} слайдов.
ЦА: ${segmentHint}
Правила слайдов:
- Слайд 1 — ОБЛОЖКА: мощный кликбейт-хук (≤ 8 слов в headline) + подзаголовок-крючок (≤ 12 слов).
- Средние слайды — КОНТЕНТ: одна мысль на слайд. headline ≤ 6 слов, body 1-2 коротких фразы (≤ 22 слова).
- Последний слайд — CTA: призыв (написать Эдуарду / забрать план / подписаться).
Голос Эдуарда: «ты», без канцелярита, можно эмодзи в меру.`;

      const user = `Тема карусели: «${input.title}».
Сделай ровно ${input.slides} слайдов. Верни строго JSON без markdown:
{
  "slides": [
    { "kind": "cover", "headline": "...", "body": "..." },
    { "kind": "content", "headline": "...", "body": "..." },
    { "kind": "cta", "headline": "...", "body": "..." }
  ]
}
Первый слайд kind=cover, последний kind=cta, остальные kind=content.`;

      const { text: raw, model } = await invokeForUser(ctx.user, system, user);
      const cleaned = raw
        .replace(/^```(json)?/i, "")
        .replace(/```$/i, "")
        .trim();
      type Slide = { kind: string; headline: string; body: string };
      let slides: Slide[] = [];
      try {
        const parsed = JSON.parse(cleaned) as { slides: Slide[] };
        slides = (parsed.slides ?? [])
          .filter(
            (s) =>
              typeof s.headline === "string" && s.headline.trim().length > 0,
          )
          .map((s, i, arr) => ({
            kind:
              i === 0
                ? "cover"
                : i === arr.length - 1
                  ? "cta"
                  : s.kind === "cover" || s.kind === "cta"
                    ? "content"
                    : s.kind || "content",
            headline: s.headline.trim().slice(0, 120),
            body: (s.body ?? "").trim().slice(0, 280),
          }));
      } catch {
        throw new Error(
          `LLM не вернул валидный JSON слайдов: ${cleaned.slice(0, 200)}`,
        );
      }
      if (slides.length === 0) {
        throw new Error("Не удалось сгенерировать слайды, попробуй ещё раз.");
      }
      return { slides, title: input.title, model };
    }),

  /* ---------- BRAND-VOICE VALIDATOR — новая фича ---------- */
  validateVoice: protectedProcedure
    .input(z.object({ text: z.string().min(20) }))
    .query(({ input, ctx }) => {
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

  /* ---------- REFINE — итеративная правка готового текста ---------- */
  refine: protectedProcedure
    .input(
      z.object({
        original: z.string().min(20, "Слишком короткий исходный текст"),
        instruction: z.string().min(3, "Опиши, что поправить"),
        kind: z
          .enum(["post", "reels", "carousel", "hook", "free"])
          .default("free"),
      })
      )
      .mutation(async ({ input, ctx }) => {
      const kindHint =
        input.kind === "reels"
          ? "Это сценарий Reels — сохрани таймкоды и разделы (ХУК/ТЕЛО/ТРИГГЕР/CTA/КАДРЫ)."
          : input.kind === "carousel"
            ? "Это карусель — сохрани разбивку на слайды, заголовки и количество слайдов."
            : input.kind === "hook"
              ? "Это набор хуков по одному в строке — сохрани формат строк."
              : input.kind === "post"
                ? "Это пост — сохрани общую структуру и подачу, правь точечно."
                : "";

      const system = `Текущая задача: точечная правка готового текста по инструкции пользователя.
ВАЖНО:
- Меняй ТОЛЬКО то, что просит инструкция. Не переписывай заново.
- Сохраняй бренд-голос Эдуарда даже если инструкция этого не требует.
- ${kindHint || "Сохрани общий формат и тип контента."}
- Не добавляй преамбулы «Вот доработанная версия:» — выдай только готовый текст.`;

      const user = `ИСХОДНЫЙ ТЕКСТ:
"""
${input.original}
"""

ИНСТРУКЦИЯ ПО ПРАВКЕ:
${input.instruction}

Выдай только финальный отредактированный текст.`;

      const { text: refined, model } = await invokeForUser(ctx.user, system, user);
      return { refined, kind: input.kind, model };
    }),

  /* ---------- FULL PACK — пост + reels + хуки + хештеги одной кнопкой ---------- */
  generateFullPack: protectedProcedure
    .input(
      z.object({
        title: z.string().min(5),
        platform: z.enum(["telegram", "instagram"]).default("instagram"),
        tone: z.enum(TONES).default("expert"),
        rubric: z.enum(RUBRICS).default("general"),
      })
      )
      .mutation(async ({ input, ctx }) => {
      const rubricBlock = buildRubricBlock(input.rubric);
      const system = `Текущая задача: целый пакет контента вокруг одной темы.
Тон поста: ${formatBlock(input.tone)}.
${rubricBlock ? rubricBlock + "\n" : ""}`;

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

      const { text: raw, model } = await invokeForUser(ctx.user, system, user);
      const cleaned = raw
        .replace(/^```(json)?/i, "")
        .replace(/```$/i, "")
        .trim();
      try {
        const parsed = JSON.parse(cleaned);
        return { ...parsed, title: input.title, platform: input.platform, model };
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
          model,
        };
      }
    }),

  /* ---------- MONTH PLAN — авто-план публикаций (idea #1) ---------- */
  generateMonthPlan: protectedProcedure
    .input(
      z.object({
        startDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "Формат YYYY-MM-DD"),
        weeksCount: z.number().int().min(1).max(8).default(4),
        postsPerWeek: z.number().int().min(1).max(7).default(3),
        segment: z
          .enum(["women_25_45", "men_30_45", "ambitious_pro", "mixed"])
          .default("mixed"),
        platform: z.enum(["telegram", "instagram"]).default("telegram"),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const total = input.weeksCount * input.postsPerWeek;
      const segmentHint =
        input.segment === "women_25_45"
          ? "Основная ЦА — женщины 25-45, домохозяйки и офисные сотрудницы. Боли: похудение, ягодицы, отёки, психология срывов, нет времени."
          : input.segment === "men_30_45"
            ? "Основная ЦА — мужчины 30-45, офис и предприниматели. Боли: сидячая работа, лишний вес, нет времени, не хотят заморачиваться с едой."
            : input.segment === "ambitious_pro"
              ? "Основная ЦА — амбициозные профи 30-45 с высоким чеком. Боли: плато, стресс, нужна логика и системность."
              : "Смешанная ЦА — чередуй посты под разные сегменты.";

      const system = `Текущая задача: построить контент-план на ${input.weeksCount} недель
(${total} публикаций) для ${
        input.platform === "telegram" ? "Telegram" : "Instagram"
      }.

ЦА: ${segmentHint}

ПРИНЦИПЫ РАСПРЕДЕЛЕНИЯ (опирайся на анализ соцсетей из системного промпта):
- ${input.postsPerWeek} публикаций в неделю. Распредели НЕРАВНОМЕРНО, как
  в реальной жизни: больше во вторник-четверг-пятницу-воскресенье,
  меньше в понедельник/субботу. Не клади всё подряд.
- ЧЕРЕДУЙ ТИПЫ В НЕДЕЛЕ (из «ФОРМУЛ КОНТЕНТА» в системном промпте):
  кейс / личное мнение-драйв / продажа через пользу. Не два кейса
  подряд, не два мифоразбора подряд.
- ЧЕРЕДУЙ РУБРИКИ: lifehack, overheard, case, personal_story,
  myth_debunk, checklist, before_after, q_and_a, science.
- ЧЕРЕДУЙ ТОНЫ: expert, friend, provocative, tough_champion,
  caring_mentor, ironic_humor, motivational_drive, mythbuster. Не
  больше двух одинаковых тонов в неделе.
- Темы — конкретные («Челлендж СТОП ОТЁКИ за 7 дней»), а не общие
  («про отёки»). Используй виральные паттерны из системного промпта.
- Старт публикаций — со ${input.startDate}.`;

      const user = `Сгенерируй ${total} публикаций. Выдай результат строго в
JSON без markdown-обёртки:
{
  "items": [
    {
      "date": "YYYY-MM-DD",
      "title": "конкретная тема, 5-10 слов",
      "format": "post | reels | carousel | story",
      "rubric": "general | lifehack | overheard | case | personal_story | myth_debunk | checklist | before_after | q_and_a | science",
      "tone": "expert | friend | provocative | tough_champion | caring_mentor | ironic_humor | motivational_drive | mythbuster",
      "why": "одна фраза, почему эта тема в этот день под эту ЦА"
    }
  ]
}

В items должно быть РОВНО ${total} элементов. Даты — корректные ISO-даты
${input.weeksCount * 7} дней начиная с ${input.startDate}.`;

      const { text: raw, model } = await invokeForUser(ctx.user, system, user);
      const cleaned = raw
        .replace(/^```(json)?/i, "")
        .replace(/```$/i, "")
        .trim();
      type PlanItem = {
        date: string;
        title: string;
        format: string;
        rubric: string;
        tone: string;
        why: string;
      };
      let items: PlanItem[] = [];
      try {
        const parsed = JSON.parse(cleaned) as { items: PlanItem[] };
        items = (parsed.items ?? [])
          .filter(
            (x) =>
              typeof x.date === "string" &&
              /^\d{4}-\d{2}-\d{2}$/.test(x.date) &&
              typeof x.title === "string" &&
              x.title.length > 2,
          )
          .slice(0, total);
      } catch {
        throw new Error(
          `LLM не вернул валидный JSON. Сырой ответ: ${cleaned.slice(0, 300)}`,
        );
      }
      return { items, total, startDate: input.startDate, model };
    }),
});
