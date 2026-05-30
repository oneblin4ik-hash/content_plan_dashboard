import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { d1Query, d1Execute, isD1Configured } from "../_core/d1";

/* ============================================================
   Telegram router. Кладёт пост / сценарий в Telegram через Bot API.

   Multi-chat (этап A4): пользователь добавляет несколько чатов или
   каналов через UI в Настройках (telegram.chats.add). Один помечен
   default. sendPost/Reels/Both принимают опциональный chatId —
   если не передан, берётся default; если default нет — fallback на
   зашитый в env TELEGRAM_CHAT_ID (обратная совместимость).
   ============================================================ */

const wsKey = z.string().min(8).max(64);
/* chat_id Telegram: либо число (приватный канал/группа, начинается
   с -100...), либо @username публичного канала. */
const chatIdSchema = z
  .string()
  .min(2)
  .max(64)
  .regex(/^(@[A-Za-z][A-Za-z0-9_]{2,32}|-?\d{6,20})$/);

async function resolveChatId(
  workspaceKey: string | undefined,
  explicitChatId: string | undefined,
): Promise<string> {
  if (explicitChatId) return explicitChatId;
  if (workspaceKey && isD1Configured()) {
    const rows = await d1Query<{ chat_id: string }>(
      "SELECT chat_id FROM telegram_chats WHERE workspace_key = ? AND is_default = 1 LIMIT 1",
      [workspaceKey],
    );
    if (rows[0]) return rows[0].chat_id;
  }
  const envId = process.env.TELEGRAM_CHAT_ID;
  if (envId) return envId;
  throw new Error(
    "Не задан Telegram-чат. Добавь канал в Настройках или передай chatId.",
  );
}

async function sendMessage(
  chatId: string,
  text: string,
): Promise<{ messageId: number }> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    throw new Error("TELEGRAM_BOT_TOKEN не настроен");
  }
  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: false,
      }),
    },
  );
  const data = (await response.json()) as {
    ok: boolean;
    description?: string;
    result?: { message_id: number };
  };
  if (!data.ok || !data.result) {
    throw new Error(`Telegram API: ${data.description ?? "unknown error"}`);
  }
  return { messageId: data.result.message_id };
}

export const telegramRouter = router({
  /* ---------- Мульти-чат: управление списком ---------- */

  /* Список добавленных чатов пользователя + флаг default. */
  chats: router({
    list: publicProcedure
      .input(z.object({ workspaceKey: wsKey }))
      .query(async ({ input }) => {
        if (!isD1Configured()) return [];
        const rows = await d1Query<{
          id: string;
          chat_id: string;
          title: string | null;
          is_default: number;
          added_at: number;
        }>(
          "SELECT id, chat_id, title, is_default, added_at FROM telegram_chats WHERE workspace_key = ? ORDER BY is_default DESC, added_at DESC",
          [input.workspaceKey],
        );
        return rows.map((r) => ({
          id: r.id,
          chatId: r.chat_id,
          title: r.title,
          isDefault: r.is_default === 1,
          addedAt: r.added_at,
        }));
      }),

    /* Добавляет чат и сразу проверяет, что бот может туда писать —
       через Bot API getChat. Если ответ ok — сохраняет, если нет —
       возвращает читабельную ошибку (типа «Bot is not in the chat»). */
    add: publicProcedure
      .input(
        z.object({
          workspaceKey: wsKey,
          chatId: chatIdSchema,
          makeDefault: z.boolean().default(false),
        }),
      )
      .mutation(async ({ input }) => {
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        if (!botToken) throw new Error("TELEGRAM_BOT_TOKEN не настроен");

        /* Probe: бот должен видеть чат. Это ловит частые ошибки —
           бот не добавлен в канал, или username с опечаткой. */
        const probe = await fetch(
          `https://api.telegram.org/bot${botToken}/getChat?chat_id=${encodeURIComponent(input.chatId)}`,
        );
        const probeJson = (await probe.json()) as {
          ok: boolean;
          description?: string;
          result?: { title?: string; username?: string; type?: string };
        };
        if (!probeJson.ok || !probeJson.result) {
          throw new Error(
            `Бот не видит этот чат: ${probeJson.description ?? "unknown"}. Добавь бота в канал админом и попробуй снова.`,
          );
        }
        const title =
          probeJson.result.title ||
          (probeJson.result.username ? "@" + probeJson.result.username : null);

        const id = crypto.randomUUID();
        const now = Date.now();
        await d1Execute(
          "INSERT INTO telegram_chats (id, workspace_key, chat_id, title, is_default, added_at) VALUES (?, ?, ?, ?, ?, ?)",
          [id, input.workspaceKey, input.chatId, title, 0, now],
        );

        /* Если это первый чат пользователя или makeDefault=true —
           делаем дефолтным (и снимаем флаг у других). */
        const existing = await d1Query<{ n: number }>(
          "SELECT COUNT(*) AS n FROM telegram_chats WHERE workspace_key = ?",
          [input.workspaceKey],
        );
        const isFirst = (existing[0]?.n ?? 0) === 1;
        if (input.makeDefault || isFirst) {
          await d1Execute(
            "UPDATE telegram_chats SET is_default = CASE WHEN id = ? THEN 1 ELSE 0 END WHERE workspace_key = ?",
            [id, input.workspaceKey],
          );
        }
        return { id, title, chatId: input.chatId };
      }),

    setDefault: publicProcedure
      .input(z.object({ workspaceKey: wsKey, id: z.string() }))
      .mutation(async ({ input }) => {
        await d1Execute(
          "UPDATE telegram_chats SET is_default = CASE WHEN id = ? THEN 1 ELSE 0 END WHERE workspace_key = ?",
          [input.id, input.workspaceKey],
        );
        return { ok: true };
      }),

    delete: publicProcedure
      .input(z.object({ workspaceKey: wsKey, id: z.string() }))
      .mutation(async ({ input }) => {
        await d1Execute(
          "DELETE FROM telegram_chats WHERE workspace_key = ? AND id = ?",
          [input.workspaceKey, input.id],
        );
        return { ok: true };
      }),
  }),

  /* ---------- Отправка контента ---------- */

  sendPost: publicProcedure
    .input(
      z.object({
        content: z.string().min(1, "Контент не может быть пустым"),
        title: z.string().optional(),
        workspaceKey: wsKey.optional(),
        chatId: chatIdSchema.optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const target = await resolveChatId(input.workspaceKey, input.chatId);
      const message = input.title
        ? `<b>${input.title}</b>\n\n${input.content}`
        : input.content;
      const { messageId } = await sendMessage(target, message);
      return {
        success: true,
        messageId,
        chatId: target,
        message: "Пост успешно отправлен в Telegram",
      };
    }),

  sendReelsScript: publicProcedure
    .input(
      z.object({
        script: z.string().min(1, "Сценарий не может быть пустым"),
        title: z.string().optional(),
        workspaceKey: wsKey.optional(),
        chatId: chatIdSchema.optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const target = await resolveChatId(input.workspaceKey, input.chatId);
      const message = input.title
        ? `📹 <b>${input.title}</b>\n\n${input.script}`
        : `📹 <b>Сценарий Reels</b>\n\n${input.script}`;
      const { messageId } = await sendMessage(target, message);
      return {
        success: true,
        messageId,
        chatId: target,
        message: "Сценарий успешно отправлен в Telegram",
      };
    }),

  sendBoth: publicProcedure
    .input(
      z.object({
        post: z.string().min(1),
        script: z.string().min(1),
        title: z.string().optional(),
        workspaceKey: wsKey.optional(),
        chatId: chatIdSchema.optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const target = await resolveChatId(input.workspaceKey, input.chatId);
      const postMsg = input.title
        ? `<b>${input.title}</b>\n\n${input.post}`
        : input.post;
      const scriptMsg = input.title
        ? `📹 <b>${input.title} (Reels)</b>\n\n${input.script}`
        : `📹 <b>Сценарий Reels</b>\n\n${input.script}`;
      const post = await sendMessage(target, postMsg);
      const script = await sendMessage(target, scriptMsg);
      return {
        success: true,
        postMessageId: post.messageId,
        scriptMessageId: script.messageId,
        chatId: target,
        message: "Пост и сценарий успешно отправлены в Telegram",
      };
    }),
});
