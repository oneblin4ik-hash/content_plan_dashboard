/* ============================================================
   Telegram Bot webhook handler — идея #9 («бот как второй интерфейс»).

   Эдуард пишет боту обычное сообщение или команду — Worker
   генерирует контент через invokeLLM и отвечает с inline-клавиатурой
   (заново / отправить в канал / открыть в студии).

   Security: бот реагирует только на чаты, чей id совпадает с
   process.env.TELEGRAM_CHAT_ID. Сторонние юзеры получат отказ.
   ============================================================ */

import { invokeLLM } from "../server/_core/llm";
import { SERBOLIN_SYSTEM_PROMPT } from "../server/_core/brand-knowledge";

const APP_URL = "https://content-studio.one-blin4ik.workers.dev";

type TgUpdate = {
  message?: {
    message_id: number;
    chat: { id: number };
    from?: { id: number };
    text?: string;
  };
  callback_query?: {
    id: string;
    from: { id: number };
    message?: {
      chat: { id: number };
      message_id: number;
      text?: string;
    };
    data?: string;
  };
};

type Kind = "post" | "reels" | "hooks";

const HELP =
  "🤝 Привет, на связи студия Эдуарда.\n\n" +
  "Я могу:\n" +
  "• /post <тема> — готовый пост\n" +
  "• /reels <тема> — сценарий Reels 15–30 с\n" +
  "• /hooks <тема> — 5 виральных хуков\n\n" +
  "Или просто пиши тему — соберу пост по умолчанию.\n" +
  "После генерации — кнопки «Заново», «В канал», «Открыть в студии».";

function authorized(chatId: number): boolean {
  const allowed = process.env.TELEGRAM_CHAT_ID;
  return !!allowed && String(chatId) === String(allowed);
}

async function tg(method: string, body: Record<string, unknown>) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN не настроен");
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as { ok: boolean; description?: string };
  if (!data.ok) {
    throw new Error(`Telegram ${method}: ${data.description ?? "unknown error"}`);
  }
  return data;
}

function parseCommand(text: string): { kind: Kind; topic: string } {
  const t = text.trim();
  /* /post тема и varианты */
  const m = t.match(/^\/(post|reels|hooks)(?:@\w+)?\s+(.+)$/is);
  if (m) {
    return { kind: m[1].toLowerCase() as Kind, topic: m[2].trim() };
  }
  /* Просто текст — это пост. */
  return { kind: "post", topic: t };
}

async function generateContent(kind: Kind, topic: string): Promise<string> {
  const userByKind: Record<Kind, string> = {
    post:
      `Напиши готовый пост для Telegram на тему: «${topic}».\n` +
      "Объём: 350-500 слов. Структура: хук по одному из паттернов A-H → " +
      "тело 3-5 абзацев с конкретикой → открытый вопрос в финале. " +
      "Без подзаголовков типа «Хук:».",
    reels:
      `Сценарий Reels 15-30 секунд на тему «${topic}».\n` +
      "Формат строго по разделам:\n" +
      "**ХУК (0-3 с):** [одна фраза по паттерну A-H]\n" +
      "**ТЕЛО (3-25 с):** [личный пример или 1-3 микро-шага]\n" +
      "**ТРИГГЕР (25-28 с):** [эмоциональный пик]\n" +
      "**CTA (28-30 с):** [конкретный призыв в бот]\n" +
      "**КАДРЫ:** [3-4 буллета описаний планов]",
    hooks:
      `Дай 5 хуков на тему «${topic}». По одному в строке, без нумерации, ` +
      "без кавычек. Распредели по разным паттернам A-H (отрицание / цифра / " +
      "провокация / локальная проблема / ошибки / секрет / личная история / " +
      "контраст). 6-14 слов каждый.",
  };

  const r = await invokeLLM({
    messages: [
      { role: "system", content: SERBOLIN_SYSTEM_PROMPT },
      { role: "user", content: userByKind[kind] },
    ],
  });
  const out = r.choices[0]?.message.content;
  if (typeof out !== "string") throw new Error("LLM вернул пустой ответ");
  return out;
}

/* callback_data максимум 64 байта в Telegram, поэтому передаём
   { kind, topicId }, где topicId — короткий хеш темы. Сама тема
   живёт в локальной таблице chat_topic_cache, но для v1 проще
   пихать тему в callback_data, обрезая до 50 символов. */
function makeCallbackData(action: string, kind: Kind, topic: string): string {
  const trimmed = topic.slice(0, 40).replace(/[\n\r]+/g, " ").trim();
  return `${action}:${kind}:${trimmed}`;
}

function generationKeyboard(kind: Kind, topic: string) {
  return {
    inline_keyboard: [
      [
        { text: "🔁 Заново", callback_data: makeCallbackData("regen", kind, topic) },
        { text: "📤 В канал", callback_data: "publish" },
      ],
      [
        {
          text: "🌐 Открыть в студии",
          url: `${APP_URL}/generator?title=${encodeURIComponent(topic)}`,
        },
      ],
    ],
  };
}

async function handleMessage(msg: NonNullable<TgUpdate["message"]>): Promise<void> {
  const chatId = msg.chat.id;
  if (!authorized(chatId)) {
    await tg("sendMessage", {
      chat_id: chatId,
      text:
        "Этот бот настроен на одного человека. Если ты Эдуард — проверь, " +
        "что TELEGRAM_CHAT_ID в секретах Worker'а равен твоему chat_id.",
    });
    return;
  }
  const text = (msg.text ?? "").trim();
  if (!text) return;

  if (text === "/start" || text === "/help" || text.toLowerCase().startsWith("/help")) {
    await tg("sendMessage", { chat_id: chatId, text: HELP });
    return;
  }

  const { kind, topic } = parseCommand(text);
  if (topic.length < 3) {
    await tg("sendMessage", {
      chat_id: chatId,
      text: "Слишком короткая тема. Напиши хотя бы 3 символа или /help.",
    });
    return;
  }

  /* Прелюдия — даём знать, что что-то делаем (Gemini обычно 5-15 секунд). */
  await tg("sendChatAction", { chat_id: chatId, action: "typing" });

  try {
    const reply = await generateContent(kind, topic);
    await tg("sendMessage", {
      chat_id: chatId,
      text: reply.slice(0, 4000),
      reply_markup: generationKeyboard(kind, topic),
    });
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    await tg("sendMessage", {
      chat_id: chatId,
      text: `Сорвалось: ${m.slice(0, 300)}`,
    });
  }
}

async function handleCallback(cq: NonNullable<TgUpdate["callback_query"]>): Promise<void> {
  const chatId = cq.message?.chat.id;
  if (!chatId || !authorized(chatId)) {
    await tg("answerCallbackQuery", {
      callback_query_id: cq.id,
      text: "Не разрешено",
    });
    return;
  }
  const data = cq.data ?? "";

  if (data === "publish") {
    /* Берём текст исходного сообщения и публикуем в канал
       (тот же chat_id — у Эдуарда совпадает личный чат и канал; если в
       будущем разойдутся, заведём TELEGRAM_PUBLISH_CHAT_ID). */
    const text = cq.message?.text ?? "";
    if (!text) {
      await tg("answerCallbackQuery", {
        callback_query_id: cq.id,
        text: "Нет текста для публикации",
      });
      return;
    }
    try {
      await tg("sendMessage", {
        chat_id:
          process.env.TELEGRAM_PUBLISH_CHAT_ID ??
          process.env.TELEGRAM_CHAT_ID ??
          chatId,
        text,
      });
      await tg("answerCallbackQuery", {
        callback_query_id: cq.id,
        text: "Отправил в канал ✅",
      });
    } catch (err) {
      const m = err instanceof Error ? err.message : String(err);
      await tg("answerCallbackQuery", {
        callback_query_id: cq.id,
        text: `Не отправилось: ${m.slice(0, 160)}`,
      });
    }
    return;
  }

  if (data.startsWith("regen:")) {
    const [, kindRaw, topic] = data.split(":");
    const kind = (kindRaw as Kind) ?? "post";
    if (!topic) {
      await tg("answerCallbackQuery", {
        callback_query_id: cq.id,
        text: "Тема потерялась — напиши заново",
      });
      return;
    }
    await tg("answerCallbackQuery", {
      callback_query_id: cq.id,
      text: "Делаю заново...",
    });
    await tg("sendChatAction", { chat_id: chatId, action: "typing" });
    try {
      const reply = await generateContent(kind, topic);
      await tg("sendMessage", {
        chat_id: chatId,
        text: reply.slice(0, 4000),
        reply_markup: generationKeyboard(kind, topic),
      });
    } catch (err) {
      const m = err instanceof Error ? err.message : String(err);
      await tg("sendMessage", {
        chat_id: chatId,
        text: `Сорвалось при перегенерации: ${m.slice(0, 300)}`,
      });
    }
    return;
  }

  await tg("answerCallbackQuery", { callback_query_id: cq.id });
}

export async function handleTelegramWebhook(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  let update: TgUpdate;
  try {
    update = (await request.json()) as TgUpdate;
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  /* Отвечаем Telegram'у 200 быстро — обработка идёт в waitUntil,
     поэтому таймауты Telegram'a (1 секунда) не сваливают вебхук.
     Здесь обходимся без waitUntil — это норм для коротких операций,
     но для долгих generateContent лучше его прокинуть через env-объект.
     В нашей фишке у вызывающего фрейма ctx есть waitUntil — см.
     worker/index.ts. */
  if (update.message?.text) {
    await handleMessage(update.message);
  } else if (update.callback_query) {
    await handleCallback(update.callback_query);
  }
  return new Response("ok", { status: 200 });
}

/* Setup helper — устанавливает или удаляет вебхук на конкретный URL.
   Защищён общим секретом WEBHOOK_SETUP_SECRET (если не задан — открыт
   только локально для разработчика). */
export async function handleTelegramSetup(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const action = url.searchParams.get("action") ?? "info";
  const secret = url.searchParams.get("secret") ?? "";
  const expected = process.env.WEBHOOK_SETUP_SECRET ?? "";

  if (expected && secret !== expected) {
    return new Response(JSON.stringify({ ok: false, error: "bad secret" }), {
      status: 403,
      headers: { "content-type": "application/json" },
    });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return new Response(
      JSON.stringify({ ok: false, error: "TELEGRAM_BOT_TOKEN not set" }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }

  let res: Response;
  if (action === "set") {
    res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        url: `${APP_URL}/api/telegram/webhook`,
        allowed_updates: ["message", "callback_query"],
      }),
    });
  } else if (action === "delete") {
    res = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`);
  } else {
    res = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
  }

  const json = await res.json();
  return new Response(JSON.stringify(json, null, 2), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
