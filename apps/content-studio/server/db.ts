import { and, asc, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  audienceSegments,
  contentFolders,
  contentItems,
  contentMetrics,
  contentTemplates,
  InsertUser,
  studioSettings,
  users,
  voiceProfiles,
} from "../drizzle/schema";
import { segmentSeed, templateSeed, voiceSeed } from "../shared/contentStudio";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна. Повторите попытку позже.");
  return db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function bootstrapStudio(ownerId: number) {
  const db = await requireDb();
  const [voice, segments, templates, settings] = await Promise.all([
    db.select().from(voiceProfiles).where(eq(voiceProfiles.ownerId, ownerId)).limit(1),
    db.select({ id: audienceSegments.id }).from(audienceSegments).where(eq(audienceSegments.ownerId, ownerId)).limit(1),
    db.select({ id: contentTemplates.id }).from(contentTemplates).where(eq(contentTemplates.ownerId, ownerId)).limit(1),
    db.select({ id: studioSettings.id }).from(studioSettings).where(eq(studioSettings.ownerId, ownerId)).limit(1),
  ]);
  if (!voice[0]) await db.insert(voiceProfiles).values({ ownerId, ...voiceSeed });
  if (!segments[0]) await db.insert(audienceSegments).values(segmentSeed.map(segment => ({ ownerId, ...segment })));
  if (!templates[0]) await db.insert(contentTemplates).values(templateSeed.map(template => ({ ownerId, ...template })));
  if (!settings[0]) await db.insert(studioSettings).values({ ownerId, activeSegmentId: "S3", strategyGoal: "" });
}

export async function getStudioData(ownerId: number) {
  const db = await requireDb();
  const [folders, items, templates, voice, segments, metrics, settings] = await Promise.all([
    db.select().from(contentFolders).where(eq(contentFolders.ownerId, ownerId)).orderBy(asc(contentFolders.sortOrder), asc(contentFolders.name)),
    db.select().from(contentItems).where(eq(contentItems.ownerId, ownerId)).orderBy(desc(contentItems.updatedAt)),
    db.select().from(contentTemplates).where(eq(contentTemplates.ownerId, ownerId)).orderBy(asc(contentTemplates.kind), asc(contentTemplates.name)),
    db.select().from(voiceProfiles).where(eq(voiceProfiles.ownerId, ownerId)).limit(1),
    db.select().from(audienceSegments).where(eq(audienceSegments.ownerId, ownerId)).orderBy(asc(audienceSegments.sortOrder)),
    db.select().from(contentMetrics).where(eq(contentMetrics.ownerId, ownerId)).orderBy(desc(contentMetrics.capturedAt)),
    db.select().from(studioSettings).where(eq(studioSettings.ownerId, ownerId)).limit(1),
  ]);
  return { folders, items, templates, voice: voice[0] ?? null, segments, metrics, settings: settings[0] ?? null };
}

export async function createFolder(ownerId: number, input: { name: string; color: string; sortOrder?: number }) {
  const db = await requireDb();
  const result = await db.insert(contentFolders).values({ ownerId, ...input });
  const folder = await db.select().from(contentFolders).where(and(eq(contentFolders.ownerId, ownerId), eq(contentFolders.id, Number(result[0].insertId)))).limit(1);
  return folder[0];
}

export async function updateFolder(ownerId: number, id: number, input: Partial<{ name: string; color: string; sortOrder: number }>) {
  const db = await requireDb();
  await db.update(contentFolders).set(input).where(and(eq(contentFolders.ownerId, ownerId), eq(contentFolders.id, id)));
}

export async function deleteFolder(ownerId: number, id: number) {
  const db = await requireDb();
  await db.update(contentItems).set({ folderId: null }).where(and(eq(contentItems.ownerId, ownerId), eq(contentItems.folderId, id)));
  await db.delete(contentFolders).where(and(eq(contentFolders.ownerId, ownerId), eq(contentFolders.id, id)));
}

type ContentItemValues = Omit<typeof contentItems.$inferInsert, "id" | "ownerId" | "createdAt" | "updatedAt">;

export async function createContentItem(ownerId: number, input: ContentItemValues) {
  const db = await requireDb();
  const result = await db.insert(contentItems).values({ ownerId, ...input });
  const item = await db.select().from(contentItems).where(and(eq(contentItems.ownerId, ownerId), eq(contentItems.id, Number(result[0].insertId)))).limit(1);
  return item[0];
}

export async function updateContentItem(ownerId: number, id: number, input: Partial<ContentItemValues>) {
  const db = await requireDb();
  await db.update(contentItems).set(input).where(and(eq(contentItems.ownerId, ownerId), eq(contentItems.id, id)));
}

export async function deleteContentItem(ownerId: number, id: number) {
  const db = await requireDb();
  await db.delete(contentMetrics).where(and(eq(contentMetrics.ownerId, ownerId), eq(contentMetrics.itemId, id)));
  await db.delete(contentItems).where(and(eq(contentItems.ownerId, ownerId), eq(contentItems.id, id)));
}

export async function createTemplate(ownerId: number, input: Omit<typeof contentTemplates.$inferInsert, "id" | "ownerId" | "createdAt" | "updatedAt">) {
  const db = await requireDb();
  const result = await db.insert(contentTemplates).values({ ownerId, ...input });
  const template = await db.select().from(contentTemplates).where(and(eq(contentTemplates.ownerId, ownerId), eq(contentTemplates.id, Number(result[0].insertId)))).limit(1);
  return template[0];
}

export async function updateTemplate(ownerId: number, id: number, input: Partial<Omit<typeof contentTemplates.$inferInsert, "id" | "ownerId">>) {
  const db = await requireDb();
  await db.update(contentTemplates).set(input).where(and(eq(contentTemplates.ownerId, ownerId), eq(contentTemplates.id, id)));
}

export async function deleteTemplate(ownerId: number, id: number) {
  const db = await requireDb();
  await db.delete(contentTemplates).where(and(eq(contentTemplates.ownerId, ownerId), eq(contentTemplates.id, id)));
}

export async function updateVoiceProfile(ownerId: number, input: Partial<Omit<typeof voiceProfiles.$inferInsert, "id" | "ownerId">>) {
  const db = await requireDb();
  await db.update(voiceProfiles).set(input).where(eq(voiceProfiles.ownerId, ownerId));
}

export async function updateSegment(ownerId: number, id: number, input: Partial<Omit<typeof audienceSegments.$inferInsert, "id" | "ownerId" | "code">>) {
  const db = await requireDb();
  await db.update(audienceSegments).set(input).where(and(eq(audienceSegments.ownerId, ownerId), eq(audienceSegments.id, id)));
}

export async function updateSettings(ownerId: number, input: Partial<Omit<typeof studioSettings.$inferInsert, "id" | "ownerId">>) {
  const db = await requireDb();
  await db.update(studioSettings).set(input).where(eq(studioSettings.ownerId, ownerId));
}

export async function createMetric(ownerId: number, input: Omit<typeof contentMetrics.$inferInsert, "id" | "ownerId" | "createdAt">) {
  const db = await requireDb();
  const result = await db.insert(contentMetrics).values({ ownerId, ...input });
  const metric = await db.select().from(contentMetrics).where(and(eq(contentMetrics.ownerId, ownerId), eq(contentMetrics.id, Number(result[0].insertId)))).limit(1);
  return metric[0];
}
