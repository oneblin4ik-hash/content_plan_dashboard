/**
 * Прайс LLM-операций в единицах баланса пользователя (1 токен баланса =
 * 10 реальных токенов Gemini, см. TOKEN_DIVISOR в server/_core/llm-guard.ts).
 *
 * Цифры — оценки, основанные на реальных замерах. Сервер списывает по
 * фактическому usage Gemini, эти числа нужны UI для бейджа «~50 ⚡»
 * рядом с кнопкой и для предупреждения «осторожно, может не хватить».
 *
 * Если реальный расход систематически выше — обновляем числа здесь.
 */

export type LlmActionId =
  | "post"          // 1 пост в Telegram/Instagram
  | "reels"         // сценарий Reels
  | "carousel"      // текст слайдов карусели
  | "hooks"         // 7 альтернативных хуков
  | "hashtags"      // подбор хэштегов
  | "fullPack"      // пост + reels + хуки + хэштеги (1 вызов)
  | "monthPlan"     // авто-план календаря на N недель
  | "topics"        // генерация новых тем для библиотеки
  | "analyzePost"   // разбор чужого поста
  | "analyzeChannel" // AI-отчёт по конкуренту
  | "insights"      // AI-инсайты по метрикам
  | "assistant"     // 1 ответ контент-помощника
  | "refine";       // правка готового текста по инструкции

type Action = {
  cost: number;
  label: string;
  /* Подсказка для tooltip: что внутри. */
  desc: string;
};

export const LLM_ACTIONS: Record<LlmActionId, Action> = {
  post:           { cost: 120, label: "Пост",            desc: "Готовый пост в Telegram или Instagram" },
  reels:          { cost: 100, label: "Reels-сценарий",  desc: "Сценарий вертикального видео" },
  carousel:       { cost: 120, label: "Карусель",        desc: "Текст слайдов карусели (без дизайна — он бесплатный)" },
  hooks:          { cost: 80,  label: "7 хуков",         desc: "Альтернативные первые фразы поста" },
  hashtags:       { cost: 50,  label: "Хэштеги",         desc: "15 релевантных тегов" },
  fullPack:       { cost: 250, label: "Полный пакет",    desc: "Пост + Reels + хуки + хэштеги одним вызовом" },
  monthPlan:      { cost: 250, label: "Авто-план месяца", desc: "Расписание тем на 4-12 недель" },
  topics:         { cost: 120, label: "Новые темы",      desc: "Генерация 6 идей для библиотеки" },
  analyzePost:    { cost: 150, label: "Разбор поста",    desc: "Разбор чужого поста: хук, структура, триггеры" },
  analyzeChannel: { cost: 250, label: "Отчёт по каналу", desc: "AI-разбор конкурента и рекомендации" },
  insights:       { cost: 150, label: "AI-инсайты",      desc: "Разбор твоей статистики и что менять" },
  assistant:      { cost: 80,  label: "Ответ помощника", desc: "Один ответ контент-стратега" },
  refine:         { cost: 60,  label: "Правка",          desc: "Точечная переписка готового текста" },
};

export function costOf(id: LlmActionId): number {
  return LLM_ACTIONS[id].cost;
}

/* Конвертация в «человеческие» единицы для лендинга/тарифов:
   во сколько постов конвертируется N токенов баланса. */
export function approxPosts(tokens: number): number {
  return Math.floor(tokens / LLM_ACTIONS.post.cost);
}
