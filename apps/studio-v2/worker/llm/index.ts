import {
  generatedIdeaSchema,
  generatedMaterialSchema,
  type GeneratedIdea,
  type GeneratedMaterial,
  type MaterialKind,
  type MaterialLength,
} from "../../shared/types";
import { segmentByCode, voice } from "../../shared/seed";
import type { Env } from "../env";
import { callGemini } from "./gemini";
import { IDEAS_RESPONSE_SCHEMA, MATERIAL_RESPONSE_SCHEMA } from "./schemas";
import { callOpenAiCompatible } from "./openai";

export type GenerateArgs = {
  segmentCode: string;
  channel: "telegram" | "reels" | "both";
  count: number;
  focus: string;
};

export class LlmError extends Error {}

/**
 * The generator must not invent client stories or testimonials — the trainer
 * would have to stand behind them publicly. Anything that reads like one is
 * rejected rather than quietly published.
 */
const FABRICATED_PROOF =
  /(клиент[а-яё]*|отзыв[а-яё]*|кейс[а-яё]*|до\s*\/?\s*после|моя\s+подопечн[а-яё]*|мой\s+подопечн[а-яё]*)/i;

export function buildPrompt(args: GenerateArgs): { system: string; user: string } {
  const segment = segmentByCode(args.segmentCode);
  if (!segment) throw new LlmError("Неизвестный сегмент аудитории.");

  const channelLine =
    args.channel === "both"
      ? "Смешай форматы: часть идей для Telegram-постов, часть для Reels."
      : args.channel === "telegram"
        ? "Все идеи — для Telegram-постов."
        : "Все идеи — для коротких вертикальных Reels.";

  const system = [
    "Ты русскоязычный контент-стратег фитнес-эксперта.",
    "Придумываешь конкретные, этичные и небанальные идеи с потенциалом охвата, сохранений и обсуждения.",
    "Запрещено: медицинские заключения и слово «диагноз», гарантии результата,",
    "выдуманные истории клиентов, отзывы, кейсы и результаты «до/после».",
    "Пиши от лица эксперта о его подходе, а не о чужих достижениях.",
    "Отвечай строго валидным JSON без markdown-обёртки.",
  ].join(" ");

  const user = [
    `Сегмент аудитории ${segment.code} — ${segment.name}.`,
    `Внутренняя формулировка: «${segment.title}». ${segment.subtitle}`,
    `Цель: ${segment.goal}. Боль: ${segment.pain}. Страх: ${segment.fear}.`,
    `Что цепляет: ${segment.trigger}. Предложение: ${segment.offer}.`,
    "",
    `Голос автора: ${voice.name}. Тон — ${voice.tone}, обращение ${voice.address}, подача ${voice.energy}.`,
    `Структура: ${voice.structure}. Опора: ${voice.proof}. Призыв: ${voice.cta}.`,
    `Избегай: ${voice.avoid}.`,
    "",
    channelLine,
    args.focus ? `Тема, вокруг которой нужно крутиться: ${args.focus}.` : "",
    "",
    `Придумай ровно ${args.count} идей.`,
    'Верни JSON вида {"ideas":[{"title","hook","format","angle","visual","cta","channel","objective"}]}.',
    '"channel" — либо "telegram", либо "reels".',
    '"objective" — что идея должна принести: охват, сохранения, пересылки, комментарии или заявки.',
  ]
    .filter(Boolean)
    .join("\n");

  return { system, user };
}

export function parseIdeas(raw: string, expected: number): GeneratedIdea[] {
  const cleaned = raw
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new LlmError("Модель вернула не JSON. Попробуйте сгенерировать ещё раз.");
  }

  const container = parsed as { ideas?: unknown };
  const list = Array.isArray(parsed) ? parsed : container.ideas;
  const result = generatedIdeaSchema.array().min(1).safeParse(list);
  if (!result.success) {
    throw new LlmError("Модель вернула идеи в неожиданном формате. Попробуйте ещё раз.");
  }

  const ideas = result.data.slice(0, expected);
  const flagged = ideas.find((idea) => FABRICATED_PROOF.test(Object.values(idea).join(" ")));
  if (flagged) {
    throw new LlmError("Генератор отфильтровал выдуманный кейс или отзыв. Запустите генерацию ещё раз.");
  }
  return ideas;
}

/**
 * Provider dispatch, shared by every kind of generation.
 *
 * Every branch awaits rather than returning the promise: a returned rejection
 * is reported as unhandled before the caller's `await` attaches its handler.
 */
async function callModel(
  env: Env,
  system: string,
  user: string,
  responseSchema: unknown,
): Promise<string> {
  const provider = (env.LLM_PROVIDER || "gemini").toLowerCase();

  switch (provider) {
    case "gemini":
      return await callGemini(env, system, user, responseSchema);
    case "deepseek":
      return await callOpenAiCompatible(
        { apiKey: env.DEEPSEEK_API_KEY, baseUrl: "https://api.deepseek.com/v1", model: env.LLM_MODEL || "deepseek-chat", label: "DeepSeek" },
        system,
        user,
      );
    case "openai":
      return await callOpenAiCompatible(
        { apiKey: env.OPENAI_API_KEY, baseUrl: "https://api.openai.com/v1", model: env.LLM_MODEL || "gpt-4o-mini", label: "OpenAI" },
        system,
        user,
      );
    default:
      throw new LlmError(`Неизвестный провайдер «${provider}». Проверьте переменную LLM_PROVIDER.`);
  }
}

export async function generateIdeas(env: Env, args: GenerateArgs): Promise<GeneratedIdea[]> {
  const { system, user } = buildPrompt(args);
  const raw = await callModel(env, system, user, IDEAS_RESPONSE_SCHEMA);
  return parseIdeas(raw, args.count);
}

export type MaterialArgs = {
  kind: MaterialKind;
  topic: string;
  segmentCode: string;
  length: MaterialLength;
  goal: string;
  /** Set when the material grows out of a saved idea rather than a bare topic. */
  source: { hook: string | null; format: string | null; angle: string | null; visual: string | null; cta: string | null } | null;
};

const LENGTHS: Record<MaterialLength, { reel: string; post: string }> = {
  short: { reel: "3–4 кадра, до 20 секунд.", post: "До 800 знаков — короткий пост на один тезис." },
  medium: { reel: "5–7 кадров, 30–45 секунд.", post: "1200–1800 знаков — рабочий объём с примером." },
  long: { reel: "8–10 кадров, до 60 секунд.", post: "2500–3500 знаков — развёрнутый разбор." },
};

export function buildMaterialPrompt(args: MaterialArgs): { system: string; user: string } {
  const segment = segmentByCode(args.segmentCode);
  if (!segment) throw new LlmError("Неизвестный сегмент аудитории.");
  if (!args.topic.trim()) throw new LlmError("Нужна тема материала.");

  const isReel = args.kind === "reel";
  const size = LENGTHS[args.length][isReel ? "reel" : "post"];

  const system = [
    "Ты русскоязычный сценарист и редактор фитнес-эксперта.",
    isReel
      ? "Пишешь покадровые сценарии вертикальных Reels: что в кадре, что автор говорит, какой титр, как смонтировать."
      : "Пишешь готовые к публикации посты в Telegram: живой текст, который читают до конца.",
    "Запрещено: медицинские заключения и слово «диагноз», гарантии результата,",
    "выдуманные истории клиентов, отзывы, кейсы и результаты «до/после».",
    "Пиши от лица эксперта о его подходе, а не о чужих достижениях.",
    "Отвечай строго валидным JSON без markdown-обёртки.",
  ].join(" ");

  const sourceLines = args.source
    ? [
        "",
        "Материал вырастает из готовой идеи, держись её:",
        args.source.hook ? `Хук: ${args.source.hook}` : "",
        args.source.format ? `Формат: ${args.source.format}` : "",
        args.source.angle ? `Угол подачи: ${args.source.angle}` : "",
        args.source.visual ? `Визуал: ${args.source.visual}` : "",
        args.source.cta ? `Призыв: ${args.source.cta}` : "",
      ]
    : [];

  const user = [
    `Тема: ${args.topic}`,
    "",
    `Сегмент аудитории ${segment.code} — ${segment.name}.`,
    `Внутренняя формулировка: «${segment.title}». ${segment.subtitle}`,
    `Цель: ${segment.goal}. Боль: ${segment.pain}. Страх: ${segment.fear}.`,
    `Что цепляет: ${segment.trigger}. Предложение: ${segment.offer}.`,
    "",
    `Голос автора: ${voice.name}. Тон — ${voice.tone}, обращение ${voice.address}, подача ${voice.energy}.`,
    `Структура: ${voice.structure}. Опора: ${voice.proof}. Призыв: ${voice.cta}.`,
    `Избегай: ${voice.avoid}.`,
    ...sourceLines,
    "",
    args.goal ? `Материал должен принести: ${args.goal}.` : "",
    `Объём: ${size}`,
    "",
    isReel
      ? 'Верни JSON {"title","hook","body","scenes":[{"time","shot","speech","caption","edit"}],"visual","cta"}. ' +
        '"body" — сквозная мысль сценария одной-двумя фразами. "time" — тайминг вида «0–3 сек».'
      : 'Верни JSON {"title","hook","body","scenes":[],"visual","cta"}. ' +
        '"body" — полный текст поста с абзацами через \\n\\n. "scenes" оставь пустым массивом. ' +
        '"visual" — что приложить к посту картинкой.',
  ]
    .filter(Boolean)
    .join("\n");

  return { system, user };
}

export function parseMaterial(raw: string, kind: MaterialKind): GeneratedMaterial {
  const cleaned = raw
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new LlmError("Модель вернула не JSON. Попробуйте ещё раз.");
  }

  const result = generatedMaterialSchema.safeParse(parsed);
  if (!result.success) {
    throw new LlmError("Модель вернула материал в неожиданном формате. Попробуйте ещё раз.");
  }

  const material = result.data;
  if (kind === "reel" && material.scenes.length === 0) {
    throw new LlmError("Модель не расписала кадры. Попробуйте ещё раз.");
  }
  if (kind === "post" && !material.body.trim()) {
    throw new LlmError("Модель вернула пустой текст поста. Попробуйте ещё раз.");
  }

  const haystack = [
    material.title,
    material.hook,
    material.body,
    material.visual,
    material.cta,
    ...material.scenes.flatMap((scene) => [scene.shot, scene.speech, scene.caption, scene.edit]),
  ].join(" ");
  if (FABRICATED_PROOF.test(haystack)) {
    throw new LlmError("Генератор отфильтровал выдуманный кейс или отзыв. Запустите генерацию ещё раз.");
  }

  return material;
}

export async function generateMaterial(env: Env, args: MaterialArgs): Promise<GeneratedMaterial> {
  const { system, user } = buildMaterialPrompt(args);
  const raw = await callModel(env, system, user, MATERIAL_RESPONSE_SCHEMA);
  return parseMaterial(raw, args.kind);
}
