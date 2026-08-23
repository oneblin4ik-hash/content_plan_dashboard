import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { adminProcedure, router } from "../_core/trpc";
import { d1Query, d1Execute } from "../_core/d1";
import { sendEmail, buildPasswordResetEmail, getAppUrl } from "../_core/email";

/* ============================================================
   Admin router. Доступ — только email'ы из env-секрета
   ADMIN_EMAILS (см. worker/index.ts:loadUserFromRequest), которые
   получают role="admin". adminProcedure (server/_core/trpc.ts:30)
   уже проверяет ctx.user.role === "admin" и иначе бросает FORBIDDEN.

   Что админ умеет:
   - listUsers: видеть всех зарегистрированных
   - updateUser: менять баланс токенов / дату окончания триала /
     план / имя
   - deleteUser: удалить юзера (его данные в других таблицах
     остаются — по workspace_key = user.id они становятся осиротевшими,
     но не мешают; полная каскадная чистка — отдельной операцией).
   ============================================================ */

type UserListRow = {
  id: string;
  email: string;
  name: string | null;
  plan: string;
  created_at: number;
  trial_ends_at: number;
  tokens_remaining: number;
  tokens_used_total: number;
};

export const adminRouter = router({
  listUsers: adminProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(500).default(200),
          search: z.string().trim().max(120).optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const limit = input?.limit ?? 200;
      const search = input?.search?.trim() ?? "";
      const rows = search
        ? await d1Query<UserListRow>(
            `SELECT id, email, name, plan, created_at, trial_ends_at,
                    tokens_remaining, tokens_used_total
             FROM users
             WHERE email LIKE ? OR COALESCE(name,'') LIKE ?
             ORDER BY created_at DESC LIMIT ?`,
            [`%${search}%`, `%${search}%`, limit],
          )
        : await d1Query<UserListRow>(
            `SELECT id, email, name, plan, created_at, trial_ends_at,
                    tokens_remaining, tokens_used_total
             FROM users ORDER BY created_at DESC LIMIT ?`,
            [limit],
          );
      return rows.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        plan: u.plan,
        createdAt: u.created_at,
        trialEndsAt: u.trial_ends_at,
        tokensRemaining: u.tokens_remaining,
        tokensUsedTotal: u.tokens_used_total,
      }));
    }),

  updateUser: adminProcedure
    .input(
      z.object({
        id: z.string().min(1),
        /* Все поля опциональные — обновляем только то, что пришло.
           tokensDelta — относительное изменение (+1000, -500); если
           нужно выставить абсолют, используется setTokens. */
        tokensDelta: z.number().int().optional(),
        setTokens: z.number().int().min(0).optional(),
        /* Срок триала в днях от сегодня (заменяет, не прибавляет). */
        trialDays: z.number().int().min(0).max(3650).optional(),
        plan: z.enum(["trial", "pro", "team"]).optional(),
        name: z.string().trim().max(80).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (input.id === ctx.user.id && input.plan && input.plan !== "trial") {
        /* Чтобы случайно не «забанить себя», уважаем admin-флаг
           (он всё равно через env, plan тут не влияет, но
           оставлю на будущее, когда роль будет в БД). */
      }

      const sets: string[] = [];
      const args: (string | number | null)[] = [];

      if (typeof input.setTokens === "number") {
        sets.push("tokens_remaining = ?");
        args.push(input.setTokens);
      } else if (typeof input.tokensDelta === "number") {
        sets.push(
          "tokens_remaining = MAX(0, tokens_remaining + ?)",
        );
        args.push(input.tokensDelta);
      }
      if (typeof input.trialDays === "number") {
        sets.push("trial_ends_at = ?");
        args.push(Date.now() + input.trialDays * 24 * 60 * 60 * 1000);
      }
      if (input.plan) {
        sets.push("plan = ?");
        args.push(input.plan);
      }
      if (input.name !== undefined) {
        sets.push("name = ?");
        args.push(input.name || null);
      }

      if (sets.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Нечего обновлять",
        });
      }
      args.push(input.id);
      await d1Execute(
        `UPDATE users SET ${sets.join(", ")} WHERE id = ?`,
        args,
      );
      return { ok: true };
    }),

  deleteUser: adminProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      if (input.id === ctx.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Нельзя удалить самого себя",
        });
      }
      await d1Execute("DELETE FROM users WHERE id = ?", [input.id]);
      return { ok: true };
    }),

  /* Сводка для дашборда: сколько юзеров, активных триалов, всего
     токенов израсходовано, средний расход. Простой агрегат — один
     SELECT, дешёво. */
  stats: adminProcedure.query(async () => {
    const rows = await d1Query<{
      total: number;
      active_trials: number;
      paid: number;
      tokens_used: number;
    }>(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN plan = 'trial' AND trial_ends_at > ? THEN 1 ELSE 0 END) AS active_trials,
         SUM(CASE WHEN plan != 'trial' THEN 1 ELSE 0 END) AS paid,
         COALESCE(SUM(tokens_used_total), 0) AS tokens_used
       FROM users`,
      [Date.now()],
    );
    const r = rows[0] ?? {
      total: 0,
      active_trials: 0,
      paid: 0,
      tokens_used: 0,
    };
    return {
      totalUsers: Number(r.total) || 0,
      activeTrials: Number(r.active_trials) || 0,
      paidUsers: Number(r.paid) || 0,
      tokensUsedTotal: Number(r.tokens_used) || 0,
    };
  }),

  /* Диагностика почты: пробует отправить тестовое password-reset-
     письмо на указанный адрес через Resend, возвращает реальный
     ответ провайдера. Нужно, чтобы понять, доходят ли письма и
     если нет — какая именно ошибка (sandbox-restriction, не
     верифицирован домен FROM и т.п.). */
  testEmail: adminProcedure
    .input(
      z.object({
        to: z.string().email(),
      }),
    )
    .mutation(async ({ input }) => {
      const url = "https://example.com/reset-password?token=test-diagnostic";
      const r = await sendEmail(
        buildPasswordResetEmail({ email: input.to, url }),
      );
      return r;
    }),

  /* Активные ссылки восстановления и подтверждения — нужны админу,
     чтобы отдать рукой, пока в Resend не верифицирован домен и
     письма не доходят до mail.ru / yandex / etc. */
  pendingLinks: adminProcedure.query(async () => {
    const now = Date.now();
    const rows = await d1Query<{
      email: string;
      verify_token: string | null;
      verify_exp: number | null;
      reset_token: string | null;
      reset_exp: number | null;
      email_verified_at: number | null;
    }>(
      `SELECT email,
              email_verification_token AS verify_token,
              email_verification_expires_at AS verify_exp,
              password_reset_token AS reset_token,
              password_reset_expires_at AS reset_exp,
              email_verified_at
         FROM users
        WHERE (email_verification_token IS NOT NULL
                 AND email_verification_expires_at > ?)
           OR (password_reset_token IS NOT NULL
                 AND password_reset_expires_at > ?)
        ORDER BY COALESCE(reset_exp, verify_exp) DESC
        LIMIT 100`,
      [now, now],
    );
    const base = getAppUrl();
    return rows.flatMap((r) => {
      const out: Array<{
        kind: "verify" | "reset";
        email: string;
        url: string;
        expiresAt: number;
      }> = [];
      if (r.reset_token && r.reset_exp && r.reset_exp > now) {
        out.push({
          kind: "reset",
          email: r.email,
          url: `${base}/reset-password?token=${r.reset_token}`,
          expiresAt: r.reset_exp,
        });
      }
      /* Подтверждение показываем только если юзер ещё не verified —
         иначе токен висит как мусор. */
      if (
        !r.email_verified_at &&
        r.verify_token &&
        r.verify_exp &&
        r.verify_exp > now
      ) {
        out.push({
          kind: "verify",
          email: r.email,
          url: `${base}/verify-email?token=${r.verify_token}`,
          expiresAt: r.verify_exp,
        });
      }
      return out;
    });
  }),
});
