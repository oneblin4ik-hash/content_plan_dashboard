import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { d1Query, d1Execute, isD1Configured } from "../_core/d1";
import { invokeRawForUser } from "../_core/llm-guard";
import { FITNESS_BASE_SYSTEM } from "../_core/voice-config";

/* ============================================================
   Metrics router — учёт реальных публикаций и AI-инсайты
   (идея #5 из роадмапа).

   Пользователь после публикации заносит метрики поста, раз в
   неделю жмёт «Получить AI-инсайты» — Gemini анализирует накопленные
   данные и выдаёт текстовый отчёт: какие темы зашли, какие провалились,
   на чём концентрироваться следующие 7 дней.

   Скоупинг по workspace_key, как и в sync/media router.
   ============================================================ */

const wsKey = z
  .string()
  .min(8, "Workspace key минимум 8 символов")
  .max(64, "Workspace key максимум 64 символа");

type DbMetricRow = {
  id: string;
  workspace_key: string;
  post_title: string;
  post_type: string;
  platform: string | null;
  topic: string | null;
  published_at: number;
  views: number;
  reactions: number;
  comments: number;
  saves: number;
  shares: number;
  notes: string | null;
  created_at: number;
};

function rowToMetric(r: DbMetricRow) {
  const totalEngagement =
    r.reactions + r.comments + r.saves + r.shares;
  const erPercent =
    r.views > 0 ? (totalEngagement / r.views) * 100 : 0;
  return {
    id: r.id,
    postTitle: r.post_title,
    postType: r.post_type,
    platform: r.platform,
    topic: r.topic,
    publishedAt: r.published_at,
    views: r.views,
    reactions: r.reactions,
    comments: r.comments,
    saves: r.saves,
    shares: r.shares,
    notes: r.notes,
    erPercent: Math.round(erPercent * 100) / 100,
    createdAt: r.created_at,
  };
}

export const metricsRouter = router({
  status: protectedProcedure.query(() => ({
    enabled: isD1Configured(),
  })),

  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(500).default(100),
      }),
    )
    .query(async ({ input, ctx }) => {
      const rows = await d1Query<DbMetricRow>(
        "SELECT id, workspace_key, post_title, post_type, platform, topic, published_at, views, reactions, comments, saves, shares, notes, created_at FROM post_metrics WHERE workspace_key = ? ORDER BY published_at DESC LIMIT ?",
        [ctx.user.id, input.limit],
      );
      return rows.map(rowToMetric);
    }),

  add: protectedProcedure
    .input(
      z.object({
        postTitle: z.string().min(1).max(300),
        postType: z.enum(["post", "reels", "carousel", "story", "other"]),
        platform: z.enum(["telegram", "instagram", "youtube", "other"]).nullable(),
        topic: z.string().max(120).optional(),
        publishedAt: z.number().int(),
        views: z.number().int().min(0).default(0),
        reactions: z.number().int().min(0).default(0),
        comments: z.number().int().min(0).default(0),
        saves: z.number().int().min(0).default(0),
        shares: z.number().int().min(0).default(0),
        notes: z.string().max(1000).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const id = crypto.randomUUID();
      const now = Date.now();
      await d1Execute(
        `INSERT INTO post_metrics
           (id, workspace_key, post_title, post_type, platform, topic, published_at,
            views, reactions, comments, saves, shares, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          ctx.user.id,
          input.postTitle,
          input.postType,
          input.platform ?? null,
          input.topic ?? null,
          input.publishedAt,
          input.views,
          input.reactions,
          input.comments,
          input.saves,
          input.shares,
          input.notes ?? null,
          now,
        ],
      );
      return { id, createdAt: now };
    }),

  /* Inline-правка: пользователь часто ошибается в цифрах при ручном
     вводе (или донабирает данные через сутки). Меняем только counter'ы
     и notes — title/type/platform/topic нечего править: ошибся —
     быстрее удалить и завести заново. */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        views: z.number().int().min(0),
        reactions: z.number().int().min(0),
        comments: z.number().int().min(0),
        saves: z.number().int().min(0),
        shares: z.number().int().min(0),
        notes: z.string().max(1000).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await d1Execute(
        `UPDATE post_metrics
           SET views = ?, reactions = ?, comments = ?, saves = ?, shares = ?, notes = ?
         WHERE workspace_key = ? AND id = ?`,
        [
          input.views,
          input.reactions,
          input.comments,
          input.saves,
          input.shares,
          input.notes ?? null,
          ctx.user.id,
          input.id,
        ],
      );
      return { ok: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await d1Execute(
        "DELETE FROM post_metrics WHERE workspace_key = ? AND id = ?",
        [ctx.user.id, input.id],
      );
      return { ok: true };
    }),

  insights: protectedProcedure
    .input(
      z.object({
        /* По умолчанию анализируем посты за последние 30 дней, но юзер
           может попросить shorter/longer window. */
        windowDays: z.number().int().min(7).max(180).default(30),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const since = Date.now() - input.windowDays * 24 * 60 * 60 * 1000;
      const rows = await d1Query<DbMetricRow>(
        "SELECT id, workspace_key, post_title, post_type, platform, topic, published_at, views, reactions, comments, saves, shares, notes, created_at FROM post_metrics WHERE workspace_key = ? AND published_at >= ? ORDER BY published_at DESC LIMIT 200",
        [ctx.user.id, since],
      );
      const metrics = rows.map(rowToMetric);

      if (metrics.length < 3) {
        return {
          report: null,
          metricsAnalyzed: metrics.length,
          windowDays: input.windowDays,
          needsMore: true,
          message:
            "Чтобы был смысл — занеси минимум 3 публикации за выбранный период.",
        };
      }

      /* Формируем компактную таблицу для LLM. */
      const table = metrics
        .map((m) => {
          const date = new Date(m.publishedAt).toISOString().slice(0, 10);
          return `${date} | ${m.postType.padEnd(8)} | ${m.platform ?? "—"} | ER ${m.erPercent}% | views ${m.views} | r ${m.reactions} c ${m.comments} s ${m.saves} sh ${m.shares} | "${m.postTitle.slice(0, 60)}"${m.topic ? " #" + m.topic : ""}${m.notes ? " // " + m.notes.slice(0, 80) : ""}`;
        })
        .join("\n");

      /* Считаем простые агрегаты заранее, чтобы LLM не ошибся в арифметике. */
      const totalViews = metrics.reduce((s, m) => s + m.views, 0);
      const avgEr =
        metrics.reduce((s, m) => s + m.erPercent, 0) / metrics.length;
      const byType: Record<string, { count: number; avgEr: number; totalViews: number }> =
        {};
      for (const m of metrics) {
        const k = m.postType;
        if (!byType[k]) byType[k] = { count: 0, avgEr: 0, totalViews: 0 };
        byType[k].count++;
        byType[k].avgEr += m.erPercent;
        byType[k].totalViews += m.views;
      }
      for (const k of Object.keys(byType)) {
        byType[k].avgEr = Math.round((byType[k].avgEr / byType[k].count) * 100) / 100;
      }

      const aggregates = `Всего публикаций: ${metrics.length}
Сумма просмотров: ${totalViews}
Средний ER: ${Math.round(avgEr * 100) / 100}%
По типам: ${Object.entries(byType)
        .map(
          ([k, v]) =>
            `${k}=${v.count}шт (avg ER ${v.avgEr}%, views ${v.totalViews})`,
        )
        .join(", ")}`;

      const system = `${FITNESS_BASE_SYSTEM}

Текущая задача: проанализировать накопленную статистику публикаций автора
и выдать конкретный отчёт-инсайт. Не льсти, не размазывай — это рабочий
разбор для самого себя. Опирайся ТОЛЬКО на цифры из переданной таблицы.
Если в данных недостаточно паттернов — так и скажи.

Формат отчёта (придерживайся структуры, без отступов от неё):

🥇 Что зашло лучше всего
[2-3 пункта с конкретными ER% и просмотрами из таблицы. Объясни почему
зашло — паттерн (рубрика, формат, тема, тон).]

🟡 Серединка
[1-2 пункта — то, что показало среднюю динамику.]

🔻 Что провалилось
[1-3 пункта с цифрами. Будь честным, не маскируй.]

📊 Паттерны
[2-3 наблюдения из всей выборки: какие темы/типы/платформы вытягивают.]

🎯 Рекомендации на следующие 7 дней
[3-5 конкретных действий: что повторить, что не делать, какую гипотезу
проверить. Никакой воды.]`;

      const user = `АГРЕГАТЫ:
${aggregates}

ТАБЛИЦА ПУБЛИКАЦИЙ (последние ${input.windowDays} дней):
${table}

Сделай разбор по формату из системного промпта.`;

      const r = await invokeRawForUser(ctx.user, {
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      });
      const report = r.choices[0]?.message.content;
      if (typeof report !== "string") {
        throw new Error("LLM вернул пустой инсайт");
      }
      return {
        report,
        metricsAnalyzed: metrics.length,
        windowDays: input.windowDays,
        needsMore: false,
        aggregates: {
          totalViews,
          avgEr: Math.round(avgEr * 100) / 100,
          byType,
        },
      };
    }),
});
