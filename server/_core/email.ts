/**
 * Email service. Используется для отправки писем верификации и
 * password reset.
 *
 * Провайдер: Resend (https://resend.com — 100 писем/день бесплатно,
 * 3000/мес). Cloudflare Workers-friendly: один HTTPS POST.
 *
 * Env-секреты:
 *   - RESEND_API_KEY     — ключ API
 *   - EMAIL_FROM         — адрес отправителя (например
 *                          "Content Studio <noreply@your-domain.com>")
 *                          до верификации домена в Resend используем
 *                          их sandbox "onboarding@resend.dev" — но в
 *                          sandbox письма уходят только на email
 *                          владельца аккаунта Resend.
 *
 * Если RESEND_API_KEY не задан — работает dev-режим: письмо
 * логируется в console (Workers tail), а вызывающему коду
 * возвращается preview-URL (текст письма + ссылка), которую UI
 * показывает в админке. Это позволяет тестировать flow без оплаты.
 */

export type EmailRequest = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export type EmailResult =
  | { ok: true; provider: "resend"; id: string }
  | { ok: true; provider: "dev"; previewBody: string }
  | { ok: false; error: string };

/* Базовый URL приложения — для ссылок в письмах. Считываем из env
   APP_URL; на проде указывает на текущий worker, в dev — на
   localhost. Если не задан, фоллбек на production-домен. */
export function getAppUrl(): string {
  return (
    process.env.APP_URL ||
    "https://content-studio.one-blin4ik.workers.dev"
  );
}

export async function sendEmail(req: EmailRequest): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from =
    process.env.EMAIL_FROM ||
    "Content Studio <onboarding@resend.dev>";

  if (!apiKey) {
    /* Dev-режим: не отправляем реально, но возвращаем тело — UI
       покажет администратору, чтобы вручную дать юзеру ссылку до
       настройки SMTP. Это критично для первого юзера на проде,
       пока Resend ещё не подключён. */
    console.warn(
      `[email] RESEND_API_KEY not set, dev-mode for ${req.to}: ${req.subject}`,
    );
    return { ok: true, provider: "dev", previewBody: req.html };
  }

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [req.to],
        subject: req.subject,
        html: req.html,
        text: req.text,
      }),
    });
    if (!r.ok) {
      /* Полный body ошибки — Resend кладёт сюда {name,message} с
         объяснением: invalid_from_address, validation_error,
         restricted_api_key, you_can_only_send_to и т.п. */
      const errText = await r.text().catch(() => "");
      console.error(`[email] resend HTTP ${r.status}: ${errText}`);
      return { ok: false, error: `Resend ${r.status}: ${errText.slice(0, 300)}` };
    }
    const data = (await r.json()) as { id?: string };
    return { ok: true, provider: "resend", id: data.id ?? "" };
  } catch (e) {
    console.error("[email] resend exception", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "send failed",
    };
  }
}

/* ─── Шаблоны писем ────────────────────────────────────────── */

/* Все письма — простой inline-styled HTML без внешних ресурсов,
   чтобы корректно отображались в любом клиенте включая Gmail/
   Apple Mail. Брендирование сдержанное: золотая акцентная кнопка,
   тёмный фон с инверсией в светлый по prefers-color-scheme. */

function emailShell(title: string, body: string): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>${escape(title)}</title></head>
<body style="margin:0;padding:32px 16px;background:#0a0a0a;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#e9e6e0;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" width="520"
  style="max-width:520px;width:100%;background:#1a1a1a;border-radius:16px;padding:32px;">
  <tr><td>
    <div style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#d4a843;margin-bottom:14px;">
      Content Studio
    </div>
    ${body}
    <div style="margin-top:28px;padding-top:18px;border-top:1px solid rgba(255,255,255,0.08);font-size:11px;color:rgba(255,255,255,0.45);line-height:1.5;">
      Если ты не запрашивал это письмо — просто проигнорируй его.
    </div>
  </td></tr>
</table>
</body></html>`;
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function button(href: string, label: string): string {
  return `<a href="${escape(href)}"
    style="display:inline-block;padding:14px 28px;background:#d4a843;color:#1a1a1a;font-weight:700;text-decoration:none;border-radius:9999px;font-size:14px;">
    ${escape(label)}
  </a>`;
}

export function buildVerificationEmail(opts: {
  email: string;
  url: string;
}): EmailRequest {
  const body = `
<h1 style="font-size:24px;line-height:1.2;color:#fff;margin:0 0 12px;">
  Подтверди email
</h1>
<p style="font-size:15px;line-height:1.55;color:rgba(255,255,255,0.78);margin:0 0 24px;">
  Чтобы активировать аккаунт в Content Studio, нажми кнопку ниже.
  Ссылка действует 24 часа.
</p>
<div style="margin:0 0 24px;">${button(opts.url, "Подтвердить email")}</div>
<p style="font-size:12px;line-height:1.5;color:rgba(255,255,255,0.5);margin:0;">
  Или скопируй ссылку:<br>
  <span style="color:#d4a843;word-break:break-all;">${escape(opts.url)}</span>
</p>`;
  return {
    to: opts.email,
    subject: "Подтверди email для Content Studio",
    html: emailShell("Подтверди email", body),
    text: `Подтверди email для Content Studio: ${opts.url}`,
  };
}

export function buildPasswordResetEmail(opts: {
  email: string;
  url: string;
}): EmailRequest {
  const body = `
<h1 style="font-size:24px;line-height:1.2;color:#fff;margin:0 0 12px;">
  Сброс пароля
</h1>
<p style="font-size:15px;line-height:1.55;color:rgba(255,255,255,0.78);margin:0 0 24px;">
  Получили запрос на сброс пароля для этого аккаунта. Нажми кнопку,
  чтобы задать новый пароль. Ссылка действует 1 час.
</p>
<div style="margin:0 0 24px;">${button(opts.url, "Сбросить пароль")}</div>
<p style="font-size:12px;line-height:1.5;color:rgba(255,255,255,0.5);margin:0;">
  Или скопируй ссылку:<br>
  <span style="color:#d4a843;word-break:break-all;">${escape(opts.url)}</span>
</p>`;
  return {
    to: opts.email,
    subject: "Сброс пароля — Content Studio",
    html: emailShell("Сброс пароля", body),
    text: `Сброс пароля для Content Studio: ${opts.url}`,
  };
}
