import { boolean, int, mysqlEnum, mysqlTable, text, timestamp, unique, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const contentFolders = mysqlTable("content_folders", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  name: varchar("name", { length: 80 }).notNull(),
  color: varchar("color", { length: 16 }).notNull().default("#D84444"),
  sortOrder: int("sortOrder").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const contentItems = mysqlTable("content_items", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  folderId: int("folderId"),
  kind: mysqlEnum("kind", ["idea", "post", "reel"]).notNull().default("idea"),
  channel: mysqlEnum("channel", ["telegram", "reels", "both"]).notNull().default("telegram"),
  status: mysqlEnum("status", ["draft", "planned", "ready", "published"]).notNull().default("draft"),
  priority: mysqlEnum("priority", ["low", "medium", "high", "viral"]).notNull().default("medium"),
  segmentId: varchar("segmentId", { length: 8 }).notNull().default("S3"),
  title: varchar("title", { length: 280 }).notNull(),
  hook: text("hook"),
  body: text("body"),
  format: varchar("format", { length: 100 }),
  visual: text("visual"),
  cta: text("cta"),
  notes: text("notes"),
  scheduledFor: timestamp("scheduledFor"),
  isFavorite: boolean("isFavorite").notNull().default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const contentTemplates = mysqlTable("content_templates", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  kind: mysqlEnum("kind", ["post", "reel"]).notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  description: text("description"),
  structure: text("structure").notNull(),
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const voiceProfiles = mysqlTable("voice_profiles", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  tone: text("tone").notNull(),
  address: varchar("address", { length: 40 }).notNull(),
  energy: text("energy").notNull(),
  structure: text("structure").notNull(),
  proof: text("proof").notNull(),
  cta: text("cta").notNull(),
  avoid: text("avoid").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [unique("voice_profiles_owner_unique").on(table.ownerId)]);

export const audienceSegments = mysqlTable("audience_segments", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  code: varchar("code", { length: 8 }).notNull(),
  sortOrder: int("sortOrder").notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  title: varchar("title", { length: 180 }).notNull(),
  subtitle: text("subtitle").notNull(),
  goal: text("goal").notNull(),
  pain: text("pain").notNull(),
  fear: text("fear").notNull(),
  trigger: text("trigger").notNull(),
  offer: text("offer").notNull(),
  color: varchar("color", { length: 16 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [unique("audience_segments_owner_code_unique").on(table.ownerId, table.code)]);

export const contentMetrics = mysqlTable("content_metrics", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  itemId: int("itemId").notNull(),
  capturedAt: timestamp("capturedAt").defaultNow().notNull(),
  views: int("views").notNull().default(0),
  reactions: int("reactions").notNull().default(0),
  comments: int("comments").notNull().default(0),
  saves: int("saves").notNull().default(0),
  shares: int("shares").notNull().default(0),
  linkClicks: int("linkClicks").notNull().default(0),
  leads: int("leads").notNull().default(0),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const studioSettings = mysqlTable("studio_settings", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  activeSegmentId: varchar("activeSegmentId", { length: 8 }).notNull().default("S3"),
  strategyGoal: text("strategyGoal"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [unique("studio_settings_owner_unique").on(table.ownerId)]);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type ContentFolder = typeof contentFolders.$inferSelect;
export type ContentItem = typeof contentItems.$inferSelect;
export type ContentTemplate = typeof contentTemplates.$inferSelect;
export type VoiceProfile = typeof voiceProfiles.$inferSelect;
export type AudienceSegment = typeof audienceSegments.$inferSelect;
export type ContentMetric = typeof contentMetrics.$inferSelect;
