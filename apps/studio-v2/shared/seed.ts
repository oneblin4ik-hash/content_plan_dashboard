import type { SegmentCode } from "./types";

export type Segment = {
  code: SegmentCode;
  name: string;
  title: string;
  subtitle: string;
  goal: string;
  pain: string;
  fear: string;
  trigger: string;
  offer: string;
  color: string;
};

/** Audience segments carried over verbatim from the Manus build. */
export const segments: readonly Segment[] = [
  {
    code: "S1",
    name: "Начинающая",
    title: "Боюсь начать неправильно",
    subtitle: "Нужен безопасный старт без идеальной дисциплины",
    goal: "Понять первые шаги и почувствовать контроль",
    pain: "Не знает, что есть и как тренироваться",
    fear: "Снова провалиться и потратить деньги зря",
    trigger: "Простой маршрут с поддержкой",
    offer: "Старт без хаоса · первые 14 дней",
    color: "#FF525A",
  },
  {
    code: "S2",
    name: "После неудачных попыток",
    title: "Я уже всё пробовала",
    subtitle: "Нужно вернуть доверие к себе, а не ужесточать правила",
    goal: "Похудеть без режима «всё или ничего»",
    pain: "Срывы, усталость от диет и самокритика",
    fear: "Опять продержаться пару недель и откатиться",
    trigger: "Гибкое питание и план возвращения",
    offer: "Перезагрузка системы · 14 дней",
    color: "#F4363D",
  },
  {
    code: "S3",
    name: "Занятая мама или офис",
    title: "У меня нет времени",
    subtitle: "Нужна форма, которая встраивается в реальную неделю",
    goal: "Выглядеть спортивно при 2–3 тренировках",
    pain: "Дети, офис, дорога и непредсказуемый график",
    fear: "Заплатить за сопровождение и постоянно пропускать",
    trigger: "План А / Б / В и контроль без давления",
    offer: "Форма в реальном графике",
    color: "#D8232A",
  },
  {
    code: "S4",
    name: "Есть опыт, нет результата",
    title: "Тренируюсь, но тело не меняется",
    subtitle: "Нужен аудит и прогрессия вместо случайных упражнений",
    goal: "Увидеть минус в объёмах, силу и форму ягодиц",
    pain: "Много усилий без заметной динамики",
    fear: "Узнать, что месяцы были потрачены зря",
    trigger: "Понять узкое место и получить систему",
    offer: "Разбор плато · персональная прогрессия",
    color: "#9E1319",
  },
] as const;

export const voice = {
  name: "Serbolin — прямой тренер",
  tone: "разговорный, уверенный, прямой",
  address: "на ты",
  energy: "энергично, с контрастом и напором",
  structure: "ударный заголовок → миф/конфликт → объяснение → пример → вывод → CTA",
  proof: "цифры, личный опыт и простые аналогии",
  cta: "вопрос, опрос, кодовое слово или переход к гайду",
  avoid: "канцелярит, обезличенная мотивация, длинные вступления без конфликта",
  notes: "Допускай сильные формулировки, но сохраняй полезность и уважение к читателю.",
} as const;

export const defaultFolders = [
  { name: "Лайфхаки", color: "#FF525A", sortOrder: 0 },
  { name: "Мифы и разборы", color: "#F4363D", sortOrder: 1 },
  { name: "Подслушано у тренера", color: "#9E1319", sortOrder: 2 },
  { name: "Личный опыт", color: "#B4151C", sortOrder: 3 },
] as const;

export function segmentByCode(code: string): Segment | undefined {
  return segments.find((segment) => segment.code === code);
}

export const priorityLabels: Record<string, string> = {
  low: "Низкий",
  medium: "Средний",
  high: "Высокий",
  viral: "Вирусный",
};

export const sortLabels: Record<string, string> = {
  new: "Новые",
  old: "Старые",
  priority: "Приоритет",
  alpha: "А–Я",
};
