import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { d1Query, d1Execute } from "../_core/d1";
import type { VoiceConfig } from "../_core/voice-config";
import { DEFAULT_VOICE } from "../_core/voice-config";

/* ============================================================
   Per-user voice settings: чтение и обновление JSON-блоба в
   users.voice_json. UI на /voice читает get → редактирует форму →
   зовёт update. callLLM при каждом вызове сам подтягивает voice
   из users (см. server/_core/voice.ts).
   ============================================================ */

const voiceSchema: z.ZodType<VoiceConfig> = z.object({
  personaName: z.string().trim().max(80).optional(),
  bio: z.string().trim().max(400).optional(),
  niche: z.string().trim().max(120).optional(),
  audience: z.string().trim().max(400).optional(),
  address: z.enum(["ты", "вы"]).optional(),
  emojiStyle: z.enum(["none", "light", "moderate", "rich"]).optional(),
  signaturePhrases: z.array(z.string().max(120)).max(12).optional(),
  forbiddenWords: z.array(z.string().max(60)).max(30).optional(),
  defaultCta: z.string().max(200).optional(),
});

function emptyOrUndef(s?: string): string | undefined {
  if (!s) return undefined;
  const t = s.trim();
  return t.length === 0 ? undefined : t;
}

export const voiceRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const rows = await d1Query<{ voice_json: string | null }>(
      "SELECT voice_json FROM users WHERE id = ? LIMIT 1",
      [ctx.user.id],
    );
    const raw = rows[0]?.voice_json;
    if (!raw) return DEFAULT_VOICE;
    try {
      return { ...DEFAULT_VOICE, ...(JSON.parse(raw) as VoiceConfig) };
    } catch {
      return DEFAULT_VOICE;
    }
  }),

  update: protectedProcedure
    .input(voiceSchema)
    .mutation(async ({ ctx, input }) => {
      /* Чистим пустые строки/массивы — не хотим засорять JSON. */
      const cleaned: VoiceConfig = {
        personaName: emptyOrUndef(input.personaName),
        bio: emptyOrUndef(input.bio),
        niche: emptyOrUndef(input.niche),
        audience: emptyOrUndef(input.audience),
        address: input.address,
        emojiStyle: input.emojiStyle,
        signaturePhrases: (input.signaturePhrases ?? [])
          .map((s) => s.trim())
          .filter(Boolean),
        forbiddenWords: (input.forbiddenWords ?? [])
          .map((s) => s.trim())
          .filter(Boolean),
        defaultCta: emptyOrUndef(input.defaultCta),
      };
      if (
        cleaned.signaturePhrases &&
        cleaned.signaturePhrases.length === 0
      )
        cleaned.signaturePhrases = undefined;
      if (cleaned.forbiddenWords && cleaned.forbiddenWords.length === 0)
        cleaned.forbiddenWords = undefined;
      await d1Execute("UPDATE users SET voice_json = ? WHERE id = ?", [
        JSON.stringify(cleaned),
        ctx.user.id,
      ]);
      return { ok: true };
    }),
});
