/* ============================================================
   Cloudflare D1 schema (SQLite) for Content Studio — Mr. Serbolin

   This file is the D1 alternative to drizzle/schema.ts (which targets
   the MySQL instance used by the Manus runtime). To switch the app to
   D1:

     1. Create a D1 database in Cloudflare:
          npx wrangler d1 create content-studio
        Take the database_id from the output.

     2. Add to wrangler.toml:
          [[d1_databases]]
          binding = "DB"
          database_name = "content-studio"
          database_id = "<id>"

     3. Generate the SQL migration:
          npx drizzle-kit generate --config=drizzle.d1.config.ts
        (you'll need a small drizzle.d1.config.ts pointing at this schema)

     4. Apply the migration:
          npx wrangler d1 migrations apply content-studio

     5. In your server bootstrap, swap the MySQL drizzle adapter for
        drizzle-orm/d1 and pass the D1 binding from env.

   The schema below mirrors the product needs (saved generations, scheduled
   posts, voice-validation history) without depending on Manus auth.
   ============================================================ */

import {
  sqliteTable,
  text,
  integer,
  index,
} from "drizzle-orm/sqlite-core";

export const generations = sqliteTable(
  "generations",
  {
    id: text("id").primaryKey(),
    userId: text("user_id"),
    title: text("title").notNull(),
    mode: text("mode").notNull(), // pack | post | reels | hooks | hashtags | carousel
    platform: text("platform"), // instagram | telegram
    payloadJson: text("payload_json").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => ({
    byUser: index("idx_generations_user").on(t.userId),
    byCreated: index("idx_generations_created").on(t.createdAt),
  })
);

export const scheduled = sqliteTable(
  "scheduled",
  {
    id: text("id").primaryKey(),
    userId: text("user_id"),
    date: text("date").notNull(), // YYYY-MM-DD
    title: text("title").notNull(),
    format: text("format"),
    topicId: integer("topic_id"),
    status: text("status").default("planned").notNull(), // planned | published | skipped
    createdAt: integer("created_at").notNull(),
  },
  (t) => ({
    byDate: index("idx_scheduled_date").on(t.date),
    byUser: index("idx_scheduled_user").on(t.userId),
  })
);

export const voiceChecks = sqliteTable("voice_checks", {
  id: text("id").primaryKey(),
  userId: text("user_id"),
  score: integer("score").notNull(),
  passed: integer("passed", { mode: "boolean" }).notNull(),
  issuesJson: text("issues_json").notNull(),
  wordCount: integer("word_count").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const analyticsEvents = sqliteTable("analytics_events", {
  id: text("id").primaryKey(),
  userId: text("user_id"),
  topicId: integer("topic_id"),
  views: integer("views").default(0).notNull(),
  engagementRate: integer("engagement_rate_x100").default(0).notNull(),
  publishedAt: integer("published_at"),
  recordedAt: integer("recorded_at").notNull(),
});

export type Generation = typeof generations.$inferSelect;
export type Scheduled = typeof scheduled.$inferSelect;
export type VoiceCheck = typeof voiceChecks.$inferSelect;
export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;
