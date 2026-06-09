import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { d1Query, d1Execute, isD1Configured } from "../_core/d1";
import {
  hashPassword,
  verifyPassword,
  signJWT,
  buildSessionCookie,
  buildClearCookie,
} from "../_core/auth";
import {
  sendEmail,
  buildVerificationEmail,
  buildPasswordResetEmail,
  getAppUrl,
} from "../_core/email";

/* ============================================================
   Auth router: регистрация / логин / выход / профиль.

   Stateless JWT в HTTP-only cookie. Регистрация требует согласие на
   обработку перс. данных (ФЗ-152) и пользовательское соглашение —
   оба чекбокса обязательные, бэкенд тоже проверяет.

   После регистрации юзер получает 3-дневный триал и 30 000 токенов
   (списываются в callLLM по usage из ответа Gemini).
   ============================================================ */

const TRIAL_DAYS = 3;
/* Баланс в «пользовательской» шкале (1 = 10 реальных токенов Gemini,
   см. TOKEN_DIVISOR в llm-guard.ts). 1 000 ≈ 10 000 реальных ≈
   ~8 постов или ~5 постов + анализ конкурента — достаточно
   попробовать ключевые сценарии. */
const TRIAL_TOKENS = 1_000;
const PASSWORD_MIN = 8;

const emailSchema = z
  .string()
  .trim()
  .min(5)
  .max(320)
  .email("Похоже на неправильный email");
const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, `Минимум ${PASSWORD_MIN} символов`)
  .max(200);

type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  name: string | null;
  plan: string;
  trial_ends_at: number;
  tokens_remaining: number;
};

function getJwtSecret(): string {
  const s = process.env.JWT_SECRET ?? "";
  if (!s) throw new Error("JWT_SECRET не настроен на сервере");
  return s;
}

function isSecure(): boolean {
  /* Cookie Secure флаг на проде включён; в dev (NODE_ENV=development) —
     выключен, чтобы работало локально без HTTPS. */
  return process.env.NODE_ENV !== "development";
}

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;

/* Генерация одноразового токена. crypto.randomUUID даёт 128 бит
   энтропии — достаточно для одноразовых URL-токенов. Никаких
   sequential id, чтобы нельзя было перебором подобрать чужой
   токен. */
function makeToken(): string {
  return (
    crypto.randomUUID().replace(/-/g, "") +
    crypto.randomUUID().replace(/-/g, "")
  );
}

/* Запускает отправку verification-письма. Не throw'ит при ошибке
   email-провайдера — наружу возвращаем "успех", но логируем. Это
   осознанно: если письмо не доставилось, юзер всегда может нажать
   «отправить повторно». UX важнее немедленной диагностики. */
async function dispatchVerification(userId: string, email: string) {
  const token = makeToken();
  const expiresAt = Date.now() + VERIFY_TTL_MS;
  await d1Execute(
    "UPDATE users SET email_verification_token = ?, email_verification_expires_at = ? WHERE id = ?",
    [token, expiresAt, userId],
  );
  const url = `${getAppUrl()}/verify-email?token=${token}`;
  const r = await sendEmail(buildVerificationEmail({ email, url }));
  if (!r.ok) {
    console.error(
      `[auth] не удалось отправить verification на ${email}: ${r.error} · fallback URL: ${url}`,
    );
  } else {
    console.log(`[auth] verification отправлен на ${email}`);
  }
}

async function dispatchPasswordReset(userId: string, email: string) {
  const token = makeToken();
  const expiresAt = Date.now() + RESET_TTL_MS;
  await d1Execute(
    "UPDATE users SET password_reset_token = ?, password_reset_expires_at = ? WHERE id = ?",
    [token, expiresAt, userId],
  );
  const url = `${getAppUrl()}/reset-password?token=${token}`;
  const r = await sendEmail(buildPasswordResetEmail({ email, url }));
  if (!r.ok) {
    /* Логируем и url, и ошибку — чтобы из wrangler tail можно было
       вручную взять ссылку для пользователя, пока домен в Resend
       не верифицирован. Ссылка действует 1 час. */
    console.error(
      `[auth] не удалось отправить reset на ${email}: ${r.error} · fallback URL: ${url}`,
    );
  } else {
    console.log(`[auth] reset отправлен на ${email}`);
  }
}

export const authRouter = router({
  /* Регистрация. */
  register: publicProcedure
    .input(
      z.object({
        email: emailSchema,
        password: passwordSchema,
        name: z.string().trim().max(80).optional(),
        consentPersonalData: z.literal(true, {
          message:
            "Нужно подтвердить согласие на обработку персональных данных",
        }),
        consentTerms: z.literal(true, {
          message: "Нужно принять пользовательское соглашение",
        }),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (!isD1Configured()) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "База данных не настроена",
        });
      }
      const email = input.email.toLowerCase();

      const exists = await d1Query<{ id: string }>(
        "SELECT id FROM users WHERE email = ? LIMIT 1",
        [email],
      );
      if (exists.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Аккаунт с таким email уже существует",
        });
      }

      const id = crypto.randomUUID();
      const now = Date.now();
      const passwordHash = await hashPassword(input.password);
      await d1Execute(
        `INSERT INTO users
           (id, email, password_hash, name, created_at,
            consent_personal_data_at, consent_terms_at,
            plan, trial_ends_at, tokens_remaining, tokens_used_total, voice_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'trial', ?, ?, 0, NULL)`,
        [
          id,
          email,
          passwordHash,
          input.name ?? null,
          now,
          now,
          now,
          now + TRIAL_DAYS * 24 * 60 * 60 * 1000,
          TRIAL_TOKENS,
        ],
      );

      const token = await signJWT(id, getJwtSecret());
      ctx.setCookies.push(buildSessionCookie(token, { secure: isSecure() }));

      /* Шлём verification-письмо асинхронно — но await'им, иначе
         Worker может прервать isolate до завершения fetch к Resend.
         Время отправки ~200 ms, не критично для UX регистрации. */
      await dispatchVerification(id, email);

      return { ok: true, userId: id };
    }),

  /* Логин. */
  login: publicProcedure
    .input(
      z.object({
        email: emailSchema,
        password: z.string().min(1),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const email = input.email.toLowerCase();
      const rows = await d1Query<UserRow>(
        "SELECT id, email, password_hash, name, plan, trial_ends_at, tokens_remaining FROM users WHERE email = ? LIMIT 1",
        [email],
      );
      const user = rows[0];
      /* Не палим, что email не существует — единый ответ для обоих
         случаев. */
      if (!user || !(await verifyPassword(input.password, user.password_hash))) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Неверный email или пароль",
        });
      }

      const token = await signJWT(user.id, getJwtSecret());
      ctx.setCookies.push(buildSessionCookie(token, { secure: isSecure() }));
      return { ok: true };
    }),

  logout: publicProcedure.mutation(({ ctx }) => {
    ctx.setCookies.push(buildClearCookie(isSecure()));
    return { ok: true };
  }),

  /* Текущий пользователь — основа для frontend-AuthContext. */
  me: publicProcedure.query(({ ctx }) => {
    if (!ctx.user) return null;
    return {
      id: ctx.user.id,
      email: ctx.user.email,
      name: ctx.user.name,
      plan: ctx.user.plan,
      trialEndsAt: ctx.user.trialEndsAt,
      tokensRemaining: ctx.user.tokensRemaining,
      role: ctx.user.role,
      emailVerified: ctx.user.emailVerified,
    };
  }),

  /* Подтверждение email по токену из ссылки в письме. Принимает
     только токен — авторизация не требуется (юзер мог не быть
     залогинен в браузере, где открыл письмо). После успеха
     одноразовый токен инвалидируется. */
  verifyEmail: publicProcedure
    .input(z.object({ token: z.string().min(20).max(200) }))
    .mutation(async ({ input }) => {
      const rows = await d1Query<{
        id: string;
        email_verified_at: number | null;
        email_verification_expires_at: number | null;
      }>(
        "SELECT id, email_verified_at, email_verification_expires_at FROM users WHERE email_verification_token = ? LIMIT 1",
        [input.token],
      );
      const u = rows[0];
      if (!u) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Ссылка недействительна или уже использована",
        });
      }
      if (u.email_verified_at) {
        /* Уже подтверждён ранее — идемпотентно возвращаем ok,
           одновременно чистим токен. */
        await d1Execute(
          "UPDATE users SET email_verification_token = NULL, email_verification_expires_at = NULL WHERE id = ?",
          [u.id],
        );
        return { ok: true, alreadyVerified: true };
      }
      if (
        !u.email_verification_expires_at ||
        u.email_verification_expires_at < Date.now()
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Срок действия ссылки истёк, запроси новое письмо",
        });
      }
      await d1Execute(
        "UPDATE users SET email_verified_at = ?, email_verification_token = NULL, email_verification_expires_at = NULL WHERE id = ?",
        [Date.now(), u.id],
      );
      return { ok: true, alreadyVerified: false };
    }),

  /* Повторная отправка письма верификации залогиненному юзеру. */
  resendVerification: protectedProcedure.mutation(async ({ ctx }) => {
    if (ctx.user.emailVerified) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Email уже подтверждён",
      });
    }
    await dispatchVerification(ctx.user.id, ctx.user.email);
    return { ok: true };
  }),

  /* Запрос на сброс пароля. Намеренно возвращаем ok даже если юзера
     с таким email нет — иначе endpoint становится оракулом для
     перебора зарегистрированных email'ов. Письмо уходит только тем,
     кто реально существует. */
  forgotPassword: publicProcedure
    .input(z.object({ email: emailSchema }))
    .mutation(async ({ input }) => {
      const email = input.email.toLowerCase();
      const rows = await d1Query<{ id: string }>(
        "SELECT id FROM users WHERE email = ? LIMIT 1",
        [email],
      );
      if (rows[0]) {
        await dispatchPasswordReset(rows[0].id, email);
      }
      return { ok: true };
    }),

  /* Установка нового пароля по reset-токену. Одноразовый: после
     успеха токен очищается. */
  resetPassword: publicProcedure
    .input(
      z.object({
        token: z.string().min(20).max(200),
        password: passwordSchema,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const rows = await d1Query<{
        id: string;
        email: string;
        password_reset_expires_at: number | null;
      }>(
        "SELECT id, email, password_reset_expires_at FROM users WHERE password_reset_token = ? LIMIT 1",
        [input.token],
      );
      const u = rows[0];
      if (
        !u ||
        !u.password_reset_expires_at ||
        u.password_reset_expires_at < Date.now()
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Ссылка недействительна или истекла",
        });
      }
      const passwordHash = await hashPassword(input.password);
      await d1Execute(
        "UPDATE users SET password_hash = ?, password_reset_token = NULL, password_reset_expires_at = NULL WHERE id = ?",
        [passwordHash, u.id],
      );
      /* После сброса пароля сразу логиним — это обычное UX-ожидание,
         не нужно после reset ещё и вводить новый пароль на форме
         логина. */
      const token = await signJWT(u.id, getJwtSecret());
      ctx.setCookies.push(buildSessionCookie(token, { secure: isSecure() }));
      return { ok: true };
    }),

  /* Обновление имени (для профиля). Email пока не меняем — это
     отдельная операция с подтверждением через письмо. */
  updateProfile: protectedProcedure
    .input(z.object({ name: z.string().trim().max(80) }))
    .mutation(async ({ input, ctx }) => {
      await d1Execute("UPDATE users SET name = ? WHERE id = ?", [
        input.name || null,
        ctx.user.id,
      ]);
      return { ok: true };
    }),
});
