import { z } from "zod";

export const channelSchema = z.enum(["telegram", "reels"]);
export const generateChannelSchema = z.enum(["telegram", "reels", "both"]);
export const prioritySchema = z.enum(["low", "medium", "high", "viral"]);
export const segmentSchema = z.enum(["S1", "S2", "S3", "S4"]);
export const sortSchema = z.enum(["new", "old", "priority", "alpha"]);

export type Channel = z.infer<typeof channelSchema>;
export type Priority = z.infer<typeof prioritySchema>;
export type SegmentCode = z.infer<typeof segmentSchema>;
export type SortKey = z.infer<typeof sortSchema>;

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

export const ideaUpdateSchema = ideaCreateSchema.partial().extend({
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

export type Overview = {
  folders: Folder[];
  totals: { all: number; unfiled: number; favorites: number; bin: number };
  usage: { used: number; limit: number };
  draft: Draft | null;
};

export type ApiError = { error: string };
