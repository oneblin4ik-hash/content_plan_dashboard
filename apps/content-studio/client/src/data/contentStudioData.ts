import type { GeneratedAsset, SegmentId, VoiceProfile } from "./strategyData";

export type StudioMode = "reels_topics" | "telegram_topics" | "reels_script" | "telegram_post";
export type StudioLength = "short" | "medium" | "long";

export type StudioResult = {
  id: string;
  mode: StudioMode;
  headline: string;
  summary: string;
  items: string[];
  content: string;
  nextStep: string;
  segmentId: SegmentId;
  topic: string;
  createdAt: string;
  favorite: boolean;
  cta?: string;
  scenes?: Array<{ time: string; shot: string; speech: string; caption: string; edit: string }>;
};

export const studioModes: Array<{ id: StudioMode; label: string; eyebrow: string; description: string; placeholder: string; calendarType: "reel" | "post" | "hook" }> = [
  { id: "reels_topics", label: "Темы для Reels", eyebrow: "01 · охват", description: "8 тем под сегмент, боль и выбранную формулу Reels Lab.", placeholder: "Например: как вернуться к тренировкам после срыва", calendarType: "hook" },
  { id: "reels_script", label: "Сценарии для Reels", eyebrow: "02 · видео", description: "Готовый покадровый сценарий: визуал, речь, титры, монтаж и CTA.", placeholder: "Например: тренировка, когда есть только 20 минут", calendarType: "reel" },
  { id: "telegram_topics", label: "Темы для Telegram", eyebrow: "03 · доверие", description: "8 постов, которые продолжают Reels и разогревают к диагностике.", placeholder: "Например: почему идеальный понедельник не приходит", calendarType: "hook" },
  { id: "telegram_post", label: "Пост в Telegram", eyebrow: "04 · прогрев", description: "Полный текст в вашем Tone of Voice с выводом и CTA.", placeholder: "Например: сладкое без отката и чувства вины", calendarType: "post" },
];

export const studioPresets = [
  { label: "План Б для мамы", topic: "Ребенок заболел: как не бросить свой план и сохранить минимум" },
  { label: "Срыв без отката", topic: "Что делать на следующий день после срыва без голодовки и наказания" },
  { label: "Офисный день", topic: "Похудение и питание в офисе без идеальных контейнеров" },
  { label: "Плато", topic: "Вес стоит, но усилий много" },
];

export const studioGoals = ["охват и сохранения", "переход в Telegram", "вовлечение в комментариях", "заявка на бесплатную консультацию", "доверие и экспертность"];
export const studioLengths: Array<{ id: StudioLength; label: string }> = [{ id: "short", label: "Коротко" }, { id: "medium", label: "Рабочий" }, { id: "long", label: "Развернуто" }];
export const reelsFormulas = [
  { id: "contrast", label: "Контраст → решение", pattern: "Ситуация → конфликт → ответ → доказательство → действие" },
  { id: "myth", label: "Миф → разбор", pattern: "Сильное утверждение → популярный миф → разбор → простой шаг → CTA" },
  { id: "plan-b", label: "План А / Б / В", pattern: "Сбой в реальной жизни → план А → план Б → план В → выбор на сегодня" },
  { id: "audit", label: "Разбор ошибки", pattern: "Ошибка → почему не работает → что заменить → визуальное доказательство → CTA" },
] as const;
export const telegramStructures = [
  "Ударный заголовок → миф/конфликт → объяснение → пример → вывод → CTA",
  "Личная ситуация → честный разбор → система → шаг на сегодня → CTA",
  "Вопрос подписчицы → ошибка → решение → мини-чек-лист → CTA",
];
export const studioCtas = ["Сохрани пост и попробуй сегодня", "Напиши кодовое слово «ПЛАН» в Telegram", "Забери гайд в Telegram", "Запишись на бесплатный разбор ситуации"];

export function getStudioCalendarMeta(mode: StudioMode): Pick<GeneratedAsset, "channel" | "type"> {
  if (mode === "reels_script") return { channel: "reels", type: "reel" };
  if (mode === "telegram_post") return { channel: "telegram", type: "post" };
  return { channel: mode === "reels_topics" ? "reels" : "telegram", type: "hook" };
}

export function defaultStudioResult(mode: StudioMode, topic: string, segmentId: SegmentId, voice: VoiceProfile): StudioResult {
  const label = studioModes.find((item) => item.id === mode)?.label || "Материал";
  return { id: `${Date.now()}-local`, mode, headline: `${label}: ${topic}`, summary: `Черновик в тоне ${voice.name}.`, items: [], content: "", nextStep: "Скорректируйте бриф и повторите генерацию.", segmentId, topic, createdAt: new Date().toISOString(), favorite: false, cta: "", scenes: [] };
}
