import { Hono } from "hono";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  folderCreateSchema,
  folderUpdateSchema,
  generateRequestSchema,
  ideaCreateSchema,
  ideaQuerySchema,
  ideaUpdateSchema,
  importSchema,
  materialCreateSchema,
  materialGenerateSchema,
  materialQuerySchema,
  materialUpdateSchema,
  saveDraftSchema,
  type Overview,
} from "../../shared/types";
import { segments, voice } from "../../shared/seed";
import { dailyLimit, type Env } from "../env";
import { generateIdeas, generateMaterial, LlmError } from "../llm";
import {
  activeDraft,
  countIdeas,
  countMaterials,
  createDb,
  getMaterial,
  listFolders,
  listIdeas,
  listMaterials,
  nowSeconds,
  purgeExpiredBin,
  readUsage,
  releaseGeneration,
  reserveGeneration,
  schema,
  type Db,
} from "../store";

type Vars = { db: Db };

export const api = new Hono<{ Bindings: Env; Variables: Vars }>();

api.use("*", async (c, next) => {
  c.set("db", createDb(c.env.DB));
  await next();
});

/**
 * Key used to spot an idea already present. The separator is a character a
 * title cannot contain, so "Тема 5" + 12 cannot collide with "Тема" + "5 12".
 */
function dedupeKey(title: string, createdAt: number): string {
  return `${title}\u0000${createdAt}`;
}

/** Turns a zod failure into the first human-readable message. */
function firstIssue(error: { issues: Array<{ message: string }> }): string {
  return error.issues[0]?.message ?? "Проверьте введённые данные.";
}

async function buildOverview(db: Db, env: Env): Promise<Overview> {
  const [folders, ideaTotals, materials, used, draft] = await Promise.all([
    listFolders(db),
    countIdeas(db),
    countMaterials(db),
    readUsage(db),
    activeDraft(db),
  ]);
  return {
    folders,
    totals: { ...ideaTotals, materials },
    usage: { used, limit: dailyLimit(env) },
    draft,
  };
}

api.get("/overview", async (c) => c.json(await buildOverview(c.get("db"), c.env)));

api.get("/context", (c) => c.json({ segments, voice }));

/* ---------------------------------- ideas --------------------------------- */

api.get("/ideas", async (c) => {
  const parsed = ideaQuerySchema.safeParse({
    folderId: c.req.query("folderId") ?? "all",
    sort: c.req.query("sort") ?? "new",
    search: c.req.query("search") ?? "",
    favoritesOnly: c.req.query("favoritesOnly") ?? false,
  });
  if (!parsed.success) return c.json({ error: firstIssue(parsed.error) }, 400);
  return c.json({ ideas: await listIdeas(c.get("db"), parsed.data) });
});

api.post("/ideas", async (c) => {
  const parsed = ideaCreateSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: firstIssue(parsed.error) }, 400);

  const [row] = await c
    .get("db")
    .insert(schema.ideas)
    .values({ ...parsed.data, source: "manual" })
    .returning({ id: schema.ideas.id });

  return c.json({ id: row?.id ?? null }, 201);
});

api.patch("/ideas/:id", async (c) => {
  const id = Number.parseInt(c.req.param("id"), 10);
  if (!Number.isFinite(id)) return c.json({ error: "Некорректный идентификатор." }, 400);

  const parsed = ideaUpdateSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: firstIssue(parsed.error) }, 400);

  await c
    .get("db")
    .update(schema.ideas)
    .set({ ...parsed.data, updatedAt: nowSeconds() })
    .where(eq(schema.ideas.id, id));

  return c.json({ ok: true });
});

/** Delete moves to the bin; the row survives for 30 days. */
api.delete("/ideas/:id", async (c) => {
  const id = Number.parseInt(c.req.param("id"), 10);
  if (!Number.isFinite(id)) return c.json({ error: "Некорректный идентификатор." }, 400);

  const db = c.get("db");
  await db.update(schema.ideas).set({ deletedAt: nowSeconds() }).where(eq(schema.ideas.id, id));
  await purgeExpiredBin(db);
  return c.json({ ok: true });
});

api.post("/ideas/:id/restore", async (c) => {
  const id = Number.parseInt(c.req.param("id"), 10);
  if (!Number.isFinite(id)) return c.json({ error: "Некорректный идентификатор." }, 400);
  await c.get("db").update(schema.ideas).set({ deletedAt: null }).where(eq(schema.ideas.id, id));
  return c.json({ ok: true });
});

/* --------------------------------- folders -------------------------------- */

api.post("/folders", async (c) => {
  const parsed = folderCreateSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: firstIssue(parsed.error) }, 400);

  const db = c.get("db");
  const [next] = await db
    .select({ value: sql<number>`coalesce(max(${schema.folders.sortOrder}) + 1, 0)` })
    .from(schema.folders);

  try {
    const [row] = await db
      .insert(schema.folders)
      .values({ ...parsed.data, sortOrder: Number(next?.value ?? 0) })
      .returning({ id: schema.folders.id });
    return c.json({ id: row?.id ?? null }, 201);
  } catch {
    return c.json({ error: "Папка с таким названием уже есть." }, 409);
  }
});

api.patch("/folders/:id", async (c) => {
  const id = Number.parseInt(c.req.param("id"), 10);
  if (!Number.isFinite(id)) return c.json({ error: "Некорректный идентификатор." }, 400);

  const parsed = folderUpdateSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: firstIssue(parsed.error) }, 400);

  try {
    await c.get("db").update(schema.folders).set(parsed.data).where(eq(schema.folders.id, id));
    return c.json({ ok: true });
  } catch {
    return c.json({ error: "Папка с таким названием уже есть." }, 409);
  }
});

/** Deleting a folder never deletes ideas — they fall back to "Без папки". */
api.delete("/folders/:id", async (c) => {
  const id = Number.parseInt(c.req.param("id"), 10);
  if (!Number.isFinite(id)) return c.json({ error: "Некорректный идентификатор." }, 400);

  const db = c.get("db");
  await db.update(schema.ideas).set({ folderId: null }).where(eq(schema.ideas.folderId, id));
  await db.delete(schema.folders).where(eq(schema.folders.id, id));
  return c.json({ ok: true });
});

/* -------------------------------- generator ------------------------------- */

api.post("/generate", async (c) => {
  const parsed = generateRequestSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: firstIssue(parsed.error) }, 400);

  const db = c.get("db");
  const limit = dailyLimit(c.env);

  // Reserved up front so two tabs cannot both slip past the cap.
  if (!(await reserveGeneration(db, limit))) {
    return c.json({ error: `Дневной лимит генераций исчерпан (${limit}). Продолжим завтра.` }, 429);
  }

  let ideas;
  try {
    ideas = await generateIdeas(c.env, parsed.data);
  } catch (error) {
    await releaseGeneration(db);
    const message =
      error instanceof LlmError
        ? error.message
        : "Не удалось связаться с генератором. Попробуйте ещё раз.";
    return c.json({ error: message }, 502);
  }

  // Persisted immediately: a backgrounded tab must not cost a generation.
  const [row] = await db
    .insert(schema.drafts)
    .values({
      segmentCode: parsed.data.segmentCode,
      channel: parsed.data.channel,
      focus: parsed.data.focus || null,
      folderId: parsed.data.folderId,
      payload: JSON.stringify(ideas),
    })
    .returning({ id: schema.drafts.id });

  return c.json({ draftId: row?.id ?? null, ideas });
});

api.post("/drafts/save", async (c) => {
  const parsed = saveDraftSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: firstIssue(parsed.error) }, 400);

  const db = c.get("db");

  /*
   * Claiming the draft and marking it consumed is one statement, so a retried
   * request or a double tap cannot read the same payload twice and insert the
   * ideas again.
   */
  const [draft] = await db
    .update(schema.drafts)
    .set({ consumedAt: nowSeconds() })
    .where(and(eq(schema.drafts.id, parsed.data.draftId), isNull(schema.drafts.consumedAt)))
    .returning();

  if (!draft) {
    const [existing] = await db
      .select({ id: schema.drafts.id })
      .from(schema.drafts)
      .where(eq(schema.drafts.id, parsed.data.draftId))
      .limit(1);
    return existing
      ? c.json({ error: "Эти идеи уже сохранены." }, 409)
      : c.json({ error: "Черновик не найден — сгенерируйте идеи заново." }, 404);
  }

  const pool = JSON.parse(draft.payload) as Array<Record<string, string>>;
  const chosen = parsed.data.indexes
    .map((index) => pool[index])
    .filter((idea): idea is Record<string, string> => Boolean(idea));

  if (chosen.length === 0) {
    await db
      .update(schema.drafts)
      .set({ consumedAt: null })
      .where(eq(schema.drafts.id, draft.id));
    return c.json({ error: "Отметьте хотя бы одну идею." }, 400);
  }

  const folderId = parsed.data.folderId ?? draft.folderId;
  await db.insert(schema.ideas).values(
    chosen.map((idea) => ({
      folderId,
      segmentCode: draft.segmentCode,
      channel: (idea.channel === "telegram" ? "telegram" : "reels") as "telegram" | "reels",
      priority: "viral" as const,
      title: idea.title ?? "",
      hook: idea.hook ?? null,
      format: idea.format ?? null,
      angle: idea.angle ?? null,
      visual: idea.visual ?? null,
      cta: idea.cta ?? null,
      objective: idea.objective ?? null,
      source: "generated" as const,
    })),
  );

  return c.json({ saved: chosen.length, folderId });
});

api.delete("/drafts/:id", async (c) => {
  const id = Number.parseInt(c.req.param("id"), 10);
  if (!Number.isFinite(id)) return c.json({ error: "Некорректный идентификатор." }, 400);
  await c
    .get("db")
    .update(schema.drafts)
    .set({ consumedAt: nowSeconds() })
    .where(eq(schema.drafts.id, id));
  return c.json({ ok: true });
});

/* ------------------------------ export / import --------------------------- */

/* -------------------------------- materials ------------------------------- */

api.get("/materials", async (c) => {
  const parsed = materialQuerySchema.safeParse({
    kind: c.req.query("kind") ?? "all",
    status: c.req.query("status") ?? "all",
    search: c.req.query("search") ?? "",
    favoritesOnly: c.req.query("favoritesOnly") ?? false,
  });
  if (!parsed.success) return c.json({ error: firstIssue(parsed.error) }, 400);
  return c.json(await listMaterials(c.get("db"), parsed.data));
});

api.get("/materials/:id", async (c) => {
  const material = await getMaterial(c.get("db"), Number(c.req.param("id")));
  if (!material) return c.json({ error: "Материал не найден." }, 404);
  return c.json(material);
});

api.post("/materials", async (c) => {
  const parsed = materialCreateSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: firstIssue(parsed.error) }, 400);

  const [row] = await c
    .get("db")
    .insert(schema.materials)
    .values({
      ...parsed.data,
      scenes: parsed.data.scenes ? JSON.stringify(parsed.data.scenes) : null,
    })
    .returning({ id: schema.materials.id });

  return c.json({ id: row?.id ?? null }, 201);
});

api.patch("/materials/:id", async (c) => {
  const parsed = materialUpdateSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: firstIssue(parsed.error) }, 400);

  const { scenes, ...rest } = parsed.data;
  const patch: Record<string, unknown> = { ...rest, updatedAt: nowSeconds() };
  // `scenes` is absent when untouched and null when deliberately cleared, and
  // the two must not collapse into one another on the way to the column.
  if (scenes !== undefined) patch.scenes = scenes === null ? null : JSON.stringify(scenes);

  const rows = await c
    .get("db")
    .update(schema.materials)
    .set(patch)
    .where(and(eq(schema.materials.id, Number(c.req.param("id"))), isNull(schema.materials.deletedAt)))
    .returning({ id: schema.materials.id });

  if (rows.length === 0) return c.json({ error: "Материал не найден." }, 404);
  return c.json({ ok: true });
});

api.delete("/materials/:id", async (c) => {
  const rows = await c
    .get("db")
    .update(schema.materials)
    .set({ deletedAt: nowSeconds() })
    .where(and(eq(schema.materials.id, Number(c.req.param("id"))), isNull(schema.materials.deletedAt)))
    .returning({ id: schema.materials.id });

  if (rows.length === 0) return c.json({ error: "Материал не найден." }, 404);
  return c.json({ ok: true });
});

api.post("/materials/generate", async (c) => {
  const parsed = materialGenerateSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: firstIssue(parsed.error) }, 400);

  const db = c.get("db");
  const input = parsed.data;

  // An idea supplies both the topic and the angle the script has to keep.
  let source: Parameters<typeof generateMaterial>[1]["source"] = null;
  let topic = input.topic;
  let segmentCode: string = input.segmentCode;

  if (input.ideaId !== null) {
    const [idea] = await db
      .select()
      .from(schema.ideas)
      .where(and(eq(schema.ideas.id, input.ideaId), isNull(schema.ideas.deletedAt)))
      .limit(1);
    if (!idea) return c.json({ error: "Идея не найдена." }, 404);

    topic = topic || idea.title;
    segmentCode = idea.segmentCode;
    source = { hook: idea.hook, format: idea.format, angle: idea.angle, visual: idea.visual, cta: idea.cta };
  }

  if (!topic.trim()) return c.json({ error: "Укажите тему материала." }, 400);

  const limit = dailyLimit(c.env);
  if (!(await reserveGeneration(db, limit))) {
    return c.json({ error: `Дневной лимит генераций исчерпан (${limit}). Продолжим завтра.` }, 429);
  }

  let material;
  try {
    material = await generateMaterial(c.env, {
      kind: input.kind,
      topic,
      segmentCode,
      length: input.length,
      goal: input.goal,
      source,
    });
  } catch (error) {
    await releaseGeneration(db);
    const message =
      error instanceof LlmError
        ? error.message
        : "Не удалось связаться с генератором. Попробуйте ещё раз.";
    return c.json({ error: message }, 502);
  }

  /*
   * Stored before the response goes out. A material costs a generation, and
   * unlike an idea batch there is nothing to re-pick from — losing it to a
   * closed tab would mean paying for it twice.
   */
  const [row] = await db
    .insert(schema.materials)
    .values({
      ideaId: input.ideaId,
      kind: input.kind,
      segmentCode,
      title: material.title,
      hook: material.hook,
      body: material.body || null,
      scenes: material.scenes.length > 0 ? JSON.stringify(material.scenes) : null,
      visual: material.visual || null,
      cta: material.cta,
    })
    .returning({ id: schema.materials.id });

  const saved = row ? await getMaterial(db, row.id) : null;
  if (!saved) return c.json({ error: "Материал не удалось сохранить." }, 500);
  return c.json(saved, 201);
});

api.get("/export", async (c) => {
  const db = c.get("db");
  const [folderRows, ideaRows] = await Promise.all([
    db.select().from(schema.folders),
    db.select().from(schema.ideas).where(isNull(schema.ideas.deletedAt)),
  ]);

  const folderName = new Map(folderRows.map((folder) => [folder.id, folder.name]));

  return c.json({
    version: 1,
    exportedAt: new Date().toISOString(),
    folders: folderRows.map((folder) => ({
      name: folder.name,
      color: folder.color,
      sortOrder: folder.sortOrder,
    })),
    ideas: ideaRows.map((idea) => ({
      folderName: idea.folderId === null ? null : (folderName.get(idea.folderId) ?? null),
      segmentCode: idea.segmentCode,
      channel: idea.channel,
      priority: idea.priority,
      title: idea.title,
      hook: idea.hook,
      format: idea.format,
      angle: idea.angle,
      visual: idea.visual,
      cta: idea.cta,
      objective: idea.objective,
      source: idea.source,
      isFavorite: idea.isFavorite,
      createdAt: idea.createdAt,
    })),
  });
});

/**
 * Import is additive and idempotent: an idea already present with the same
 * title and creation timestamp is skipped, so re-importing a file is safe.
 */
api.post("/import", async (c) => {
  const parsed = importSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "Файл не похож на выгрузку студии." }, 400);

  const db = c.get("db");
  const existingFolders = await db.select().from(schema.folders);
  const byName = new Map(existingFolders.map((folder) => [folder.name, folder.id]));

  let addedFolders = 0;
  for (const folder of parsed.data.folders) {
    if (byName.has(folder.name)) continue;
    const [row] = await db
      .insert(schema.folders)
      .values({ name: folder.name, color: folder.color, sortOrder: folder.sortOrder })
      .returning({ id: schema.folders.id });
    if (row) {
      byName.set(folder.name, row.id);
      addedFolders += 1;
    }
  }

  const incomingTitles = [...new Set(parsed.data.ideas.map((idea) => idea.title))];
  const duplicates = new Set<string>();
  for (let i = 0; i < incomingTitles.length; i += 200) {
    const chunk = incomingTitles.slice(i, i + 200);
    if (chunk.length === 0) continue;
    const rows = await db
      .select({ title: schema.ideas.title, createdAt: schema.ideas.createdAt })
      .from(schema.ideas)
      .where(inArray(schema.ideas.title, chunk));
    for (const row of rows) duplicates.add(dedupeKey(row.title, row.createdAt));
  }

  const fresh = parsed.data.ideas.filter(
    (idea) => !duplicates.has(dedupeKey(idea.title, idea.createdAt)),
  );

  for (let i = 0; i < fresh.length; i += 100) {
    const chunk = fresh.slice(i, i + 100);
    await db.insert(schema.ideas).values(
      chunk.map((idea) => ({
        folderId: idea.folderName ? (byName.get(idea.folderName) ?? null) : null,
        segmentCode: idea.segmentCode ?? "S3",
        channel: idea.channel ?? "reels",
        priority: idea.priority ?? "medium",
        title: idea.title,
        hook: idea.hook ?? null,
        format: idea.format ?? null,
        angle: idea.angle ?? null,
        visual: idea.visual ?? null,
        cta: idea.cta ?? null,
        objective: idea.objective ?? null,
        source: idea.source,
        isFavorite: idea.isFavorite,
        createdAt: idea.createdAt,
      })),
    );
  }

  return c.json({
    addedFolders,
    addedIdeas: fresh.length,
    skipped: parsed.data.ideas.length - fresh.length,
  });
});

/* ----------------------------------- bin ---------------------------------- */

api.get("/bin", async (c) => {
  const rows = await c
    .get("db")
    .select()
    .from(schema.ideas)
    .where(sql`${schema.ideas.deletedAt} is not null`)
    .orderBy(sql`${schema.ideas.deletedAt} desc`)
    .limit(200);

  return c.json({
    ideas: rows.map((row) => ({ id: row.id, title: row.title, deletedAt: row.deletedAt })),
  });
});
