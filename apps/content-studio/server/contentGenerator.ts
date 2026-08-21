export type StudioMode = "reels_topics" | "telegram_topics" | "reels_script" | "telegram_post";

export type ContentGenerationMode = StudioMode | "strategy_checklist" | "weekly_content_pack";

export type WeeklyContentPack = {
  reelsTopic: string;
  reelsHook: string;
  reelsScenes: Array<{ time: string; shot: string; speech: string; caption: string; edit: string }>;
  telegramTopic: string;
  telegramPost: string;
};

export type GenerationInput = {
  mode: ContentGenerationMode;
  topic: string;
  goal: string;
  strategyGoal: string;
  segment: { id: string; name: string; pain: string; fear: string; trigger: string };
  voice: { name: string; tone: string; address: string; energy: string; structure: string; proof: string; cta: string; avoid: string; notes: string };
  length: "short" | "medium" | "long";
  formula?: string;
  structure?: string;
  cta?: string;
};

export type GenerationOutput = {
  mode: ContentGenerationMode;
  headline: string;
  summary: string;
  items: string[];
  content: string;
  cta: string;
  scenes: Array<{ time: string; shot: string; speech: string; caption: string; edit: string }>;
  nextStep: string;
  weekly: WeeklyContentPack;
};

const allowedModes: ContentGenerationMode[] = ["reels_topics", "telegram_topics", "reels_script", "telegram_post", "strategy_checklist", "weekly_content_pack"];

function safeText(value: unknown, limit = 1800) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

export function validateGenerationInput(value: unknown): GenerationInput {
  const raw = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const mode = raw.mode as ContentGenerationMode;
  if (!allowedModes.includes(mode)) throw new Error("Неизвестный режим генерации.");
  const segment = (raw.segment && typeof raw.segment === "object" ? raw.segment : {}) as Record<string, unknown>;
  const voice = (raw.voice && typeof raw.voice === "object" ? raw.voice : {}) as Record<string, unknown>;
  const length = raw.length === "short" || raw.length === "long" ? raw.length : "medium";
  return {
    mode,
    topic: safeText(raw.topic, 500) || "Похудение без срывов",
    goal: safeText(raw.goal, 300) || "вовлечение и переход в Telegram",
    strategyGoal: safeText(raw.strategyGoal, 600) || "выстроить регулярный контент, который помогает аудитории и приводит к консультации",
    segment: { id: safeText(segment.id, 20) || "S3", name: safeText(segment.name, 120) || "занятая женщина", pain: safeText(segment.pain, 400), fear: safeText(segment.fear, 400), trigger: safeText(segment.trigger, 400) },
    voice: { name: safeText(voice.name, 120), tone: safeText(voice.tone, 300), address: safeText(voice.address, 80), energy: safeText(voice.energy, 160), structure: safeText(voice.structure, 400), proof: safeText(voice.proof, 300), cta: safeText(voice.cta, 300), avoid: safeText(voice.avoid, 300), notes: safeText(voice.notes, 600) },
    length,
    formula: safeText(raw.formula, 600),
    structure: safeText(raw.structure, 500),
    cta: safeText(raw.cta, 300),
  };
}

export function buildGeneratorMessages(input: GenerationInput) {
  const modeDirections: Record<ContentGenerationMode, string> = {
    reels_topics: "Создай ровно 8 самостоятельных тем Reels. В каждом элементе items: цепляющее название, первая фраза-хук, формат и мягкий CTA. content оставь пустой строкой. Каждая тема должна быть проверяемой, жизненной и без медицинских обещаний.",
    telegram_topics: "Создай ровно 8 тем Telegram-постов. В каждом элементе items: заголовок, главный тезис, конфликт/миф и вопрос либо CTA. content оставь пустой строкой. Темы должны вести из Instagram в Telegram и к диагностике без давления.",
    reels_script: "Создай готовый покадровый сценарий Reels. В scenes верни ровно 5 кадров. Построй мини-историю: конкретная бытовая сцена → конфликт или ставка → разворот/решение → один применимый следующий шаг. Обязательно используй структуру: 0–2 сек стоп-кадр и текст, 2–5 сек обещание, 5–14 сек конфликт/доказательство, 14–22 сек один ответ, финал CTA и петля. В каждом кадре явно заполни время, визуал, текст на экране, речь и монтаж/звук. В content дай короткий production summary. Один ролик — одна проблема и один следующий шаг. Если для истории не дана личная деталь, используй только нейтральную бытовую сцену из брифа, не выдавай её за реальный случай автора или клиентки.",
    telegram_post: "Напиши законченный Telegram-пост. Используй выбранную структуру и выбранный CTA. Построй текст как короткую историю: конкретный бытовой контекст → честный конфликт/препятствие → понятный разворот → применимый следующий шаг. Используй ударный заголовок, бытовой пример и ненавязчивый CTA. Не пиши канцелярски, не обещай гарантированный медицинский результат и не имитируй отзыв клиента.",
    strategy_checklist: "Создай ровно 7 пунктов персонального чек-листа для автора. Каждый пункт items начинай с понятного глагола и делай выполнимым за один рабочий шаг. Чек-лист должен помогать приблизиться к главной цели автора через Reels, Telegram, аналитику и понятный CTA. Не выдумывай факты, бюджеты, результаты или даты. content оставь пустой строкой, scenes верни пустым массивом, в nextStep дай первый самый простой шаг.",
    weekly_content_pack: "Собери один недельный пакет контента для выбранного сегмента и цели. В weekly.reelsTopic дай одну тему Reels, в weekly.reelsHook — первую фразу-хук, а в weekly.reelsScenes верни ровно 5 кадров полноценного сценария Reels: время, визуал, речь, текст на экране и монтаж. В weekly.telegramTopic дай тему Telegram-поста, а в weekly.telegramPost — готовый пост: сильный заголовок → конкретная бытовая ситуация → конфликт «но / поэтому» → понятный разворот → один следующий шаг → мягкий CTA. Instagram и Telegram должны раскрывать одну недельную идею с разных сторон, но не повторять друг друга дословно. В items верни короткие названия четырёх готовых материалов. content оставь пустой строкой, scenes верни пустым массивом, а в nextStep укажи, что снимать или публиковать первым.",
  };
  const size = input.length === "short" ? "короткий" : input.length === "long" ? "развернутый" : "средний";
  const system = `Ты — сильный русскоязычный контент-стратег и редактор для онлайн-фитнес тренера. Пиши только на русском. Аудитория: женщины 25–45, часто с детьми и работой, хотят похудеть, быть здоровыми и выглядеть спортивно. Никогда не давай опасных медицинских советов, не придумывай отзывы, цифры, результаты клиентов, личные случаи или дословные реплики, которых нет в брифе.

Для Reels-сценариев и Telegram-постов применяй правила сильного сторителлинга: входи в конкретную ситуацию или действие без длинного разгона; создавай реальный конфликт «но / поэтому», а не перечисление «и потом»; держи одну главную мысль и один следующий шаг; заканчивай выводом, который оставляет послевкусие. Если конкретной сцены или детали нет в брифе, не выдумывай её — используй общий узнаваемый быт целевого сегмента без притворства, что это реальная история.

Сделай финальную редактуру живого русского текста: сохраняй голос автора, обращение и энергию из Tone of Voice; чередуй короткие и более развёрнутые фразы; убирай канцелярит, пустые заходы, шаблонные выводы, чрезмерно гладкие конструкции и повторяющиеся связки. Не добавляй ошибки, сленг или искусственную «неровность». Возвращай строгий JSON без Markdown-обертки.`;
  const user = `Задача: ${modeDirections[input.mode]}

Тема/бриф: ${input.topic}
Задача этого материала: ${input.goal}
Главная цель контент-стратегии автора: ${input.strategyGoal}
Длина: ${size}
Сегмент: ${input.segment.id} — ${input.segment.name}
Боль: ${input.segment.pain}
Страх: ${input.segment.fear}
Триггер: ${input.segment.trigger}
Tone of Voice: ${input.voice.name}; тон: ${input.voice.tone}; обращение: ${input.voice.address}; энергия: ${input.voice.energy}; структура: ${input.voice.structure}; доказательство: ${input.voice.proof}; CTA: ${input.voice.cta}; избегать: ${input.voice.avoid}; заметки: ${input.voice.notes}
Формула Reels Lab: ${input.formula || "Ситуация → конфликт → ответ → доказательство → действие"}
Структура Telegram: ${input.structure || input.voice.structure}
Выбранный CTA: ${input.cta || input.voice.cta}

Верни JSON по схеме. В items добавляй список конкретных тем/блоков. В content пиши полностью готовый материал только для Reels-сценария или Telegram-поста; для режимов тем content — пустая строка. В scenes заполняй кадры только для Reels-сценария, для остальных режимов верни пустой массив. В cta верни один применимый призыв к действию. В nextStep — одно практическое действие автора. Поле weekly заполняй только для weekly_content_pack; для остальных режимов верни пустые строки и пустой массив reelsScenes.`;
  return { system, user };
}

export async function generateContent(raw: unknown): Promise<GenerationOutput> {
  const input = validateGenerationInput(raw);
  const baseUrl = (process.env.BUILT_IN_FORGE_API_URL || "").replace(/\/+$/, "");
  const apiKey = process.env.BUILT_IN_FORGE_API_KEY || "";
  if (!baseUrl || !apiKey) throw new Error("Сервис генерации пока недоступен. Попробуйте позже.");
  const messages = buildGeneratorMessages(input);
  const outputLimit = input.mode === "weekly_content_pack" ? 3600 : input.mode === "reels_topics" || input.mode === "telegram_topics" ? 850 : input.mode === "strategy_checklist" ? 700 : 1300;
  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(45_000),
    body: JSON.stringify({
      model: "gpt-5-mini",
      max_completion_tokens: outputLimit,
      reasoning: { effort: "minimal" },
      messages: [{ role: "system", content: messages.system }, { role: "user", content: messages.user }],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "content_studio_output",
          strict: true,
          schema: {
            type: "object",
            properties: {
              mode: { type: "string", enum: allowedModes },
              headline: { type: "string" },
              summary: { type: "string" },
              items: { type: "array", items: { type: "string" } },
              content: { type: "string" },
              cta: { type: "string" },
              scenes: { type: "array", items: { type: "object", properties: { time: { type: "string" }, shot: { type: "string" }, speech: { type: "string" }, caption: { type: "string" }, edit: { type: "string" } }, required: ["time", "shot", "speech", "caption", "edit"], additionalProperties: false } },
              nextStep: { type: "string" },
              weekly: {
                type: "object",
                properties: {
                  reelsTopic: { type: "string" },
                  reelsHook: { type: "string" },
                  reelsScenes: { type: "array", items: { type: "object", properties: { time: { type: "string" }, shot: { type: "string" }, speech: { type: "string" }, caption: { type: "string" }, edit: { type: "string" } }, required: ["time", "shot", "speech", "caption", "edit"], additionalProperties: false } },
                  telegramTopic: { type: "string" },
                  telegramPost: { type: "string" },
                },
                required: ["reelsTopic", "reelsHook", "reelsScenes", "telegramTopic", "telegramPost"],
                additionalProperties: false,
              },
            },
            required: ["mode", "headline", "summary", "items", "content", "cta", "scenes", "nextStep", "weekly"],
            additionalProperties: false,
          },
        },
      },
    }),
  });
  if (!response.ok) throw new Error(`Сервис генерации вернул ошибку ${response.status}.`);
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const text = payload.choices?.[0]?.message?.content || "";
  try {
    const result = JSON.parse(text) as GenerationOutput;
    return { ...result, mode: input.mode, items: Array.isArray(result.items) ? result.items.slice(0, 8) : [] };
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error("Не удалось обработать ответ генератора. Повторите запрос.");
    throw error;
  }
}
