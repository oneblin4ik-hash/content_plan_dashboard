import { z } from "zod";

export const channelSchema = z.enum(["telegram", "reels"]);
export const generateChannelSchema = z.enum(["telegram", "reels", "both"]);
export const prioritySchema = z.enum(["low", "medium", "high", "viral"]);
export const segmentSchema = z.enum(["S1", "S2", "S3", "S4"]);
export const sortSchema = z.enum(["new", "old", "priority", "alpha"]);
export const materialKindSchema = z.enum(["reel", "post"]);
export const materialStatusSchema = z.enum(["draft", "ready", "published"]);
export const materialLengthSchema = z.enum(["short", "medium", "long"]);

export type Channel = z.infer<typeof channelSchema>;
export type Priority = z.infer<typeof prioritySchema>;
export type SegmentCode = z.infer<typeof segmentSchema>;
export type SortKey = z.infer<typeof sortSchema>;
export type MaterialKind = z.infer<typeof materialKindSchema>;
export type MaterialStatus = z.infer<typeof materialStatusSchema>;
export type MaterialLength = z.infer<typeof materialLengthSchema>;

const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Цвет должен быть в формате #RRGGBB");

export const folderCreateSchema = z.object({
  name: z.string().trim().min(1, "Введите название").max(60),
  color: hexColor.default("#D8232A"),
});

export const folderUpdateSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  color: hexColor.optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const ideaCreateSchema = z.object({
  folderId: z.number().int().positive().nullable().default(null),
  segmentCode: segmentSchema.default("S3"),
  channel: channelSchema.default("reels"),
  priority: prioritySchema.default("medium"),
  title: z.string().trim().min(2, "Тема слишком короткая").max(220),
  hook: z.string().max(420).nullable().default(null),
  format: z.string().max(180).nullable().default(null),
  angle: z.string().max(700).nullable().default(null),
  visual: z.string().max(520).nullable().default(null),
  cta: z.string().max(320).nullable().default(null),
  objective: z.string().max(160).nullable().default(null),
});

/*
 * Spelled out rather than derived from the create schema. `.partial()` marks
 * keys optional but leaves `.default()` in place, so an omitted field still
 * parses to its default and the PATCH writes that over stored data — toggling
 * a favourite would wipe the rest of the idea. Here an absent key stays
 * absent, while an explicit null still clears the column.
 */
export const ideaUpdateSchema = z.object({
  folderId: z.number().int().positive().nullable().optional(),
  segmentCode: segmentSchema.optional(),
  channel: channelSchema.optional(),
  priority: prioritySchema.optional(),
  title: z.string().trim().min(2, "Тема слишком короткая").max(220).optional(),
  hook: z.string().max(420).nullable().optional(),
  format: z.string().max(180).nullable().optional(),
  angle: z.string().max(700).nullable().optional(),
  visual: z.string().max(520).nullable().optional(),
  cta: z.string().max(320).nullable().optional(),
  objective: z.string().max(160).nullable().optional(),
  isFavorite: z.boolean().optional(),
});

export const ideaQuerySchema = z.object({
  folderId: z.union([z.coerce.number().int().positive(), z.literal("all"), z.literal("none")]).default("all"),
  sort: sortSchema.default("new"),
  search: z.string().trim().max(120).default(""),
  favoritesOnly: z.coerce.boolean().default(false),
});

/** One idea as returned by the model. Bounds match what the UI can render. */
export const generatedIdeaSchema = z.object({
  title: z.string().trim().min(6).max(220),
  hook: z.string().trim().min(8).max(420),
  format: z.string().trim().min(3).max(180),
  angle: z.string().trim().min(8).max(700),
  visual: z.string().trim().min(6).max(520),
  cta: z.string().trim().min(3).max(320),
  channel: channelSchema,
  objective: z.string().trim().min(3).max(160),
});

export type GeneratedIdea = z.infer<typeof generatedIdeaSchema>;

export const generateRequestSchema = z.object({
  segmentCode: segmentSchema,
  channel: generateChannelSchema,
  count: z.union([z.literal(3), z.literal(6), z.literal(8)]).default(6),
  focus: z.string().trim().max(240).default(""),
  folderId: z.number().int().positive().nullable().default(null),
});

export const saveDraftSchema = z.object({
  draftId: z.number().int().positive(),
  indexes: z.array(z.number().int().min(0)).min(1, "Отметьте хотя бы одну идею"),
  folderId: z.number().int().positive().nullable().default(null),
});

export const loginSchema = z.object({
  passphrase: z.string().min(1, "Введите код-фразу").max(200),
});

/**
 * One shot of a Reels script. The trainer films from this directly, so every
 * field answers a question he would otherwise have to improvise on camera.
 */
export const materialSceneSchema = z.object({
  time: z.string().trim().min(1).max(40),
  shot: z.string().trim().min(3).max(400),
  speech: z.string().trim().min(3).max(700),
  caption: z.string().trim().max(200).default(""),
  edit: z.string().trim().max(300).default(""),
});

export type MaterialScene = z.infer<typeof materialSceneSchema>;

export const importSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string(),
  folders: z.array(
    z.object({
      name: z.string().trim().min(1).max(60),
      color: hexColor,
      sortOrder: z.number().int().min(0).default(0),
    }),
  ),
  ideas: z.array(
    ideaCreateSchema.partial({ folderId: true }).extend({
      folderName: z.string().nullable().default(null),
      isFavorite: z.boolean().default(false),
      createdAt: z.number().int().nonnegative(),
      source: z.enum(["manual", "generated"]).default("manual"),
    }),
  ),
  /*
   * Defaulted to empty so a file written before materials existed still
   * imports. The link back to a source idea is deliberately not carried:
   * идентификаторы в новой базе другие, а материал самодостаточен.
   */
  materials: z
    .array(
      z.object({
        kind: materialKindSchema,
        segmentCode: segmentSchema.default("S3"),
        status: materialStatusSchema.default("draft"),
        title: z.string().trim().min(1).max(220),
        hook: z.string().max(420).nullable().default(null),
        body: z.string().max(6000).nullable().default(null),
        scenes: z.array(materialSceneSchema).max(12).nullable().default(null),
        visual: z.string().max(520).nullable().default(null),
        cta: z.string().max(320).nullable().default(null),
        isFavorite: z.boolean().default(false),
        createdAt: z.number().int().nonnegative(),
      }),
    )
    .default([]),
});

export type ImportPayload = z.infer<typeof importSchema>;

export type Folder = {
  id: number;
  name: string;
  color: string;
  sortOrder: number;
  count: number;
};

export type Idea = {
  id: number;
  folderId: number | null;
  segmentCode: SegmentCode;
  channel: Channel;
  priority: Priority;
  title: string;
  hook: string | null;
  format: string | null;
  angle: string | null;
  visual: string | null;
  cta: string | null;
  objective: string | null;
  source: "manual" | "generated";
  isFavorite: boolean;
  createdAt: number;
};

export type Draft = {
  id: number;
  segmentCode: SegmentCode;
  channel: z.infer<typeof generateChannelSchema>;
  focus: string | null;
  folderId: number | null;
  ideas: GeneratedIdea[];
  createdAt: number;
};

/** What the model returns for one material, before it is stored. */
export const generatedMaterialSchema = z.object({
  title: z.string().trim().min(4).max(220),
  hook: z.string().trim().min(8).max(420),
  body: z.string().trim().max(6000).default(""),
  scenes: z.array(materialSceneSchema).max(12).default([]),
  visual: z.string().trim().max(520).default(""),
  cta: z.string().trim().min(3).max(320),
});

export type GeneratedMaterial = z.infer<typeof generatedMaterialSchema>;

export const materialGenerateSchema = z.object({
  kind: materialKindSchema,
  /** Source idea; when absent the topic below stands on its own. */
  ideaId: z.number().int().positive().nullable().default(null),
  topic: z.string().trim().max(220).default(""),
  segmentCode: segmentSchema.default("S3"),
  length: materialLengthSchema.default("medium"),
  goal: z.string().trim().max(160).default(""),
});

export const materialCreateSchema = z.object({
  kind: materialKindSchema,
  ideaId: z.number().int().positive().nullable().default(null),
  segmentCode: segmentSchema.default("S3"),
  status: materialStatusSchema.default("draft"),
  title: z.string().trim().min(2, "Название слишком короткое").max(220),
  hook: z.string().max(420).nullable().default(null),
  body: z.string().max(6000).nullable().default(null),
  scenes: z.array(materialSceneSchema).max(12).nullable().default(null),
  visual: z.string().max(520).nullable().default(null),
  cta: z.string().max(320).nullable().default(null),
});

/** Same reasoning as ideaUpdateSchema: no defaults, so a patch only writes what it names. */
export const materialUpdateSchema = z.object({
  ideaId: z.number().int().positive().nullable().optional(),
  segmentCode: segmentSchema.optional(),
  status: materialStatusSchema.optional(),
  title: z.string().trim().min(2, "Название слишком короткое").max(220).optional(),
  hook: z.string().max(420).nullable().optional(),
  body: z.string().max(6000).nullable().optional(),
  scenes: z.array(materialSceneSchema).max(12).nullable().optional(),
  visual: z.string().max(520).nullable().optional(),
  cta: z.string().max(320).nullable().optional(),
  isFavorite: z.boolean().optional(),
});

export const materialQuerySchema = z.object({
  kind: z.union([materialKindSchema, z.literal("all")]).default("all"),
  status: z.union([materialStatusSchema, z.literal("all")]).default("all"),
  search: z.string().trim().max(120).default(""),
  favoritesOnly: z.coerce.boolean().default(false),
});

export type Material = {
  id: number;
  ideaId: number | null;
  kind: MaterialKind;
  segmentCode: SegmentCode;
  status: MaterialStatus;
  title: string;
  hook: string | null;
  body: string | null;
  scenes: MaterialScene[] | null;
  visual: string | null;
  cta: string | null;
  isFavorite: boolean;
  createdAt: number;
  updatedAt: number;
};

export type Overview = {
  folders: Folder[];
  totals: { all: number; unfiled: number; favorites: number; bin: number; materials: number };
  usage: { used: number; limit: number };
  draft: Draft | null;
};

export type ApiError = { error: string };
