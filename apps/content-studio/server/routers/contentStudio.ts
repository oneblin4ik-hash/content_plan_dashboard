import { z } from "zod";
import * as db from "../db";
import { adminProcedure, router } from "../_core/trpc";

const idInput = z.object({ id: z.number().int().positive() });
const dateField = z.union([z.null(), z.coerce.date()]).optional();
const itemFields = z.object({
  folderId: z.number().int().positive().nullable().optional(),
  kind: z.enum(["idea", "post", "reel"]).default("idea"),
  channel: z.enum(["telegram", "reels", "both"]).default("telegram"),
  status: z.enum(["draft", "planned", "ready", "published"]).default("draft"),
  priority: z.enum(["low", "medium", "high", "viral"]).default("medium"),
  segmentId: z.string().min(2).max(8).default("S3"),
  title: z.string().trim().min(2).max(280),
  hook: z.string().nullable().optional(),
  body: z.string().nullable().optional(),
  format: z.string().max(100).nullable().optional(),
  visual: z.string().nullable().optional(),
  cta: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  scheduledFor: dateField,
  isFavorite: z.boolean().default(false),
});

const itemUpdateFields = z.object({
  folderId: z.number().int().positive().nullable().optional(),
  kind: z.enum(["idea", "post", "reel"]).optional(),
  channel: z.enum(["telegram", "reels", "both"]).optional(),
  status: z.enum(["draft", "planned", "ready", "published"]).optional(),
  priority: z.enum(["low", "medium", "high", "viral"]).optional(),
  segmentId: z.string().min(2).max(8).optional(),
  title: z.string().trim().min(2).max(280).optional(),
  hook: z.string().nullable().optional(),
  body: z.string().nullable().optional(),
  format: z.string().max(100).nullable().optional(),
  visual: z.string().nullable().optional(),
  cta: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  scheduledFor: dateField,
  isFavorite: z.boolean().optional(),
});

const ownerId = (ctx: { user: { id: number } | null }) => ctx.user!.id;

export const contentStudioRouter = router({
  bootstrap: adminProcedure.query(async ({ ctx }) => {
    await db.bootstrapStudio(ownerId(ctx));
    return db.getStudioData(ownerId(ctx));
  }),
  folder: router({
    create: adminProcedure.input(z.object({ name: z.string().trim().min(1).max(80), color: z.string().regex(/^#[0-9A-Fa-f]{6}$/), sortOrder: z.number().int().min(0).optional() })).mutation(({ ctx, input }) => db.createFolder(ownerId(ctx), input)),
    update: adminProcedure.input(idInput.extend({ data: z.object({ name: z.string().trim().min(1).max(80).optional(), color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(), sortOrder: z.number().int().min(0).optional() }) })).mutation(async ({ ctx, input }) => { await db.updateFolder(ownerId(ctx), input.id, input.data); return { success: true }; }),
    delete: adminProcedure.input(idInput).mutation(async ({ ctx, input }) => { await db.deleteFolder(ownerId(ctx), input.id); return { success: true }; }),
  }),
  item: router({
    create: adminProcedure.input(itemFields).mutation(({ ctx, input }) => db.createContentItem(ownerId(ctx), input)),
    update: adminProcedure.input(idInput.extend({ data: itemUpdateFields })).mutation(async ({ ctx, input }) => { await db.updateContentItem(ownerId(ctx), input.id, input.data); return { success: true }; }),
    delete: adminProcedure.input(idInput).mutation(async ({ ctx, input }) => { await db.deleteContentItem(ownerId(ctx), input.id); return { success: true }; }),
  }),
  template: router({
    create: adminProcedure.input(z.object({ kind: z.enum(["post", "reel"]), name: z.string().trim().min(2).max(120), description: z.string().nullable().optional(), structure: z.string().trim().min(3), isActive: z.boolean().default(true) })).mutation(({ ctx, input }) => db.createTemplate(ownerId(ctx), input)),
    update: adminProcedure.input(idInput.extend({ data: z.object({ name: z.string().trim().min(2).max(120).optional(), description: z.string().nullable().optional(), structure: z.string().trim().min(3).optional(), isActive: z.boolean().optional() }) })).mutation(async ({ ctx, input }) => { await db.updateTemplate(ownerId(ctx), input.id, input.data); return { success: true }; }),
    delete: adminProcedure.input(idInput).mutation(async ({ ctx, input }) => { await db.deleteTemplate(ownerId(ctx), input.id); return { success: true }; }),
  }),
  voice: router({
    update: adminProcedure.input(z.object({ name: z.string().trim().min(2).max(120).optional(), tone: z.string().min(2).optional(), address: z.string().min(2).max(40).optional(), energy: z.string().min(2).optional(), structure: z.string().min(2).optional(), proof: z.string().min(2).optional(), cta: z.string().min(2).optional(), avoid: z.string().min(2).optional(), notes: z.string().nullable().optional() })).mutation(async ({ ctx, input }) => { await db.updateVoiceProfile(ownerId(ctx), input); return { success: true }; }),
  }),
  segment: router({
    update: adminProcedure.input(idInput.extend({ data: z.object({ sortOrder: z.number().int().min(1).optional(), name: z.string().trim().min(2).max(120).optional(), title: z.string().trim().min(2).max(180).optional(), subtitle: z.string().min(2).optional(), goal: z.string().min(2).optional(), pain: z.string().min(2).optional(), fear: z.string().min(2).optional(), trigger: z.string().min(2).optional(), offer: z.string().min(2).optional(), color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional() }) })).mutation(async ({ ctx, input }) => { await db.updateSegment(ownerId(ctx), input.id, input.data); return { success: true }; }),
  }),
  settings: router({
    update: adminProcedure.input(z.object({ activeSegmentId: z.string().min(2).max(8).optional(), strategyGoal: z.string().nullable().optional() })).mutation(async ({ ctx, input }) => { await db.updateSettings(ownerId(ctx), input); return { success: true }; }),
  }),
  metric: router({
    create: adminProcedure.input(z.object({ itemId: z.number().int().positive(), capturedAt: z.coerce.date().optional(), views: z.number().int().min(0).default(0), reactions: z.number().int().min(0).default(0), comments: z.number().int().min(0).default(0), saves: z.number().int().min(0).default(0), shares: z.number().int().min(0).default(0), linkClicks: z.number().int().min(0).default(0), leads: z.number().int().min(0).default(0), notes: z.string().nullable().optional() })).mutation(({ ctx, input }) => db.createMetric(ownerId(ctx), input)),
  }),
});
