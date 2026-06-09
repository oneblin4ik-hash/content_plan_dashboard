/**
 * Уведомления владельцу сервиса (мне) в Telegram, когда Resend
 * отказался доставить транзакционное письмо (verify-email или
 * password-reset).
 *
 * Зачем: пока в Resend не верифицирован собственный домен, sandbox
 * блокирует отправку на любой email кроме владельца Resend-аккаунта.
 * Чтобы юзер не оставался без ссылки — присылаем ссылку напрямую в
 * Telegram-канал OWNER (TELEGRAM_CHAT_ID), и я вручную переотправляю
 * её юзеру через любой канал (mail, WhatsApp, Telegram-DM).
 *
 * Никакой авторизации — просто POST к Bot API с уже настроенным
 * BOT_TOKEN и CHAT_ID. Если переменные не заданы или отправка
 * сорвалась — тихо логируем; основной flow не блокируем.
 */

export async function notifyOwnerOnEmailFail(opts: {
  kind: "verify" | "reset";
  toEmail: string;
  url: string;
  resendError: string;
}): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) return;

  const kindLabel =
    opts.kind === "verify" ? "✉️ Подтверждение email" : "🔑 Сброс пароля";

  /* Используем plain-text + < / > escape, чтобы Telegram отрендерил
     ссылку как кликабельную и не упал на html-парсе. */
  const text =
    `${kindLabel}\n\n` +
    `Кому: ${opts.toEmail}\n` +
    `Ссылка (нажми, скопируй из адреса):\n${opts.url}\n\n` +
    `Resend отказал: ${opts.resendError.slice(0, 200)}`;

  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
      }),
    });
  } catch (e) {
    console.error("[owner-notify] не смог отправить в TG:", e);
  }
}
