import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { d1Execute, d1Query, isD1Configured } from "../_core/d1";
import { invokeRawForUser } from "../_core/llm-guard";
import { FITNESS_BASE_SYSTEM } from "../_core/voice-config";
import { loadVoiceCtx } from "../_core/voice";

/* ============================================================
   Идея #2 из доработок: «Сгенерировать ещё тем» прямо на главной.

   LLM возвращает N тем с теми же полями, что у захардкоженных
   стартовых тем (title, reason, format, potential). Пользователь
   может «Сохранить» — тогда они уходят в D1.user_topics и
   подмешиваются к стартовому списку при следующих заходах.
   ============================================================ */

const wsKey = z.string().min(8).max(64);

const POTENTIAL_VALUES = ["Вирусный", "Высокий", "Средний"] as const;
const FORMAT_HINT = [
  "Reels",
  "Reels + Карусель",
  "Пост",
  "Пост-инструкция",
  "Карусель",
  "Reels + Пост",
] as const;

type GeneratedTopic = {
  title: string;
  reason: string;
  format: string;
  potential: string;
};

export const topicsRouter = router({
  list: protectedProcedure
    .query(async ({ input, ctx }) => {
      if (!isD1Configured()) return [] as Array<GeneratedTopic & { id: string; createdAt: number; folderId: string | null }>;
      const rows = await d1Query<{
        id: string;
        title: string;
        reason: string;
        format: string;
        potential: string;
        created_at: number;
        folder_id: string | null;
      }>(
        "SELECT id, title, reason, format, potential, created_at, folder_id FROM user_topics WHERE workspace_key = ? ORDER BY created_at DESC LIMIT 200",
        [ctx.user.id],
      );
      return rows.map((r) => ({
        id: r.id,
        title: r.title,
        reason: r.reason,
        format: r.format,
        potential: r.potential,
        createdAt: r.created_at,
        folderId: r.folder_id ?? null,
      }));
    }),

  /* ─── Папки (коллекции) ─── */
  listFolders: protectedProcedure.query(async ({ ctx }) => {
    if (!isD1Configured()) return [] as Array<{ id: string; name: string; count: number }>;
    /* Возвращаем папки + счётчик тем в каждой одним запросом через
       LEFT JOIN, чтобы UI сразу показал «Питание · 12». */
    const rows = await d1Query<{ id: string; name: string; created_at: number; cnt: number }>(
      `SELECT f.id, f.name, f.created_at,
              (SELECT COUNT(*) FROM user_topics t WHERE t.folder_id = f.id) AS cnt
       FROM topic_folders f
       WHERE f.workspace_key = ?
       ORDER BY f.created_at ASC`,
      [ctx.user.id],
    );
    return rows.map((r) => ({ id: r.id, name: r.name, count: Number(r.cnt) || 0 }));
  }),

  createFolder: protectedProcedure
    .input(z.object({ name: z.string().trim().min(1).max(40) }))
    .mutation(async ({ input, ctx }) => {
      const id = crypto.randomUUID();
      await d1Execute(
        "INSERT INTO topic_folders (id, workspace_key, name, created_at) VALUES (?, ?, ?, ?)",
        [id, ctx.user.id, input.name, Date.now()],
      );
      return { id };
    }),

  renameFolder: protectedProcedure
    .input(z.object({ id: z.string(), name: z.string().trim().min(1).max(40) }))
    .mutation(async ({ input, ctx }) => {
      await d1Execute(
        "UPDATE topic_folders SET name = ? WHERE id = ? AND workspace_key = ?",
        [input.name, input.id, ctx.user.id],
      );
      return { ok: true };
    }),

  deleteFolder: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      /* Темы из папки не удаляем — обнуляем привязку, чтобы они
         вернулись в «Без папки». Сначала отвязываем, потом удаляем
         саму папку (двумя statements — D1 без ON DELETE триггеров). */
      await d1Execute(
        "UPDATE user_topics SET folder_id = NULL WHERE folder_id = ? AND workspace_key = ?",
        [input.id, ctx.user.id],
      );
      await d1Execute(
        "DELETE FROM topic_folders WHERE id = ? AND workspace_key = ?",
        [input.id, ctx.user.id],
      );
      return { ok: true };
    }),

  /* Переместить тему в папку (или вынуть — folderId=null). */
  setTopicFolder: protectedProcedure
    .input(z.object({ topicId: z.string(), folderId: z.string().nullable() }))
    .mutation(async ({ input, ctx }) => {
      await d1Execute(
        "UPDATE user_topics SET folder_id = ? WHERE id = ? AND workspace_key = ?",
        [input.folderId, input.topicId, ctx.user.id],
      );
      return { ok: true };
    }),

  generate: protectedProcedure
    .input(
      z.object({
        count: z.number().int().min(3).max(15).default(6),
        segment: z
          .enum(["women_25_45", "men_30_45", "ambitious_pro", "mixed"])
          .default("mixed"),
        /* Опциональный фильтр «избегать тем, похожих на эти». Передаём
           уже существующие заголовки, чтобы LLM не дублировал. */
        avoidTitles: z.array(z.string()).max(60).default([]),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const segmentHint =
        input.segment === "women_25_45"
          ? "Женщины 25-45, похудение/ягодицы/отёки, нет времени, психология срывов."
          : input.segment === "men_30_45"
            ? "Мужчины 30-45, офис/предприниматели, лишний вес, нет времени."
            : input.segment === "ambitious_pro"
              ? "Амбициозные профи 30-45 с высоким чеком, плато, стресс."
              : "Смешанная ЦА — чередуй темы под разные сегменты.";

      const avoidBlock =
        input.avoidTitles.length > 0
          ? `\n\nНЕ ПОВТОРЯЙ темы, похожие на:\n${input.avoidTitles
              .slice(0, 60)
              .map((t) => `- ${t.slice(0, 100)}`)
              .join("\n")}`
          : "";

      const voiceCtx = await loadVoiceCtx(ctx.user.id);
      const system = `${FITNESS_BASE_SYSTEM}${voiceCtx}

Текущая задача: предложить ${input.count} новых тем для контент-плана.
Опирайся на блок «ВИРАЛЬНЫЕ ПАТТЕРНЫ ЗАГОЛОВКОВ» из системного промпта.
ЦА: ${segmentHint}`;

      const user = `Сгенерируй ${input.count} новых тем. Каждая тема —
самостоятельная идея для отдельной публикации.

Выдай результат строго в JSON без markdown-обёртки:
{
  "topics": [
    {
      "title": "конкретный кликбейт-заголовок 4-10 слов",
      "reason": "1 предложение — почему эта тема зайдёт ЦА (боль/конкретика)",
      "format": "${FORMAT_HINT.join(" | ")}",
      "potential": "Вирусный | Высокий | Средний"
    }
  ]
}

Темы должны быть РАЗНЫМИ по паттерну (отрицание, цифра, провокация,
личная история, разбор мифа, чек-лист, до/после, вопрос-ответ).
Минимум 1-2 темы с пометкой "Вирусный". Без эмодзи в title.${avoidBlock}`;

      const r = await invokeRawForUser(ctx.user, {
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      });
      const raw = r.choices[0]?.message.content;
      if (typeof raw !== "string") throw new Error("LLM вернул пустой ответ");
      const cleaned = raw.replace(/^```(json)?/i, "").replace(/```$/i, "").trim();

      let topics: GeneratedTopic[] = [];
      try {
        const parsed = JSON.parse(cleaned) as { topics: GeneratedTopic[] };
        topics = (parsed.topics ?? [])
          .filter(
            (t) =>
              typeof t.title === "string" &&
              t.title.length > 4 &&
              t.title.length < 220 &&
              typeof t.reason === "string" &&
              t.reason.length > 4,
          )
          .map((t) => ({
            title: t.title.trim(),
            reason: t.reason.trim(),
            format: FORMAT_HINT.includes(t.format as typeof FORMAT_HINT[number])
              ? t.format
              : "Пост",
            potential: POTENTIAL_VALUES.includes(
              t.potential as typeof POTENTIAL_VALUES[number],
            )
              ? t.potential
              : "Высокий",
          }))
          .slice(0, input.count);
      } catch {
        throw new Error(
          `LLM не вернул валидный JSON. Сырой ответ: ${cleaned.slice(0, 240)}`,
        );
      }

      if (topics.length === 0) {
        throw new Error("LLM не предложил ни одной темы — попробуй ещё раз.");
      }

      const model = (r.model ?? "").replace(/^models\//, "");
      return { topics, model };
    }),

  save: protectedProcedure
    .input(
      z.object({
        title: z.string().min(3).max(220),
        reason: z.string().min(3).max(500),
        format: z.string().min(1).max(60),
        potential: z.string().min(1).max(30),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const id = crypto.randomUUID();
      const now = Date.now();
      await d1Execute(
        "INSERT INTO user_topics (id, workspace_key, title, reason, format, potential, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          id,
          ctx.user.id,
          input.title,
          input.reason,
          input.format,
          input.potential,
          now,
        ],
      );
      return { id, createdAt: now };
    }),

  saveBatch: protectedProcedure
    .input(
      z.object({
        topics: z
          .array(
            z.object({
              title: z.string().min(3).max(220),
              reason: z.string().min(3).max(500),
              format: z.string().min(1).max(60),
              potential: z.string().min(1).max(30),
            }),
          )
          .min(1)
          .max(20),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const now = Date.now();
      const ids: string[] = [];
      /* D1 REST не любит большие пачки, кладём по одной — десяток
         операций укладывается в Worker CPU-бюджет. */
      for (const t of input.topics) {
        const id = crypto.randomUUID();
        ids.push(id);
        await d1Execute(
          "INSERT INTO user_topics (id, workspace_key, title, reason, format, potential, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [id, ctx.user.id, t.title, t.reason, t.format, t.potential, now],
        );
      }
      return { ids, createdAt: now };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await d1Execute(
        "DELETE FROM user_topics WHERE workspace_key = ? AND id = ?",
        [ctx.user.id, input.id],
      );
      return { ok: true };
    }),
});
