/**
 * Описание тарифов — единый источник истины. Используется на /pricing
 * для рендера карточек и (в будущем) на сервере для enforcement лимитов
 * через middleware. Цены и фичи менять только тут.
 *
 * Утверждено юзером в чате: стандартная сетка с анкором VIP в 4× от
 * флагмана, чтобы большинство выбирало флагман. Все цены — в рублях,
 * месячная подписка.
 */

export type PlanId = "trial" | "starter" | "pro" | "brand";

export type Plan = {
  id: PlanId;
  name: string;
  tagline: string;
  priceRub: number | null; // null = триал / по запросу
  pricePeriod: string;
  /* Технические лимиты. tokensPerMonth — в «пользовательской» шкале
     баланса (1 = 10 реальных токенов Gemini, см. TOKEN_DIVISOR на
     сервере). Серверная сторона потом будет читать это для
     enforcement. */
  tokensPerMonth: number; // -1 = безлимит
  voiceProfiles: number; // -1 = безлимит
  competitorsTracked: number; // -1 = безлимит
  autoplanWeeks: number; // -1 = безлимит
  teamSeats: number;
  /* Список фич в порядке отображения. Первая стрелка = самая
     «сочная», последняя — самая мелкая. */
  features: string[];
  /* Видимый CTA. Для платных пока mailto, после интеграции
     ЮKassa здесь будет ссылка на checkout. */
  cta: { label: string; href: string };
  highlight?: boolean; // подсветить как «рекомендуем»
  badge?: string;
};

const ML = "mailto:hello@content-studio.app";

export const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Старт",
    tagline: "Чтобы начать выходить регулярно",
    priceRub: 590,
    pricePeriod: "₽ / мес",
    tokensPerMonth: 6_000,
    voiceProfiles: 1,
    competitorsTracked: 0,
    autoplanWeeks: 2,
    teamSeats: 1,
    features: [
      "6 000 токенов в месяц",
      "1 голосовой профиль",
      "Авто-план календаря до 2 недель",
      "Карусели — экспорт PNG",
      "Telegram-публикации",
      "Поддержка email · 48 часов",
    ],
    cta: { label: "Выбрать «Старт»", href: ML + "?subject=Старт" },
  },
  {
    id: "pro",
    name: "Профи",
    tagline: "Полноценная воронка контента и аналитика",
    priceRub: 2_490,
    pricePeriod: "₽ / мес",
    tokensPerMonth: 30_000,
    voiceProfiles: 3,
    competitorsTracked: 5,
    autoplanWeeks: 12,
    teamSeats: 1,
    features: [
      "30 000 токенов в месяц",
      "3 голосовых профиля",
      "Анализ 5 конкурентов",
      "Авто-план календаря до 12 недель",
      "Карусели — экспорт PNG + ZIP",
      "Расширенные инсайты по метрикам",
      "Поддержка email · 24 часа",
    ],
    cta: { label: "Выбрать «Профи»", href: ML + "?subject=Профи" },
    highlight: true,
    badge: "Лучший выбор",
  },
  {
    id: "brand",
    name: "Бренд",
    tagline: "Для агентств и больших каналов",
    priceRub: 9_900,
    pricePeriod: "₽ / мес",
    tokensPerMonth: -1,
    voiceProfiles: -1,
    competitorsTracked: -1,
    autoplanWeeks: -1,
    teamSeats: 5,
    features: [
      "Безлимит токенов",
      "Безлимит голосовых профилей",
      "Безлимит анализов конкурентов",
      "Авто-план — без ограничения по периоду",
      "Карусели + авто-публикация в IG/TG",
      "До 5 командных мест",
      "Telegram-поддержка · 4 часа",
      "Персональный onboarding-созвон",
    ],
    cta: { label: "Выбрать «Бренд»", href: ML + "?subject=Бренд" },
  },
];

export function findPlan(id: string): Plan | undefined {
  return PLANS.find((p) => p.id === id);
}
