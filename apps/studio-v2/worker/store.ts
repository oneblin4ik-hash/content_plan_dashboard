import { and, asc, desc, eq, isNull, like, or, sql } from "drizzle-orm";
import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import { defaultFolders } from "../shared/seed";
import type {
  Draft,
  Folder,
  GeneratedIdea,
  Idea,
  SegmentCode,
  SortKey,
} from "../shared/types";
import { generatedIdeaSchema } from "../shared/types";

export type Db = DrizzleD1Database<typeof schema>;

export function createDb(binding: D1Database): Db {
  return drizzle(binding, { schema });
}

/** Ideas older than this in the bin are gone for good. */
export const BIN_RETENTION_DAYS = 30;

export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function ensureSeeded(db: Db): Promise<void> {
  const existing = await db.select({ id: schema.folders.id }).from(schema.folders).limit(1);
  if (existing.length > 0) return;
  await db.insert(schema.folders).values(
    defaultFolders.map((folder) => ({
      name: folder.name,
      color: folder.color,
      sortOrder: folder.sortOrder,
    })),
  );
}

export async function listFolders(db: Db): Promise<Folder[]> {
  // A join rather than a correlated subquery: drizzle emits unqualified column
  // names inside `sql` subqueries, where "id" would bind to the inner table.
  const rows = await db
    .select({
      id: schema.folders.id,
      name: schema.folders.name,
      color: schema.folders.color,
      sortOrder: schema.folders.sortOrder,
      count: sql<number>`count(${schema.ideas.id})`,
    })
    .from(schema.folders)
    .leftJoin(
      schema.ideas,
      and(eq(schema.ideas.folderId, schema.folders.id), isNull(schema.ideas.deletedAt)),
    )
    .groupBy(schema.folders.id)
    .orderBy(asc(schema.folders.sortOrder), asc(schema.folders.id));

  return rows.map((row) => ({ ...row, count: Number(row.count) }));
}

function toIdea(row: schema.IdeaRow): Idea {
  return {
    id: row.id,
    folderId: row.folderId,
    segmentCode: row.segmentCode as SegmentCode,
    channel: row.channel,
    priority: row.priority,
    title: row.title,
    hook: row.hook,
    format: row.format,
    angle: row.angle,
    visual: row.visual,
    cta: row.cta,
    objective: row.objective,
    source: row.source,
    isFavorite: row.isFavorite,
    createdAt: row.createdAt,
  };
}

const PRIORITY_RANK = sql`case ${schema.ideas.priority}
  when 'viral' then 0 when 'high' then 1 when 'medium' then 2 else 3 end`;

export async function listIdeas(
  db: Db,
  query: { folderId: number | "all" | "none"; sort: SortKey; search: string; favoritesOnly: boolean },
): Promise<Idea[]> {
  const filters = [isNull(schema.ideas.deletedAt)];

  if (query.folderId === "none") filters.push(isNull(schema.ideas.folderId));
  else if (query.folderId !== "all") filters.push(eq(schema.ideas.folderId, query.folderId));

  if (query.favoritesOnly) filters.push(eq(schema.ideas.isFavorite, true));

  if (query.search) {
    const needle = `%${query.search.toLowerCase()}%`;
    const match = or(
      like(sql`lower(${schema.ideas.title})`, needle),
      like(sql`lower(coalesce(${schema.ideas.hook}, ''))`, needle),
      like(sql`lower(coalesce(${schema.ideas.format}, ''))`, needle),
    );
    if (match) filters.push(match);
  }

  const order =
    query.sort === "old"
      ? [asc(schema.ideas.createdAt)]
      : query.sort === "alpha"
        ? [asc(sql`lower(${schema.ideas.title})`)]
        : query.sort === "priority"
          ? [asc(PRIORITY_RANK), desc(schema.ideas.createdAt)]
          : [desc(schema.ideas.createdAt)];

  const rows = await db
    .select()
    .from(schema.ideas)
    .where(and(...filters))
    .orderBy(...order)
    .limit(500);

  return rows.map(toIdea);
}

export async function countIdeas(db: Db) {
  const [row] = await db
    .select({
      all: sql<number>`sum(case when ${schema.ideas.deletedAt} is null then 1 else 0 end)`,
      unfiled: sql<number>`sum(case when ${schema.ideas.deletedAt} is null and ${schema.ideas.folderId} is null then 1 else 0 end)`,
      favorites: sql<number>`sum(case when ${schema.ideas.deletedAt} is null and ${schema.ideas.isFavorite} = 1 then 1 else 0 end)`,
      bin: sql<number>`sum(case when ${schema.ideas.deletedAt} is not null then 1 else 0 end)`,
    })
    .from(schema.ideas);

  return {
    all: Number(row?.all ?? 0),
    unfiled: Number(row?.unfiled ?? 0),
    favorites: Number(row?.favorites ?? 0),
    bin: Number(row?.bin ?? 0),
  };
}

export function parseDraftPayload(payload: string): GeneratedIdea[] {
  try {
    const result = generatedIdeaSchema.array().safeParse(JSON.parse(payload));
    return result.success ? result.data : [];
  } catch {
    return [];
  }
}

/** The most recent unconsumed generation, so a reload restores it. */
export async function activeDraft(db: Db): Promise<Draft | null> {
  const [row] = await db
    .select()
    .from(schema.drafts)
    .where(isNull(schema.drafts.consumedAt))
    .orderBy(desc(schema.drafts.createdAt))
    .limit(1);

  if (!row) return null;
  const ideas = parseDraftPayload(row.payload);
  if (ideas.length === 0) return null;

  return {
    id: row.id,
    segmentCode: row.segmentCode as SegmentCode,
    channel: row.channel,
    focus: row.focus,
    folderId: row.folderId,
    ideas,
    createdAt: row.createdAt,
  };
}

export async function readUsage(db: Db): Promise<number> {
  const [row] = await db
    .select({ count: schema.usage.count })
    .from(schema.usage)
    .where(eq(schema.usage.day, today()))
    .limit(1);
  return row?.count ?? 0;
}

/**
 * Claims one generation against the daily cap in a single statement, and
 * returns false when the cap is already reached.
 *
 * Reserving before the model call rather than counting after it is what stops
 * parallel tabs from overrunning the free quota: reading the count and
 * incrementing it later leaves a window where every concurrent request sees
 * the same value and all of them pass.
 */
export async function reserveGeneration(db: Db, limit: number): Promise<boolean> {
  if (limit <= 0) return false;
  const rows = await db
    .insert(schema.usage)
    .values({ day: today(), count: 1 })
    .onConflictDoUpdate({
      target: schema.usage.day,
      set: { count: sql`${schema.usage.count} + 1` },
      setWhere: sql`${schema.usage.count} < ${limit}`,
    })
    .returning({ count: schema.usage.count });
  return rows.length > 0;
}

/** Hands the reservation back when the model never produced anything. */
export async function releaseGeneration(db: Db): Promise<void> {
  await db
    .update(schema.usage)
    .set({ count: sql`max(${schema.usage.count} - 1, 0)` })
    .where(eq(schema.usage.day, today()));
}

export async function purgeExpiredBin(db: Db): Promise<void> {
  const cutoff = nowSeconds() - BIN_RETENTION_DAYS * 24 * 60 * 60;
  await db.delete(schema.ideas).where(sql`${schema.ideas.deletedAt} is not null and ${schema.ideas.deletedAt} < ${cutoff}`);
}

export { schema };
