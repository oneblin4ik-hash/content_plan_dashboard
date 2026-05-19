import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { d1Query, d1Execute, isD1Configured } from "../_core/d1";
import { invokeLLM } from "../_core/llm";
import { SERBOLIN_SYSTEM_PROMPT } from "../_core/brand-knowledge";

/* ============================================================
   Media router — банк фото/видео для подбора к постам.

   v1: метаданные + ссылки на внешние URL (или R2-ключи, когда
   R2 binding появится). Поиск двух типов:
   - keyword: текстовое совпадение по title/description/tags
   - match-for-text: LLM подбирает 3 наиболее подходящих под пост

   Скоупинг по workspace_key, как и в sync router.
   ============================================================ */

const wsKey = z
  .string()
  .min(8, "Workspace key минимум 8 символов")
  .max(64, "Workspace key максимум 64 символа");

type DbMediaRow = {
  id: string;
  workspace_key: string;
  title: string;
  description: string;
  tags: string;
  source_url: string;
  thumbnail_url: string | null;
  content_type: string;
  r2_key: string | null;
  created_at: number;
};

function rowToItem(r: DbMediaRow) {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    tags: r.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    sourceUrl: r.source_url,
    thumbnailUrl: r.thumbnail_url ?? null,
    contentType: r.content_type,
    createdAt: r.created_at,
  };
}

export const mediaRouter = router({
  status: publicProcedure.query(() => ({
    enabled: isD1Configured(),
  })),

  list: publicProcedure
    .input(
      z.object({
        workspaceKey: wsKey,
        limit: z.number().int().min(1).max(200).default(60),
      }),
    )
    .query(async ({ input }) => {
      const rows = await d1Query<DbMediaRow>(
        "SELECT id, workspace_key, title, description, tags, source_url, thumbnail_url, content_type, r2_key, created_at FROM media_items WHERE workspace_key = ? ORDER BY created_at DESC LIMIT ?",
        [input.workspaceKey, input.limit],
      );
      return rows.map(rowToItem);
    }),

  add: publicProcedure
    .input(
      z.object({
        workspaceKey: wsKey,
        title: z.string().min(1).max(200),
        description: z.string().max(2000).default(""),
        tags: z.array(z.string().min(1).max(40)).max(20).default([]),
        sourceUrl: z.string().url("Нужен валидный URL"),
        thumbnailUrl: z.string().url().optional(),
        contentType: z.enum(["image", "video"]).default("image"),
      }),
    )
    .mutation(async ({ input }) => {
      const id = crypto.randomUUID();
      const now = Date.now();
      await d1Execute(
        "INSERT INTO media_items (id, workspace_key, title, description, tags, source_url, thumbnail_url, content_type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          id,
          input.workspaceKey,
          input.title,
          input.description,
          input.tags.join(","),
          input.sourceUrl,
          input.thumbnailUrl ?? null,
          input.contentType,
          now,
        ],
      );
      return { id, createdAt: now };
    }),

  delete: publicProcedure
    .input(z.object({ workspaceKey: wsKey, id: z.string() }))
    .mutation(async ({ input }) => {
      await d1Execute(
        "DELETE FROM media_items WHERE workspace_key = ? AND id = ?",
        [input.workspaceKey, input.id],
      );
      return { ok: true };
    }),

  search: publicProcedure
    .input(z.object({ workspaceKey: wsKey, q: z.string().min(1).max(200) }))
    .query(async ({ input }) => {
      const q = `%${input.q.toLowerCase()}%`;
      const rows = await d1Query<DbMediaRow>(
        `SELECT id, workspace_key, title, description, tags, source_url, thumbnail_url, content_type, r2_key, created_at
         FROM media_items
         WHERE workspace_key = ?
           AND (LOWER(title) LIKE ? OR LOWER(description) LIKE ? OR LOWER(tags) LIKE ?)
         ORDER BY created_at DESC LIMIT 30`,
        [input.workspaceKey, q, q, q],
      );
      return rows.map(rowToItem);
    }),

  matchForText: publicProcedure
    .input(
      z.object({
        workspaceKey: wsKey,
        text: z.string().min(20),
        count: z.number().int().min(1).max(5).default(3),
      }),
    )
    .mutation(async ({ input }) => {
      /* Тянем все медиа юзера, формируем мини-каталог для LLM,
         просим выбрать индексы 3 лучших. Подход дешёвый: 1 LLM-запрос
         на 1 матчинг. До 100 медиа в каталоге работает без проблем. */
      const rows = await d1Query<DbMediaRow>(
        "SELECT id, workspace_key, title, description, tags, source_url, thumbnail_url, content_type, r2_key, created_at FROM media_items WHERE workspace_key = ? ORDER BY created_at DESC LIMIT 100",
        [input.workspaceKey],
      );
      if (rows.length === 0) return { matches: [] };

      const catalog = rows
        .map(
          (r, i) =>
            `[${i}] ${r.title}${r.description ? " — " + r.description : ""}${
              r.tags ? " · теги: " + r.tags : ""
            }`,
        )
        .join("\n");

      const system = `${SERBOLIN_SYSTEM_PROMPT}

Текущая задача: подобрать изображения/видео из банка пользователя, наиболее
подходящие к посту. Выдай только индексы из каталога — не выдумывай.`;

      const user = `ПОСТ:
"""
${input.text.slice(0, 2000)}
"""

КАТАЛОГ МЕДИА (по одной строке: [индекс] описание):
${catalog}

Выбери ${input.count} лучших совпадений. Верни JSON без markdown-обёртки:
{
  "matches": [
    { "index": <число>, "reason": "<коротко, 1 фраза почему подходит>" }
  ]
}
Если ничего реально не подходит — верни пустой массив matches.`;

      const r = await invokeLLM({
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      });
      const raw = r.choices[0]?.message.content;
      if (typeof raw !== "string") throw new Error("LLM пустой ответ");
      const cleaned = raw
        .replace(/^```(json)?/i, "")
        .replace(/```$/i, "")
        .trim();
      let parsed: { matches: Array<{ index: number; reason: string }> };
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        return { matches: [] };
      }
      const matches = (parsed.matches ?? [])
        .filter((m) => m.index >= 0 && m.index < rows.length)
        .slice(0, input.count)
        .map((m) => ({
          item: rowToItem(rows[m.index]),
          reason: m.reason,
        }));
      return { matches };
    }),
});
