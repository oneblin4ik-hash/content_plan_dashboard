import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const now = sql`(unixepoch())`;

/**
 * Folders are the spine of the idea bank: every generated idea lands in one,
 * chosen before generation rather than patched in afterwards.
 */
export const folders = sqliteTable(
  "folders",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    color: text("color").notNull().default("#D8232A"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: integer("created_at").notNull().default(now),
  },
  (table) => [uniqueIndex("folders_name_unique").on(table.name)],
);

export const ideas = sqliteTable(
  "ideas",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    folderId: integer("folder_id").references(() => folders.id, { onDelete: "set null" }),
    segmentCode: text("segment_code").notNull().default("S3"),
    channel: text("channel", { enum: ["telegram", "reels"] }).notNull().default("reels"),
    priority: text("priority", { enum: ["low", "medium", "high", "viral"] })
      .notNull()
      .default("medium"),
    title: text("title").notNull(),
    hook: text("hook"),
    format: text("format"),
    angle: text("angle"),
    visual: text("visual"),
    cta: text("cta"),
    objective: text("objective"),
    source: text("source", { enum: ["manual", "generated"] }).notNull().default("manual"),
    isFavorite: integer("is_favorite", { mode: "boolean" }).notNull().default(false),
    /** Soft delete: the bin keeps ideas recoverable for 30 days. */
    deletedAt: integer("deleted_at"),
    createdAt: integer("created_at").notNull().default(now),
    updatedAt: integer("updated_at").notNull().default(now),
  },
  (table) => [
    index("ideas_folder_idx").on(table.folderId),
    index("ideas_created_idx").on(table.createdAt),
    index("ideas_deleted_idx").on(table.deletedAt),
  ],
);

/**
 * A generation run is persisted the moment the model answers, so results
 * survive a reload, a backgrounded tab, or iOS evicting the page.
 */
export const drafts = sqliteTable("drafts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  segmentCode: text("segment_code").notNull(),
  channel: text("channel", { enum: ["telegram", "reels", "both"] }).notNull(),
  focus: text("focus"),
  folderId: integer("folder_id").references(() => folders.id, { onDelete: "set null" }),
  /** JSON array of GeneratedIdea, validated on read. */
  payload: text("payload").notNull(),
  consumedAt: integer("consumed_at"),
  createdAt: integer("created_at").notNull().default(now),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at").notNull().default(now),
});

/** Per-day generation counter, so a shared link cannot drain the free quota. */
export const usage = sqliteTable("usage", {
  day: text("day").primaryKey(),
  count: integer("count").notNull().default(0),
});

export type FolderRow = typeof folders.$inferSelect;
export type IdeaRow = typeof ideas.$inferSelect;
export type DraftRow = typeof drafts.$inferSelect;
