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

/* ============================================================
   Auth router: регистрация / логин / выход / профиль.

   Stateless JWT в HTTP-only cookie. Регистрация требует согласие на
   обработку перс. данных (ФЗ-152) и пользовательское соглашение —
   оба чекбокса обязательные, бэкенд тоже проверяет.

   После регистрации юзер получает 3-дневный триал и 30 000 токенов
   (списываются в callLLM по usage из ответа Gemini).
   ============================================================ */

const TRIAL_DAYS = 3;
const TRIAL_TOKENS = 30_000;
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
    };
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
