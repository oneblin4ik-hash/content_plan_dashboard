import { z } from "zod";
import * as db from "../db";
import { invokeLLM } from "../_core/llm";
import { publicProcedure, router } from "../_core/trpc";

const PUBLIC_STUDIO_OWNER_ID = 2_000_000_000;

const inputSchema = z.object({
  segmentId: z.enum(["S1", "S2", "S3", "S4"]),
  channel: z.enum(["telegram", "reels", "both"]),
  focus: z.string().trim().max(240).optional(),
  count: z.number().int().min(3).max(8).default(6),
});

const outputSchema = z.object({
  ideas: z.array(z.object({
    title: z.string().min(8).max(220),
    hook: z.string().min(12).max(420),
    format: z.string().min(3).max(180),
    angle: z.string().min(12).max(700),
    visual: z.string().min(8).max(520),
    cta: z.string().min(4).max(320),
    channel: z.enum(["telegram", "reels"]),
    objective: z.string().min(3).max(160),
  })).min(3).max(8),
});

const buckets = new Map<string, { count: number; resetAt: number }>();
function enforceRateLimit(req: { ip?: string; headers?: Record<string, string | string[] | undefined> }) {
  const forwarded = req.headers?.["x-forwarded-for"];
  const key = typeof forwarded === "string" ? forwarded.split(",")[0].trim() : req.ip || "public";
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + 60_000 });
    return;
  }
  if (current.count >= 6) throw new Error("Слишком много генераций. Подождите минуту и попробуйте снова.");
  current.count += 1;
}

function parseIdeas(content: unknown) {
  const raw = typeof content === "string" ? content : "";
  const json = raw.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
  const parsed = outputSchema.parse(JSON.parse(json));
  const compact = (value: string, limit: number) => value.length <= limit ? value : `${value.slice(0, limit - 1).replace(/[\s,;:]+$/, "")}…`;
  const prohibitedSocialProof = /(клиент[а-яё]*|отзыв[а-яё]*|кейс[а-яё]*|до\s*\/?\s*после|моя\s+клиентка|мой\s+клиент)/i;
  const ideas = parsed.ideas.map(idea => ({
    ...idea,
    title: compact(idea.title, 150),
    hook: compact(idea.hook, 220),
    format: compact(idea.format, 80),
    angle: compact(idea.angle, 300),
    visual: compact(idea.visual, 260),
    cta: compact(idea.cta, 150),
    objective: compact(idea.objective, 80),
  }));
  if (ideas.some(idea => prohibitedSocialProof.test(Object.values(idea).join(" ")))) {
    throw new Error("Генератор отфильтровал вымышленный кейс или отзыв. Запустите генерацию ещё раз.");
  }
  return { ideas };
}

export const viralIdeasRouter = router({
  generate: publicProcedure.input(inputSchema).mutation(async ({ ctx, input }) => {
    enforceRateLimit(ctx.req as unknown as { ip?: string; headers?: Record<string, string | string[] | undefined> });
    await db.bootstrapStudio(PUBLIC_STUDIO_OWNER_ID);
    const workspace = await db.getStudioData(PUBLIC_STUDIO_OWNER_ID);
    const segment = workspace.segments.find(item => item.code === input.segmentId);
    if (!segment || !workspace.voice) throw new Error("Не удалось загрузить контекст аудитории для генерации.");

    const response = await invokeLLM({
      model: "gpt-5-mini",
      maxCompletionTokens: 1800,
      messages: [
        {
          role: "system",
            content: "Ты сильный русскоязычный контент-стратег для фитнес-эксперта. Создаёшь конкретные, этичные и небанальные идеи с потенциалом охвата, сохранений, пересылок или диалога. Не используй медицинские формулировки и слово «диагноз», не давай гарантий результата, недостоверных кейсов или отзывов. Никогда не выдумывай клиентов, клиенток, имена, истории успеха, отзывы, результаты, цифры прогресса или форматы «до/после». Не обещай несуществующие PDF, гайды, чек-листы, меню, тренировки или рассылки. Вместо этого предлагай личную демонстрацию, бытовую сцену, метод, упражнение, мини-аудит или честный образовательный разбор. Не повторяешь одну идею разными словами. Пиши естественным русским языком без канцелярита.",
        },
        {
          role: "user",
          content: `Сгенерируй ${input.count} виральных идей для личной Content Studio.\n\nАвтор: ${workspace.voice.name}.\nГолос: ${workspace.voice.tone}. Обращение: ${workspace.voice.address}. Энергия: ${workspace.voice.energy}. Структура: ${workspace.voice.structure}. Доказательства: ${workspace.voice.proof}. CTA: ${workspace.voice.cta}. Избегать: ${workspace.voice.avoid}.\n\nСегмент ${segment.code}: ${segment.name}.\nКонтекст: ${segment.subtitle}.\nХочет: ${segment.goal}. Боль: ${segment.pain}. Страх: ${segment.fear}. Триггер: ${segment.trigger}. Оффер: ${segment.offer}.\n\nКанал: ${input.channel === "telegram" ? "только Telegram-посты" : input.channel === "reels" ? "только Reels" : "сбалансированная смесь Telegram-постов и Reels"}.\nДополнительный фокус пользователя: ${input.focus || "не задан — выбери самую сильную бытовую ситуацию сегмента"}.\n\nДля каждой идеи верни: ясный title, цепляющий hook для первых строк/секунд, format, angle (в чём конфликт и практическая польза), visual, cta, channel (telegram или reels) и objective. Каждый текстовый пункт — одна конкретная мысль, без длинных инструкций. Не используй слово «диагноз» и не обещай PDF, гайды, чек-листы или другие материалы, если они не заданы пользователем. Не упоминай клиентов, кейсы, отзывы, имена, чьи-либо результаты или «до/после». Идеи должны отличаться механизмом: бытовой POV, search-first, миф/реальность, план Б, мини-аудит, сериал, процесс/закулисье или контраст.`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "viral_content_ideas",
          strict: true,
          schema: {
            type: "object",
            properties: {
              ideas: {
                type: "array",
                minItems: 3,
                maxItems: 8,
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string", maxLength: 220 }, hook: { type: "string", maxLength: 420 }, format: { type: "string", maxLength: 180 }, angle: { type: "string", maxLength: 700 }, visual: { type: "string", maxLength: 520 }, cta: { type: "string", maxLength: 320 }, channel: { type: "string", enum: ["telegram", "reels"] }, objective: { type: "string", maxLength: 160 },
                  },
                  required: ["title", "hook", "format", "angle", "visual", "cta", "channel", "objective"],
                  additionalProperties: false,
                },
              },
            },
            required: ["ideas"],
            additionalProperties: false,
          },
        },
      },
    });
    return parseIdeas(response.choices[0]?.message.content);
  }),
});
