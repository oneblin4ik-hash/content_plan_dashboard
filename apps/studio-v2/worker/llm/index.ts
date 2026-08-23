import { generatedIdeaSchema, type GeneratedIdea } from "../../shared/types";
import { segmentByCode, voice } from "../../shared/seed";
import type { Env } from "../env";
import { callGemini } from "./gemini";
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

export async function generateIdeas(env: Env, args: GenerateArgs): Promise<GeneratedIdea[]> {
  const { system, user } = buildPrompt(args);
  const provider = (env.LLM_PROVIDER || "gemini").toLowerCase();

  let raw: string;
  switch (provider) {
    case "gemini":
      raw = await callGemini(env, system, user);
      break;
    case "deepseek":
      raw = await callOpenAiCompatible(
        { apiKey: env.DEEPSEEK_API_KEY, baseUrl: "https://api.deepseek.com/v1", model: env.LLM_MODEL || "deepseek-chat", label: "DeepSeek" },
        system,
        user,
      );
      break;
    case "openai":
      raw = await callOpenAiCompatible(
        { apiKey: env.OPENAI_API_KEY, baseUrl: "https://api.openai.com/v1", model: env.LLM_MODEL || "gpt-4o-mini", label: "OpenAI" },
        system,
        user,
      );
      break;
    default:
      throw new LlmError(`Неизвестный провайдер «${provider}». Проверьте переменную LLM_PROVIDER.`);
  }

  return parseIdeas(raw, args.count);
}
