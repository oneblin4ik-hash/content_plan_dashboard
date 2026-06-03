import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { invokeForUser } from "../_core/llm-guard";

/* ============================================================
   Разбор чужого поста («учись на чужом успехе»).
   Идея из конкурентного анализа Virale: вставляешь ссылку или текст
   удачного поста → LLM разбирает, почему он работает (хук, структура,
   триггеры), и предлагает, как применить приёмы в голосе автора.

   Поддержка источников:
   - Прямой текст (вставил из буфера) — работает всегда.
   - Telegram-ссылка (t.me/<channel>/<id>) — забираем текст поста через
     embed-страницу (?embed=1), без Bot API и без авторизации.
   - Прочие ссылки (Instagram/TikTok/сайты) — не парсим автоматически
     (нужен рендеринг JS / приватные API). Просим вставить текст.
   ============================================================ */

/* Достаёт текст одиночного поста Telegram через embed-виджет.
   https://t.me/<channel>/<id>?embed=1&mode=tme отдаёт статичный HTML
   с .tgme_widget_message_text — оттуда и берём. */
async function fetchTelegramPost(channel: string, id: string): Promise<string | null> {
  const url = `https://t.me/${channel}/${id}?embed=1&mode=tme`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 (content-studio analyze)" },
      redirect: "manual",
    });
  } catch {
    return null;
  }
  if (res.status !== 200) return null;
  const html = await res.text();
  const m = html.match(
    /tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/i,
  );
  if (!m) return null;
  const text = m[1]
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .trim();
  return text || null;
}

/* Парсит t.me-ссылку в (channel, id). Поддерживает t.me/c/... только
   частично (числовые каналы embed не отдают) — для них вернём null. */
function parseTelegramUrl(raw: string): { channel: string; id: string } | null {
  try {
    const u = new URL(raw.trim());
    if (!/(^|\.)t\.me$/.test(u.hostname)) return null;
    const parts = u.pathname.split("/").filter(Boolean);
    // /<channel>/<id>  или  /s/<channel>/<id>
    let channel: string | undefined;
    let id: string | undefined;
    if (parts[0] === "s" && parts.length >= 3) {
      channel = parts[1];
      id = parts[2];
    } else if (parts.length >= 2) {
      channel = parts[0];
      id = parts[1];
    }
    if (!channel || !id || !/^\d+$/.test(id)) return null;
    return { channel, id };
  } catch {
    return null;
  }
}

const ANALYZE_TASK = `Текущая задача: разобрать чужой пост/контент и объяснить
автору, ПОЧЕМУ он работает, чтобы автор смог применить те же приёмы в своём
голосе (не копируя дословно).

Выдай ответ строго по структуре в markdown:

## Почему это цепляет
2-4 пункта: что конкретно удерживает внимание (тип хука, эмоция, обещание,
структура, ритм).

## Разбор по элементам
- **Хук:** что в первой строке и почему работает
- **Структура:** как построен пост (что за чем)
- **Триггеры:** какие психологические крючки использованы (страх упустить,
  любопытство, социальное доказательство, конкретика-цифры и т.п.)
- **Призыв:** что и как просят сделать в конце

## Как применить тебе
2-3 конкретных приёма, адаптированных под нишу и голос автора (из системного
контекста). Без «будьте искренними» — только рабочие ходы.

## Идея поста в твоём стиле
Один готовый цепляющий заголовок + 1 строка про подачу — как автор мог бы
использовать этот приём на своей теме.

Будь конкретным. Не пересказывай пост — разбирай механику.`;

export const analyzeRouter = router({
  analyzePost: protectedProcedure
    .input(
      z
        .object({
          /* Либо ссылка, либо вставленный текст. Хотя бы одно. */
          url: z.string().trim().max(500).optional(),
          text: z.string().trim().max(8000).optional(),
        })
        .refine((v) => !!v.url || !!v.text, {
          message: "Вставь ссылку или текст поста",
        }),
    )
    .mutation(async ({ ctx, input }) => {
      let postText = input.text?.trim() ?? "";
      let source: "text" | "telegram" = "text";

      /* Если дана ссылка и текста нет — пробуем достать текст. */
      if (!postText && input.url) {
        const tg = parseTelegramUrl(input.url);
        if (!tg) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Автоматически читаю только ссылки на посты Telegram (t.me/канал/номер). Для Instagram/TikTok вставь текст поста вручную.",
          });
        }
        const fetched = await fetchTelegramPost(tg.channel, tg.id);
        if (!fetched) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Не удалось прочитать пост по ссылке (возможно, приватный канал или медиа без текста). Вставь текст вручную.",
          });
        }
        postText = fetched;
        source = "telegram";
      }

      if (postText.length < 40) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Слишком короткий текст для разбора — нужно хотя бы пару абзацев.",
        });
      }

      const userPrompt = `Вот пост для разбора:\n\n"""\n${postText.slice(0, 6000)}\n"""`;
      const { text, model } = await invokeForUser(ctx.user, ANALYZE_TASK, userPrompt);

      return {
        analysis: text,
        model,
        source,
        extractedText: source === "telegram" ? postText.slice(0, 2000) : undefined,
      };
    }),
});
