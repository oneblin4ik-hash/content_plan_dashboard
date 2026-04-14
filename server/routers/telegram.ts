import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { ENV } from "../_core/env";

export const telegramRouter = router({
  sendPost: publicProcedure
    .input(
      z.object({
        content: z.string().min(1, "Контент не может быть пустым"),
        title: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      const chatId = process.env.TELEGRAM_CHAT_ID;

      if (!botToken || !chatId) {
        throw new Error("Telegram Bot Token или Chat ID не настроены");
      }

      try {
        // Format message with title if provided
        let message = input.content;
        if (input.title) {
          message = `<b>${input.title}</b>\n\n${input.content}`;
        }

        const response = await fetch(
          `https://api.telegram.org/bot${botToken}/sendMessage`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              chat_id: chatId,
              text: message,
              parse_mode: "HTML",
              disable_web_page_preview: false,
            }),
          }
        );

        const data = await response.json();

        if (!data.ok) {
          throw new Error(
            `Telegram API error: ${data.description || "Unknown error"}`
          );
        }

        return {
          success: true,
          messageId: data.result.message_id,
          message: "Пост успешно отправлен в Telegram",
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        throw new Error(`Не удалось отправить пост в Telegram: ${errorMessage}`);
      }
    }),

  sendReelsScript: publicProcedure
    .input(
      z.object({
        script: z.string().min(1, "Сценарий не может быть пустым"),
        title: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      const chatId = process.env.TELEGRAM_CHAT_ID;

      if (!botToken || !chatId) {
        throw new Error("Telegram Bot Token или Chat ID не настроены");
      }

      try {
        // Format message with title and emoji for Reels script
        let message = `📹 <b>Сценарий Reels</b>\n\n${input.script}`;
        if (input.title) {
          message = `📹 <b>${input.title}</b>\n\n${input.script}`;
        }

        const response = await fetch(
          `https://api.telegram.org/bot${botToken}/sendMessage`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              chat_id: chatId,
              text: message,
              parse_mode: "HTML",
              disable_web_page_preview: false,
            }),
          }
        );

        const data = await response.json();

        if (!data.ok) {
          throw new Error(
            `Telegram API error: ${data.description || "Unknown error"}`
          );
        }

        return {
          success: true,
          messageId: data.result.message_id,
          message: "Сценарий успешно отправлен в Telegram",
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        throw new Error(
          `Не удалось отправить сценарий в Telegram: ${errorMessage}`
        );
      }
    }),

  sendBoth: publicProcedure
    .input(
      z.object({
        post: z.string().min(1),
        script: z.string().min(1),
        title: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      const chatId = process.env.TELEGRAM_CHAT_ID;

      if (!botToken || !chatId) {
        throw new Error("Telegram Bot Token или Chat ID не настроены");
      }

      try {
        // Send post
        const postMessage = input.title
          ? `<b>${input.title}</b>\n\n${input.post}`
          : input.post;

        const postResponse = await fetch(
          `https://api.telegram.org/bot${botToken}/sendMessage`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              chat_id: chatId,
              text: postMessage,
              parse_mode: "HTML",
              disable_web_page_preview: false,
            }),
          }
        );

        const postData = await postResponse.json();

        if (!postData.ok) {
          throw new Error(
            `Failed to send post: ${postData.description || "Unknown error"}`
          );
        }

        // Send Reels script
        const scriptMessage = input.title
          ? `📹 <b>${input.title} (Reels)</b>\n\n${input.script}`
          : `📹 <b>Сценарий Reels</b>\n\n${input.script}`;

        const scriptResponse = await fetch(
          `https://api.telegram.org/bot${botToken}/sendMessage`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              chat_id: chatId,
              text: scriptMessage,
              parse_mode: "HTML",
              disable_web_page_preview: false,
            }),
          }
        );

        const scriptData = await scriptResponse.json();

        if (!scriptData.ok) {
          throw new Error(
            `Failed to send script: ${scriptData.description || "Unknown error"}`
          );
        }

        return {
          success: true,
          postMessageId: postData.result.message_id,
          scriptMessageId: scriptData.result.message_id,
          message: "Пост и сценарий успешно отправлены в Telegram",
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        throw new Error(`Ошибка при отправке в Telegram: ${errorMessage}`);
      }
    }),
});
