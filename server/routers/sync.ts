import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { d1Query, d1Execute, isD1Configured } from "../_core/d1";

/**
 * Sync router — cross-device persistence for Content Studio via Cloudflare D1.
 *
 * Identity model: a "workspace key" — a UUID stored client-side that scopes
 * data. To sync to another device, the user pastes the same workspace key.
 * No accounts, no passwords, no PII. Aligns with the brand's "система,
 * а не марафон" — minimal friction.
 */

const wsKey = z
  .string()
  .min(8, "Workspace key минимум 8 символов")
  .max(64, "Workspace key максимум 64 символа");

const modeEnum = z.enum([
  "pack",
  "post",
  "reels",
  "hooks",
  "hashtags",
  "carousel",
]);

export const syncRouter = router({
  /** Lightweight health check the client uses to decide localStorage vs cloud. */
  status: protectedProcedure.query(() => ({
    enabled: isD1Configured(),
  })),

  library: router({
    list: protectedProcedure
      .input(z.object({ limit: z.number().int().min(1).max(200).default(100) }))
      .query(async ({ input, ctx }) => {
        const rows = await d1Query<{
          id: string;
          title: string;
          mode: string;
          platform: string | null;
          payload_json: string;
          created_at: number;
        }>(
          "SELECT id, title, mode, platform, payload_json, created_at FROM generations WHERE workspace_key = ? ORDER BY created_at DESC LIMIT ?",
          [ctx.user.id, input.limit]
        );
        return rows.map((r) => ({
          id: r.id,
          title: r.title,
          mode: r.mode,
          platform: r.platform,
          payload: JSON.parse(r.payload_json),
          createdAt: r.created_at,
        }));
      }),

    save: protectedProcedure
      .input(
        z.object({
          id: z.string().uuid().optional(),
          title: z.string().min(1),
          mode: modeEnum,
          platform: z.string().optional(),
          payload: z.unknown(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const id = input.id ?? crypto.randomUUID();
        const now = Date.now();
        await d1Execute(
          "INSERT INTO generations (id, workspace_key, title, mode, platform, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [
            id,
            ctx.user.id,
            input.title,
            input.mode,
            input.platform ?? null,
            JSON.stringify(input.payload),
            now,
          ]
        );
        return { id, createdAt: now };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input, ctx }) => {
        await d1Execute(
          "DELETE FROM generations WHERE workspace_key = ? AND id = ?",
          [ctx.user.id, input.id]
        );
        return { ok: true };
      }),

    clear: protectedProcedure
      
      .mutation(async ({ input, ctx }) => {
        await d1Execute("DELETE FROM generations WHERE workspace_key = ?", [
          ctx.user.id,
        ]);
        return { ok: true };
      }),
  }),

  scheduled: router({
    list: protectedProcedure
      
      .query(async ({ input, ctx }) => {
        const rows = await d1Query<{
          id: string;
          date: string;
          title: string;
          format: string | null;
          topic_id: number | null;
          status: string;
          created_at: number;
        }>(
          "SELECT id, date, title, format, topic_id, status, created_at FROM scheduled WHERE workspace_key = ? ORDER BY date ASC",
          [ctx.user.id]
        );
        return rows.map((r) => ({
          id: r.id,
          date: r.date,
          title: r.title,
          format: r.format,
          topicId: r.topic_id,
          status: r.status,
          createdAt: r.created_at,
        }));
      }),

    save: protectedProcedure
      .input(
        z.object({
          id: z.string().uuid().optional(),
          date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          title: z.string().min(1),
          format: z.string().optional(),
          topicId: z.number().int().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const id = input.id ?? crypto.randomUUID();
        await d1Execute(
          "INSERT INTO scheduled (id, workspace_key, date, title, format, topic_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'planned', ?)",
          [
            id,
            ctx.user.id,
            input.date,
            input.title,
            input.format ?? null,
            input.topicId ?? null,
            Date.now(),
          ]
        );
        return { id };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input, ctx }) => {
        await d1Execute(
          "DELETE FROM scheduled WHERE workspace_key = ? AND id = ?",
          [ctx.user.id, input.id]
        );
        return { ok: true };
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.string(),
          date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
          title: z.string().min(1).optional(),
          format: z.string().optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        const sets: string[] = [];
        const params: (string | number | null)[] = [];
        if (input.date !== undefined) {
          sets.push("date = ?");
          params.push(input.date);
        }
        if (input.title !== undefined) {
          sets.push("title = ?");
          params.push(input.title);
        }
        if (input.format !== undefined) {
          sets.push("format = ?");
          params.push(input.format ?? null);
        }
        if (sets.length === 0) return { ok: true };
        params.push(ctx.user.id, input.id);
        await d1Execute(
          `UPDATE scheduled SET ${sets.join(", ")} WHERE workspace_key = ? AND id = ?`,
          params,
        );
        return { ok: true };
      }),
  }),

  publishedState: router({
    list: protectedProcedure
      
      .query(async ({ input, ctx }) => {
        return await d1Query<{
          topic_id: number;
          published: number;
          views: number;
          engagement_rate_x100: number;
        }>(
          "SELECT topic_id, published, views, engagement_rate_x100 FROM published_state WHERE workspace_key = ?",
          [ctx.user.id]
        );
      }),

    upsert: protectedProcedure
      .input(
        z.object({
          topicId: z.number().int(),
          published: z.boolean(),
          views: z.number().int().default(0),
          engagementRateX100: z.number().int().default(0),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await d1Execute(
          `INSERT INTO published_state (workspace_key, topic_id, published, views, engagement_rate_x100, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(workspace_key, topic_id) DO UPDATE SET
             published = excluded.published,
             views = excluded.views,
             engagement_rate_x100 = excluded.engagement_rate_x100,
             updated_at = excluded.updated_at`,
          [
            ctx.user.id,
            input.topicId,
            input.published ? 1 : 0,
            input.views,
            input.engagementRateX100,
            Date.now(),
          ]
        );
        return { ok: true };
      }),
  }),
});
