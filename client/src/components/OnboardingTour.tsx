import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import {
  MessageCircle,
  Wand2,
  Calendar,
  BarChart3,
  Sparkles,
  ArrowRight,
  X,
  Check,
  BookOpen,
  Bookmark,
  MessageSquare,
  Layers,
  Microscope,
  TrendingUp,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

/* ============================================================
   OnboardingTour — пошаговое обучение для новых юзеров.

   Запускается:
   1) автоматически после регистрации (SignUp.tsx ставит флаг
      sessionStorage 'cs.onboarding_pending');
   2) программно из любой кнопки «Показать обучение» через
      restartOnboardingTour() — она диспатчит CustomEvent, который
      компонент ловит и открывает себя заново.

   После прохождения / пропуска — localStorage 'cs.onboarding_done' = '1',
   автоматически больше не появляется. Restart игнорирует флаг done.

   Технически:
   - 10 шагов по всем разделам сервиса
   - Стеклянная карточка в центре: backdrop-blur(28px) + полупрозрачный
     затемняющий слой
   - Parallax при движении мыши: внешняя обёртка делает perspective +
     rotateX/Y, фоновые radial-glow смещаются в обратные стороны, контент
     микро-сдвигается — даёт ощущение объёма
   - Slide-in анимация на смене шага (key={step} пересоздаёт inner-div,
     CSS keyframe играет каждый раз)
   - Не блокирует фон жёстко: ESC, «Пропустить», стрелки клавиатуры
   ============================================================ */

const DONE_KEY = "cs.onboarding_done";
const PENDING_KEY = "cs.onboarding_pending";
const RESTART_EVENT = "cs:restart-onboarding";

export function markOnboardingPending() {
  sessionStorage.setItem(PENDING_KEY, "1");
}

/* Перезапуск тура из кнопки «Показать обучение». Сбрасывает done-флаг
   и шлёт событие — компонент тура подхватит его и откроется. Не
   требует перезагрузки страницы. */
export function restartOnboardingTour() {
  localStorage.removeItem(DONE_KEY);
  sessionStorage.removeItem(PENDING_KEY);
  window.dispatchEvent(new CustomEvent(RESTART_EVENT));
}

type Step = {
  icon: typeof Wand2;
  eyebrow: string;
  title: string;
  body: string;
  cta?: { label: string; href: string };
};

const STEPS: Step[] = [
  {
    icon: Sparkles,
    eyebrow: "Привет!",
    title: "Покажу сервис по разделам — минута",
    body: "У тебя 3 дня триала и 1 000 токенов в подарок: хватит на ~8 постов или 5 постов и анализ конкурента. Сейчас за минуту пройдёмся по разделам — после этого начнёшь работать.",
  },
  {
    icon: BookOpen,
    eyebrow: "Раздел · Идеи",
    title: "Библиотека готовых тем",
    body: "Главная страница после входа: стартовые темы и Reels-сценарии под нишу. Можно фильтровать по форматам и папкам, добавлять свои и одним кликом отправлять любую тему в Студию.",
    cta: { label: "Открыть «Идеи»", href: "/dashboard" },
  },
  {
    icon: Bookmark,
    eyebrow: "Раздел · Шаблоны",
    title: "Вирусные паттерны постов",
    body: "17 готовых структур: «Не делай X. Делай Y», «3 ошибки, которые…», «Я делал X 5 лет. Зря.» и другие. Применяешь шаблон → Студия пишет пост строго по проверенной структуре.",
    cta: { label: "Открыть «Шаблоны»", href: "/templates" },
  },
  {
    icon: MessageSquare,
    eyebrow: "Раздел · Помощник",
    title: "AI-стратег для контента",
    body: "Чат, который знает твою нишу, голос и метрики. Спрашивай «что выложить сегодня?», «какой формат лучше зайдёт?» — даст конкретные идеи с учётом того, что у тебя уже работало.",
    cta: { label: "Открыть «Помощник»", href: "/assistant" },
  },
  {
    icon: MessageCircle,
    eyebrow: "Раздел · Голос",
    title: "Настрой, как ИИ пишет от твоего имени",
    body: "Это самое важное. Опиши себя: ниша, ЦА, обращение, любимые обороты, запрещённые слова. Без этого тексты звучат как у нейросети. С этим — как ты.",
    cta: { label: "Открыть «Голос»", href: "/voice" },
  },
  {
    icon: Wand2,
    eyebrow: "Раздел · Студия",
    title: "Главный инструмент генерации",
    body: "Тема → формат (пост / Reels / карусель / хуки / хэштеги) → тон → 15-20 секунд → готовый текст. Кнопка «История» хранит твои попытки — можно сравнивать версии бок о бок.",
    cta: { label: "Открыть «Студию»", href: "/generator" },
  },
  {
    icon: Layers,
    eyebrow: "Раздел · Карусели",
    title: "Визуальный конструктор слайдов",
    body: "AI пишет текст слайдов — ты собираешь дизайн: темы оформления, шрифты, фоновые фото, экспорт в PNG или ZIP под Instagram 4:5 / 1:1 / 9:16. Дизайн стоит 0 токенов — переделывай сколько хочешь.",
    cta: { label: "Открыть «Карусели»", href: "/carousel" },
  },
  {
    icon: Calendar,
    eyebrow: "Раздел · План",
    title: "Календарь публикаций",
    body: "Перетаскивай темы в дни. Кнопка «Авто-план» расставит за тебя темы на 4-12 недель с разными форматами. Кнопка «Своя» — запланировать вручную пост, Reels или Stories.",
    cta: { label: "Открыть «План»", href: "/plan" },
  },
  {
    icon: Microscope,
    eyebrow: "Раздел · Разбор поста",
    title: "Учись на чужом успехе",
    body: "Вставь ссылку на удачный пост в Telegram (или текст любого поста) — AI разберёт, почему он цепляет, и подскажет, как применить эти приёмы в твоём голосе.",
    cta: { label: "Открыть «Разбор»", href: "/analyze" },
  },
  {
    icon: TrendingUp,
    eyebrow: "Раздел · Тренды и Аналитика",
    title: "Что в нише и что у тебя работает",
    body: "«Тренды» — свежие виральные темы в твоей нише с фильтрами по периоду. «Аналитика» — заноси метрики своих постов: дашборд с ER, график динамики, AI-инсайты «что повторять, что слить» + разбор конкурентов в Telegram / YouTube / Instagram.",
    cta: { label: "Открыть «Аналитику»", href: "/analytics" },
  },
  {
    icon: Check,
    eyebrow: "Готово",
    title: "Начни с голоса — это даст самый сильный буст",
    body: "Без настроенного голоса даже хорошая модель пишет шаблонно. Заполни анкету за 2 минуты — и все следующие генерации станут на порядок лучше. Удачи!",
    cta: { label: "Перейти к настройке голоса", href: "/voice" },
  },
];

export default function OnboardingTour() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  /* mx/my — нормализованные координаты мыши от центра экрана,
     -1..1 по каждой оси. Используются для parallax-смещения. */
  const [mx, setMx] = useState(0);
  const [my, setMy] = useState(0);

  /* Авто-запуск после регистрации (флаг pending в sessionStorage). */
  useEffect(() => {
    if (!user) return;
    if (localStorage.getItem(DONE_KEY) === "1") return;
    if (sessionStorage.getItem(PENDING_KEY) === "1") {
      sessionStorage.removeItem(PENDING_KEY);
      setStep(0);
      setOpen(true);
    }
  }, [user]);

  /* Программный перезапуск через restartOnboardingTour(): слушаем
     custom-event, открываемся с нулевого шага. Работает даже у
     админа — это его явное действие через кнопку. */
  useEffect(() => {
    const onRestart = () => {
      setStep(0);
      setOpen(true);
    };
    window.addEventListener(RESTART_EVENT, onRestart);
    return () => window.removeEventListener(RESTART_EVENT, onRestart);
  }, []);

  /* Закрытие по ESC + listener для мыши */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish(false);
      else if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
    };
    const onMove = (e: MouseEvent) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setMx((e.clientX - w / 2) / (w / 2));
      setMy((e.clientY - h / 2) / (h / 2));
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousemove", onMove);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step]);

  const finish = (completed: boolean) => {
    setOpen(false);
    if (completed) localStorage.setItem(DONE_KEY, "1");
    /* На "пропустить" тоже отмечаем как done — иначе будет
       раздражать при каждом возврате на дашборд. Можно повторно
       запустить через debug-команду в /admin (на будущее). */
    else localStorage.setItem(DONE_KEY, "1");
  };

  const goNext = () => {
    if (step < STEPS.length - 1) setStep((s) => s + 1);
    else finish(true);
  };
  const goPrev = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  if (!open) return null;

  const s = STEPS[step];
  const Icon = s.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      role="dialog"
      aria-modal="true"
    >
      {/* Затемняющий слой с blur — основа стеклянного эффекта.
          Чуть подсвечен золотом в центре через radial-gradient,
          смещение позиции = parallax глубинного слоя. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(closest-side at " +
            (50 + mx * 8) +
            "% " +
            (50 + my * 8) +
            "%, rgba(212,168,67,0.18), transparent 60%), rgba(0,0,0,0.55)",
          backdropFilter: "blur(28px) saturate(140%)",
          WebkitBackdropFilter: "blur(28px) saturate(140%)",
          transition: "background 0.3s ease-out",
        }}
        onClick={() => finish(false)}
      />

      {/* Стеклянная карточка. Внешний контейнер — позиционирование +
          лёгкий parallax по противоположной к мыши оси (контент
          «приподнят» над фоном). Внутренний layer — содержимое с
          собственным микро-parallax, чтобы создать многослойность. */}
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 520,
          transform:
            "perspective(1000px) rotateX(" +
            -my * 1.5 +
            "deg) rotateY(" +
            mx * 1.5 +
            "deg) translate3d(" +
            -mx * 6 +
            "px, " +
            -my * 6 +
            "px, 0)",
          transition: "transform 0.18s ease-out",
        }}
      >
        {/* Внешняя золотая обводка с лёгким glow. */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: -1,
            borderRadius: 22,
            background:
              "linear-gradient(135deg, rgba(212,168,67,0.6), rgba(212,168,67,0.05) 50%, rgba(212,168,67,0.4))",
            pointerEvents: "none",
          }}
        />

        <div
          className="glass-card"
          style={{
            position: "relative",
            background:
              "linear-gradient(180deg, rgba(26,26,26,0.78), rgba(20,20,20,0.92))",
            backdropFilter: "blur(20px) saturate(180%)",
            WebkitBackdropFilter: "blur(20px) saturate(180%)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 22,
            padding: "36px 32px 28px",
            boxShadow:
              "0 30px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(212,168,67,0.18) inset, 0 1px 0 rgba(255,255,255,0.08) inset",
            overflow: "hidden",
          }}
        >
          {/* Внутренний parallax-блик — мягкое золотое пятно, которое
              «уезжает» в обратном направлении при движении мыши,
              создавая иллюзию глубины как у Vision Pro. */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: -100,
              left: -100,
              width: 380,
              height: 380,
              background:
                "radial-gradient(closest-side, rgba(212,168,67,0.22), transparent 70%)",
              filter: "blur(20px)",
              transform:
                "translate3d(" +
                mx * 30 +
                "px, " +
                my * 30 +
                "px, 0)",
              transition: "transform 0.25s ease-out",
              pointerEvents: "none",
            }}
          />
          <div
            aria-hidden
            style={{
              position: "absolute",
              bottom: -120,
              right: -80,
              width: 320,
              height: 320,
              background:
                "radial-gradient(closest-side, rgba(255,255,255,0.06), transparent 70%)",
              filter: "blur(20px)",
              transform:
                "translate3d(" +
                -mx * 24 +
                "px, " +
                -my * 24 +
                "px, 0)",
              transition: "transform 0.25s ease-out",
              pointerEvents: "none",
            }}
          />

          {/* Прогресс-точки */}
          <div
            style={{
              position: "relative",
              display: "flex",
              gap: 6,
              marginBottom: 26,
            }}
          >
            {STEPS.map((_, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: 3,
                  borderRadius: 9999,
                  background:
                    i <= step
                      ? "var(--brand-gold)"
                      : "rgba(255,255,255,0.12)",
                  transition: "background 0.3s",
                }}
              />
            ))}
          </div>

          {/* Закрыть */}
          <button
            onClick={() => finish(false)}
            title="Пропустить тур"
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              width: 32,
              height: 32,
              background: "transparent",
              border: 0,
              borderRadius: 9999,
              color: "var(--muted-foreground)",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.08)";
              e.currentTarget.style.color = "#fff";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--muted-foreground)";
            }}
          >
            <X className="w-4 h-4" />
          </button>

          {/* Контент карточки. Внешний слой держит parallax-смещение
              от мыши (transform управляется inline), внутренний div
              с key={step} играет CSS-анимацию входа при смене шага —
              два слоя нужны, чтобы transform'ы не конфликтовали. */}
          <div
            style={{
              position: "relative",
              transform:
                "translate3d(" +
                mx * 3 +
                "px, " +
                my * 3 +
                "px, 0)",
              transition: "transform 0.25s ease-out",
            }}
          >
            <div key={step} className="tour-step-in">
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 14,
                background:
                  "linear-gradient(135deg, rgba(212,168,67,0.22), rgba(212,168,67,0.08))",
                border: "1px solid rgba(212,168,67,0.35)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--brand-gold)",
                marginBottom: 18,
                boxShadow:
                  "0 4px 16px rgba(212,168,67,0.18), 0 0 0 1px rgba(255,255,255,0.04) inset",
              }}
            >
              <Icon className="w-6 h-6" />
            </div>

            <div
              className="eyebrow"
              style={{ marginBottom: 8, color: "var(--brand-gold)" }}
            >
              {s.eyebrow}
            </div>

            <h2
              style={{
                fontSize: 24,
                lineHeight: 1.2,
                letterSpacing: "-0.4px",
                color: "#fff",
                marginBottom: 12,
              }}
            >
              {s.title}
            </h2>

            <p
              className="text-platinum"
              style={{
                fontSize: 15,
                lineHeight: 1.55,
                margin: 0,
                marginBottom: 28,
              }}
            >
              {s.body}
            </p>

            {/* Действия */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              {step > 0 && (
                <button
                  onClick={goPrev}
                  style={{
                    padding: "10px 16px",
                    background: "transparent",
                    border: "1px solid rgba(255,255,255,0.14)",
                    color: "var(--brand-platinum)",
                    borderRadius: 9999,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Назад
                </button>
              )}

              <div style={{ flex: 1 }} />

              {s.cta && !isLast && (
                <button
                  onClick={() => {
                    finish(true);
                    navigate(s.cta!.href);
                  }}
                  style={{
                    padding: "10px 18px",
                    background: "transparent",
                    border: "1px solid rgba(212,168,67,0.4)",
                    color: "var(--brand-gold)",
                    borderRadius: 9999,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {s.cta.label}
                </button>
              )}

              <button
                onClick={() => {
                  if (isLast && s.cta) {
                    finish(true);
                    navigate(s.cta.href);
                  } else {
                    goNext();
                  }
                }}
                className="btn-gold"
                style={{
                  padding: "12px 22px",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                {isLast ? s.cta?.label ?? "Готово" : "Дальше"}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div
              style={{
                marginTop: 18,
                fontSize: 11,
                color: "var(--muted-foreground)",
                textAlign: "center",
                letterSpacing: 0.3,
              }}
            >
              {step + 1} из {STEPS.length} ·{" "}
              <button
                onClick={() => finish(false)}
                style={{
                  background: "none",
                  border: 0,
                  color: "var(--muted-foreground)",
                  textDecoration: "underline",
                  cursor: "pointer",
                  fontSize: 11,
                  padding: 0,
                }}
              >
                Пропустить тур
              </button>
            </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
