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
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

/* ============================================================
   OnboardingTour — пошаговое обучение для новых юзеров.

   Запускается автоматически после регистрации (SignUp.tsx ставит
   sessionStorage флаг 'cs.onboarding_pending'; этот компонент его
   подхватывает и стартует тур). После прохождения / пропуска —
   localStorage 'cs.onboarding_done' = '1', больше не показывается.

   Технически:
   - 6 шагов, в центре экрана большая стеклянная карточка
   - Behind: backdrop-blur(28px) + полупрозрачный затемняющий слой
   - Parallax: при движении мыши контент карточки и фоновое свечение
     сдвигаются в разные стороны. Создаёт ощущение объёма / глубины,
     дороже чем плоская модалка.
   - Не блокирует фон жёстко: можно нажать ESC или «Пропустить»
   - Сами этапы — статичные модалки с иконкой/заголовком/описанием;
     навигация по сервису остаётся за юзером после тура (так проще
     и надёжнее, чем привязка к конкретным DOM-элементам).
   ============================================================ */

const DONE_KEY = "cs.onboarding_done";
const PENDING_KEY = "cs.onboarding_pending";

export function markOnboardingPending() {
  sessionStorage.setItem(PENDING_KEY, "1");
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
    title: "Покажу за 40 секунд, как пользоваться",
    body: "У тебя 3 дня триала и 1 000 токенов на старте — хватит на 5–8 публикаций или 4 поста и анализ конкурента, чтобы попробовать всё в деле.",
  },
  {
    icon: MessageCircle,
    eyebrow: "Шаг 1 · Голос",
    title: "Настрой, как ИИ пишет от твоего имени",
    body: "Зайди в раздел «Голос» и опиши себя: имя, ниша, ЦА, обращение, любимые обороты, запрещённые слова. Без этого AI пишет шаблонно. С этим — как ты.",
    cta: { label: "Открыть «Голос»", href: "/voice" },
  },
  {
    icon: Wand2,
    eyebrow: "Шаг 2 · Студия",
    title: "Главный инструмент — генерация контента",
    body: "Введи тему, выбери формат (пост / Reels / карусель), тон и рубрику — за 15-20 секунд получишь готовый текст. Не нравится? Жми «Перегенерировать» или редактируй прямо в окне.",
    cta: { label: "Открыть Студию", href: "/generator" },
  },
  {
    icon: Calendar,
    eyebrow: "Шаг 3 · План",
    title: "Контент-план на месяц одной кнопкой",
    body: "Раздел «План» — перетаскивай темы в дни календаря. Кнопкой «Авто-план» AI расставит за тебя темы на 4-12 недель с разными форматами и тонами.",
    cta: { label: "Открыть План", href: "/plan" },
  },
  {
    icon: BarChart3,
    eyebrow: "Шаг 4 · Аналитика",
    title: "Чем больше данных — тем точнее тексты",
    body: "После публикации вноси просмотры и реакции в раздел «Аналитика». Система видит, что зашло, и подмешивает паттерны успешных постов в новые генерации. Чем дольше — тем лучше.",
    cta: { label: "Открыть Аналитику", href: "/analytics" },
  },
  {
    icon: Check,
    eyebrow: "Готово",
    title: "Можно начинать",
    body: "Начни с настройки голоса — это даст самый сильный буст качеству. Дальше пробуй темы из «Идей» или вводи свои в «Студии». Удачи!",
    cta: { label: "Начать с голоса", href: "/voice" },
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

  /* Решаем, показывать ли тур при загрузке. Условия: юзер залогинен,
     не админ (админу не нужно), и есть pending-флаг ИЛИ это первый
     вход юзера, который ещё не отметил done. */
  useEffect(() => {
    if (!user || user.role === "admin") return;
    if (localStorage.getItem(DONE_KEY) === "1") return;
    if (sessionStorage.getItem(PENDING_KEY) === "1") {
      sessionStorage.removeItem(PENDING_KEY);
      setOpen(true);
    }
  }, [user]);

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

          {/* Контент карточки — здесь parallax-микросмещение
              работает чуть слабее, чем внешняя обёртка, что даёт
              эффект «текст как будто над стеклом». */}
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
  );
}
