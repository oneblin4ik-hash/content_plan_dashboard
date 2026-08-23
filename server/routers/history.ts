import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { d1Query, d1Execute, isD1Configured } from "../_core/d1";

/* ============================================================
   История генераций (P1.2 — сравнение версий).
   list — последние N записей юзера, опционально фильтр по title для
   «покажи все мои попытки на эту тему».
   get — конкретная запись по id (для модалки сравнения).
   delete — удалить запись.

   Запись в историю делается из content router через recordGeneration
   (см. server/_core/generation-history.ts).
   ============================================================ */

export const historyRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(50).default(20),
          /* Фильтр по теме — show «попытки по этому title». Сравнение
             через LIKE без чувствительности к регистру: D1 SQLite
             поддерживает LOWER. */
          titleLike: z.string().trim().max(200).optional(),
          kind: z.string().max(20).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      if (!isD1Configured()) return [];
      const limit = input?.limit ?? 20;
      const cond: string[] = ["workspace_key = ?"];
      const args: (string | number)[] = [ctx.user.id];
      if (input?.titleLike) {
        /* D1 SQLite не имеет ICU — LOWER() работает только с ASCII.
           Для кириллицы LIKE по-умолчанию case-sensitive. Юзер
           обычно ищет историю по той же теме, которую ввёл в Студии
           (та же кэйс-форма), поэтому простой LIKE %X% подходит. */
        cond.push("title LIKE ?");
        args.push(`%${input.titleLike}%`);
      }
      if (input?.kind) {
        cond.push("kind = ?");
        args.push(input.kind);
      }
      args.push(limit);
      const rows = await d1Query<{
        id: string;
        kind: string;
        title: string;
        payload: string;
        created_at: number;
      }>(
        `SELECT id, kind, title, payload, created_at FROM generation_history
         WHERE ${cond.join(" AND ")}
         ORDER BY created_at DESC LIMIT ?`,
        args,
      );
      return rows.map((r) => {
        let payload: unknown = null;
        try {
          payload = JSON.parse(r.payload);
        } catch {
          /* битый JSON — клиент покажет «—» */
        }
        return {
          id: r.id,
          kind: r.kind,
          title: r.title,
          payload,
          createdAt: r.created_at,
        };
      });
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const rows = await d1Query<{
        id: string;
        kind: string;
        title: string;
        payload: string;
        created_at: number;
      }>(
        "SELECT id, kind, title, payload, created_at FROM generation_history WHERE id = ? AND workspace_key = ? LIMIT 1",
        [input.id, ctx.user.id],
      );
      const r = rows[0];
      if (!r) return null;
      let payload: unknown = null;
      try {
        payload = JSON.parse(r.payload);
      } catch {
        /* битый JSON */
      }
      return {
        id: r.id,
        kind: r.kind,
        title: r.title,
        payload,
        createdAt: r.created_at,
      };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await d1Execute(
        "DELETE FROM generation_history WHERE id = ? AND workspace_key = ?",
        [input.id, ctx.user.id],
      );
      return { ok: true };
    }),
});
