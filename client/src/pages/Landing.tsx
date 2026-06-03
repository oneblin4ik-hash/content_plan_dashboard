import { Link } from "wouter";
import {
  Sparkles,
  Wand2,
  TrendingUp,
  Calendar,
  MessageCircle,
  BarChart3,
  Zap,
  ShieldCheck,
  ArrowRight,
  Check,
  X,
  Brain,
  Layers,
  Clock,
} from "lucide-react";
import { PLANS } from "@/lib/plans";
import { useAuth } from "@/contexts/AuthContext";

/* Куда ведёт основная CTA: гостя — на регистрацию, залогиненного —
   сразу в приложение. Хук, чтобы не дублировать логику в секциях. */
function useCtaTarget() {
  const { user } = useAuth();
  return user
    ? { href: "/dashboard", primary: "В дашборд", secondary: "В дашборд" }
    : {
        href: "/signup",
        primary: "Попробовать 3 дня бесплатно",
        secondary: "Начать бесплатно",
      };
}

/* ============================================================
   Лендинг для неавторизованных. Показывается на "/" пока юзер не
   залогинен (после логина "/" → Dashboard). Задача — за 60 секунд
   объяснить ценность и довести до /signup.

   Структура: hero → боль → решение (4 преимущества) → как работает
   (3 шага) → сравнение (vs копирайтер / vs ChatGPT) → тарифы →
   FAQ → финальный CTA. Все секции независимые, можно тасовать.

   Без сторонних библиотек анимаций — только CSS transitions и
   gradient'ы из var(--brand-gold).
   ============================================================ */
export default function Landing() {
  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--background)" }}
    >
      <LandingNav />
      <Hero />
      <PainPoints />
      <Features />
      <HowItWorks />
      <Comparison />
      <Pricing />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  );
}

/* ─── Top nav (отдельная, не основная Navigation, т.к. для не-юзеров) ─ */

function LandingNav() {
  const { user } = useAuth();
  return (
    <nav
      className="frosted sticky top-0 z-40"
      style={{
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: "14px 0",
      }}
    >
      <div
        className="container"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 14,
        }}
      >
        <Link href="/">
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: 20,
              letterSpacing: "-0.3px",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Content Studio
            <span style={{ color: "var(--brand-gold)" }}>.</span>
          </span>
        </Link>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {user ? (
            /* Залогинен — сразу в приложение, без «Войти». */
            <Link href="/dashboard">
              <span
                className="btn-gold"
                style={{
                  padding: "10px 20px",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                В дашборд
                <ArrowRight className="w-4 h-4" />
              </span>
            </Link>
          ) : (
            <>
              <Link href="/signin">
                <span
                  style={{
                    fontSize: 13,
                    color: "var(--brand-platinum)",
                    cursor: "pointer",
                    padding: "8px 14px",
                  }}
                >
                  Войти
                </span>
              </Link>
              <Link href="/signup">
                <span
                  className="btn-gold"
                  style={{
                    padding: "10px 20px",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  Начать бесплатно
                </span>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

/* ─── Hero ──────────────────────────────────────────────────── */

function Hero() {
  const cta = useCtaTarget();
  return (
    <section
      style={{
        padding: "96px 0 64px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Золотое радиальное свечение под текстом — даёт «дорогую»
          подложку без графики. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: "10%",
          left: "50%",
          transform: "translateX(-50%)",
          width: 900,
          height: 600,
          background:
            "radial-gradient(closest-side, rgba(212,168,67,0.18), transparent 70%)",
          filter: "blur(40px)",
          pointerEvents: "none",
        }}
      />
      <div
        className="container"
        style={{
          textAlign: "center",
          position: "relative",
          maxWidth: 920,
        }}
      >
        <div
          className="eyebrow"
          style={{ marginBottom: 18, color: "var(--brand-gold)" }}
        >
          <Sparkles
            className="w-3.5 h-3.5"
            style={{ display: "inline", marginRight: 6 }}
          />
          AI для контент-блогеров и онлайн-тренеров
        </div>
        <h1
          style={{
            fontSize: "clamp(36px, 5.5vw, 64px)",
            lineHeight: 1.05,
            letterSpacing: "-1px",
            marginBottom: 22,
          }}
        >
          Месяц контента{" "}
          <span style={{ color: "var(--brand-gold)" }}>
            за один вечер.
          </span>
          <br />
          От твоего имени. В твоём голосе.
        </h1>
        <p
          className="text-platinum"
          style={{
            fontSize: 19,
            lineHeight: 1.55,
            maxWidth: 680,
            margin: "0 auto 36px",
          }}
        >
          Хватит сидеть с пустой страницей в Notion. Введи тему — и через
          15 секунд готов пост в Telegram, сценарий Reels, карусель для
          Instagram и виральные хуки. Всё{" "}
          <span style={{ color: "#fff", fontWeight: 600 }}>
            в твоём стиле
          </span>{" "}
          — не как у нейросети.
        </p>

        <div
          style={{
            display: "flex",
            gap: 12,
            justifyContent: "center",
            flexWrap: "wrap",
            marginBottom: 28,
          }}
        >
          <Link href={cta.href}>
            <span
              className="btn-gold gold-glow"
              style={{
                padding: "16px 32px",
                fontSize: 16,
                cursor: "pointer",
              }}
            >
              {cta.primary}
              <ArrowRight className="w-4 h-4" />
            </span>
          </Link>
          <a
            href="#how-it-works"
            style={{
              padding: "16px 28px",
              fontSize: 15,
              color: "var(--brand-platinum)",
              border: "1px solid rgba(255,255,255,0.14)",
              borderRadius: 9999,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            Как это работает
          </a>
        </div>

        <div
          style={{
            display: "inline-flex",
            gap: 18,
            alignItems: "center",
            fontSize: 12,
            color: "var(--muted-foreground)",
            letterSpacing: 0.4,
          }}
        >
          <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
            <ShieldCheck className="w-3.5 h-3.5" />
            Без карты
          </span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
            <Zap className="w-3.5 h-3.5" />
            3 000 токенов в подарок
          </span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
            <Clock className="w-3.5 h-3.5" />
            Старт за 30 секунд
          </span>
        </div>
      </div>
    </section>
  );
}

/* ─── Боль ──────────────────────────────────────────────────── */

const PAINS = [
  {
    bad: "Сидишь над одним постом по часу",
    good: "Пост за 15 секунд — пока кофе остывает",
  },
  {
    bad: "Тексты ChatGPT — пресные, как у всех",
    good: "ИИ изучает твой голос и пишет как ты",
  },
  {
    bad: "Контент-план в Notion забыт через неделю",
    good: "AI составит план на месяц одной кнопкой",
  },
  {
    bad: "Не понимаешь, что зашло, а что нет",
    good: "Метрики постов → инсайты что писать дальше",
  },
];

function PainPoints() {
  return (
    <section style={{ padding: "64px 0", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
      <div className="container" style={{ maxWidth: 1040 }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>
            Знакомо?
          </div>
          <h2
            style={{
              fontSize: "clamp(28px, 4vw, 40px)",
              letterSpacing: "-0.5px",
              lineHeight: 1.15,
            }}
          >
            Если узнаёшь себя — мы сделали это{" "}
            <span style={{ color: "var(--brand-gold)" }}>для тебя</span>
          </h2>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 14,
          }}
        >
          {PAINS.map((p, i) => (
            <div
              key={i}
              className="bento-card"
              style={{
                padding: 22,
                display: "grid",
                gap: 12,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  fontSize: 14,
                  color: "rgba(255,255,255,0.55)",
                  textDecoration: "line-through",
                  textDecorationColor: "rgba(248,113,113,0.5)",
                  lineHeight: 1.45,
                }}
              >
                <X
                  className="w-4 h-4"
                  style={{ color: "#f87171", flexShrink: 0, marginTop: 2 }}
                />
                {p.bad}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  fontSize: 14,
                  color: "#fff",
                  lineHeight: 1.45,
                  fontWeight: 600,
                }}
              >
                <Check
                  className="w-4 h-4"
                  style={{ color: "var(--brand-gold)", flexShrink: 0, marginTop: 2 }}
                />
                {p.good}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Преимущества ──────────────────────────────────────────── */

const FEATURES = [
  {
    icon: Brain,
    title: "Учится твоему голосу",
    body:
      "Опиши себя один раз — ниша, обращение, любимые обороты, запрещённые слова — и AI пишет как ты, а не как нейросеть. Подключи свой Telegram-канал — мы проанализируем твои реальные посты.",
  },
  {
    icon: Wand2,
    title: "9 форматов из коробки",
    body:
      "Пост, Reels-сценарий, карусель с авто-дизайном, хуки, хэштеги, чек-лист, разбор мифа, кейс клиента, до/после. 8 тонов голоса × 10 рубрик = 80 разных подач одной темы.",
  },
  {
    icon: Calendar,
    title: "План на месяц одной кнопкой",
    body:
      "Скажи «нужен план на 4 недели, 3 поста в неделю под ЦА женщины 30-40» — AI расставит темы по дням, разнообразит форматы, чтобы не было выгорания у аудитории.",
  },
  {
    icon: TrendingUp,
    title: "Учится на твоих результатах",
    body:
      "Вноси просмотры и реакции опубликованных постов — система видит, что зашло, а что нет, и подмешивает это в следующие генерации. Чем дольше пользуешься — тем точнее.",
  },
  {
    icon: Layers,
    title: "Карусели с дизайном",
    body:
      "Не просто текст слайдов — готовый визуальный конструктор с шрифтами, темами, фоновыми фото. Экспорт каждого слайда в PNG или всех вместе в ZIP под Instagram 4:5 / 1:1 / 9:16.",
  },
  {
    icon: BarChart3,
    title: "Анализ конкурентов",
    body:
      "Подключи каналы конкурентов — мы разберём их виральные посты, найдём паттерны заголовков и форматов, выдадим конкретные рекомендации, как применить это в твоём контенте.",
  },
];

function Features() {
  return (
    <section style={{ padding: "80px 0" }}>
      <div className="container" style={{ maxWidth: 1120 }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>
            Что внутри
          </div>
          <h2
            style={{
              fontSize: "clamp(28px, 4vw, 42px)",
              letterSpacing: "-0.5px",
              lineHeight: 1.15,
              marginBottom: 12,
            }}
          >
            Не просто «ИИ-генератор».{" "}
            <span style={{ color: "var(--brand-gold)" }}>
              Студия контента целиком.
            </span>
          </h2>
          <p
            className="text-platinum"
            style={{ fontSize: 16, maxWidth: 600, margin: "0 auto" }}
          >
            Всё, что нужно блогеру или онлайн-тренеру, чтобы выходить
            каждый день без выгорания.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 16,
          }}
        >
          {FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <div
                key={i}
                className="bento-card"
                style={{
                  padding: 28,
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: "rgba(212,168,67,0.14)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--brand-gold)",
                  }}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <h3
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: "#fff",
                    margin: 0,
                    letterSpacing: "-0.2px",
                  }}
                >
                  {f.title}
                </h3>
                <p
                  className="text-platinum"
                  style={{ fontSize: 14, lineHeight: 1.6, margin: 0 }}
                >
                  {f.body}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─── Как это работает ──────────────────────────────────────── */

const STEPS = [
  {
    n: "01",
    title: "Настрой голос — 2 минуты",
    body:
      "Заполни короткую анкету: имя, ниша, ЦА, обращение на «ты» или «вы», любимые обороты, запрещённые слова. AI будет писать строго по этим правилам.",
  },
  {
    n: "02",
    title: "Введи тему и жми «Сгенерировать»",
    body:
      "Например, «3 ошибки в питании после 35». Выбери формат (пост, Reels, карусель) и тон. За 15-20 секунд получишь готовый текст.",
  },
  {
    n: "03",
    title: "Опубликуй и вноси метрики",
    body:
      "Сохрани в библиотеку, поставь в план, отправь в Telegram прямо из интерфейса. После публикации — внеси просмотры и реакции, чтобы AI учился.",
  },
];

function HowItWorks() {
  return (
    <section
      id="how-it-works"
      style={{
        padding: "80px 0",
        background:
          "linear-gradient(180deg, transparent, rgba(212,168,67,0.04) 50%, transparent)",
      }}
    >
      <div className="container" style={{ maxWidth: 980 }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>
            Три шага
          </div>
          <h2
            style={{
              fontSize: "clamp(28px, 4vw, 42px)",
              letterSpacing: "-0.5px",
              lineHeight: 1.15,
            }}
          >
            Запустить контент-машину{" "}
            <span style={{ color: "var(--brand-gold)" }}>сегодня</span>
          </h2>
        </div>

        <div style={{ display: "grid", gap: 18 }}>
          {STEPS.map((s, i) => (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr",
                gap: 28,
                alignItems: "start",
                padding: "28px 0",
                borderBottom:
                  i < STEPS.length - 1
                    ? "1px solid rgba(255,255,255,0.06)"
                    : "none",
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 48,
                  fontWeight: 700,
                  color: "var(--brand-gold)",
                  letterSpacing: "-2px",
                  lineHeight: 1,
                  opacity: 0.5,
                }}
              >
                {s.n}
              </div>
              <div>
                <h3
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    color: "#fff",
                    margin: "0 0 10px",
                    letterSpacing: "-0.3px",
                  }}
                >
                  {s.title}
                </h3>
                <p
                  className="text-platinum"
                  style={{ fontSize: 15, lineHeight: 1.6, margin: 0 }}
                >
                  {s.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Сравнение vs альтернативы ─────────────────────────────── */

function Comparison() {
  return (
    <section style={{ padding: "80px 0" }}>
      <div className="container" style={{ maxWidth: 1040 }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>
            Сравнение
          </div>
          <h2
            style={{
              fontSize: "clamp(26px, 4vw, 38px)",
              letterSpacing: "-0.5px",
              lineHeight: 1.15,
            }}
          >
            Почему не ChatGPT и не копирайтер?
          </h2>
        </div>

        <div
          className="bento-card"
          style={{ padding: 0, overflow: "hidden" }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 14,
            }}
          >
            <thead>
              <tr style={{ background: "var(--ink-2)" }}>
                <CompTh>Возможность</CompTh>
                <CompTh>ChatGPT</CompTh>
                <CompTh>Копирайтер</CompTh>
                <CompTh
                  style={{ color: "var(--brand-gold)", fontWeight: 800 }}
                >
                  Content Studio
                </CompTh>
              </tr>
            </thead>
            <tbody>
              <CompRow
                label="Пишет именно как ТЫ"
                a="❌ Шаблонно"
                b="✅ Если хорошо брифовать"
                c="✅ Из коробки"
              />
              <CompRow
                label="Виральные хуки и паттерны"
                a="🟡 Нужно учить промптами"
                b="🟡 Зависит от копирайтера"
                c="✅ Зашиты внутрь"
              />
              <CompRow
                label="Карусель с дизайном"
                a="❌ Только текст"
                b="❌ Отдельный дизайнер"
                c="✅ С шрифтами и темами"
              />
              <CompRow
                label="Контент-план календарём"
                a="❌"
                b="🟡 Долго и дорого"
                c="✅ За 30 секунд"
              />
              <CompRow
                label="Учится на твоих метриках"
                a="❌"
                b="🟡 Если разбирается"
                c="✅ Автоматически"
              />
              <CompRow
                label="Стоимость месяца"
                a="$20 + время"
                b="20 000 ₽+"
                c="от 590 ₽"
                last
              />
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function CompTh({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <th
      style={{
        textAlign: "left",
        padding: "14px 18px",
        fontSize: 11,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: 0.8,
        color: "var(--muted-foreground)",
        ...style,
      }}
    >
      {children}
    </th>
  );
}

function CompRow({
  label,
  a,
  b,
  c,
  last,
}: {
  label: string;
  a: string;
  b: string;
  c: string;
  last?: boolean;
}) {
  return (
    <tr style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
      <td
        style={{
          padding: "14px 18px",
          color: "#fff",
          fontWeight: last ? 700 : 500,
        }}
      >
        {label}
      </td>
      <td style={{ padding: "14px 18px", color: "var(--brand-platinum)" }}>
        {a}
      </td>
      <td style={{ padding: "14px 18px", color: "var(--brand-platinum)" }}>
        {b}
      </td>
      <td
        style={{
          padding: "14px 18px",
          color: "var(--brand-gold)",
          fontWeight: 600,
        }}
      >
        {c}
      </td>
    </tr>
  );
}

/* ─── Тарифы ──────────────────────────────────────────────── */

function Pricing() {
  const cta = useCtaTarget();
  return (
    <section
      id="pricing"
      style={{ padding: "80px 0", borderTop: "1px solid rgba(255,255,255,0.04)" }}
    >
      <div className="container" style={{ maxWidth: 1100 }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>
            Тарифы
          </div>
          <h2
            style={{
              fontSize: "clamp(28px, 4vw, 42px)",
              letterSpacing: "-0.5px",
              lineHeight: 1.15,
            }}
          >
            Дешевле{" "}
            <span style={{ color: "var(--brand-gold)" }}>любого фрилансера</span>
          </h2>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 14,
          }}
        >
          {PLANS.map((p) => (
            <div
              key={p.id}
              className="bento-card"
              style={{
                padding: 24,
                position: "relative",
                border: p.highlight
                  ? "1.5px solid var(--brand-gold)"
                  : "1px solid rgba(255,255,255,0.06)",
                background: p.highlight
                  ? "linear-gradient(180deg, rgba(212,168,67,0.06), transparent 40%), var(--ink-2)"
                  : "var(--ink-2)",
                boxShadow: p.highlight
                  ? "0 8px 32px rgba(212,168,67,0.16)"
                  : "none",
              }}
            >
              {p.badge && (
                <div
                  style={{
                    position: "absolute",
                    top: -10,
                    left: "50%",
                    transform: "translateX(-50%)",
                    padding: "4px 12px",
                    background: "var(--brand-gold)",
                    color: "var(--ink)",
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: 0.8,
                    textTransform: "uppercase",
                    borderRadius: 9999,
                  }}
                >
                  {p.badge}
                </div>
              )}
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: "#fff",
                  marginBottom: 4,
                }}
              >
                {p.name}
              </div>
              <div
                className="text-platinum"
                style={{ fontSize: 12, marginBottom: 16 }}
              >
                {p.tagline}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 6,
                  marginBottom: 18,
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 32,
                    fontWeight: 700,
                    color: p.highlight ? "var(--brand-gold)" : "#fff",
                  }}
                >
                  {p.priceRub?.toLocaleString("ru-RU")}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    color: "var(--muted-foreground)",
                  }}
                >
                  ₽/мес
                </span>
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--brand-platinum)",
                  lineHeight: 1.6,
                  marginBottom: 18,
                }}
              >
                {p.features.slice(0, 3).join(" · ")}
              </div>
              <Link href={cta.href}>
                <span
                  className="btn-gold"
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    padding: "10px 18px",
                    fontSize: 13,
                    cursor: "pointer",
                    background: p.highlight ? undefined : "var(--ink-3)",
                    color: p.highlight ? undefined : "#fff",
                  }}
                >
                  {cta.secondary}
                </span>
              </Link>
            </div>
          ))}
        </div>

        <p
          className="text-platinum"
          style={{
            fontSize: 13,
            textAlign: "center",
            marginTop: 28,
          }}
        >
          Все тарифы начинаются с{" "}
          <span style={{ color: "var(--brand-gold)", fontWeight: 600 }}>
            3-дневного бесплатного триала
          </span>
          . Без карты. Можно отменить в любой момент.
        </p>
      </div>
    </section>
  );
}

/* ─── FAQ ─────────────────────────────────────────────────── */

const FAQS = [
  {
    q: "Можно ли отличить тексты от человеческих?",
    a: "Мы зашили антиAI-чек-лист: запрет канцеляризмов, шаблонных оборотов, безличных конструкций. Плюс ты настраиваешь свои любимые фразы и запрещённые слова. Тексты получаются живые — не как у нейросети.",
  },
  {
    q: "Что если я не фитнес-блогер?",
    a: "Сейчас сервис заточен под фитнес и онлайн-тренеров — там у нас лучше всего работают зашитые виральные паттерны. Скоро откроем нутрициологию, psychology и beauty. Если ты из смежной ниши — попробуй триал, многое подойдёт уже сейчас.",
  },
  {
    q: "Безопасно ли подключать Telegram-канал?",
    a: "Мы читаем только публичные посты через t.me/s/<канал> — без логина в твой аккаунт и без OAuth. Ничего опубликовать в твоём канале без твоего ведома мы не можем.",
  },
  {
    q: "Что происходит с моими данными?",
    a: "Контент, который ты создаёшь, принадлежит тебе. Мы не используем его для обучения сторонних AI-моделей и не передаём третьим лицам. Запросы к Gemini уходят без идентифицирующих полей.",
  },
  {
    q: "Что если хочу отменить подписку?",
    a: "Отмена в один клик из настроек — никаких звонков и удержания. Платёж не возобновляется на следующем месяце. До конца оплаченного периода сервис работает.",
  },
  {
    q: "Кто стоит за сервисом?",
    a: "Сервис делает небольшая независимая команда — без VC-инвесторов, без давления роста. Это даёт нам свободу делать продукт, который мы сами хотели бы использовать.",
  },
];

function FAQ() {
  return (
    <section style={{ padding: "80px 0" }}>
      <div className="container" style={{ maxWidth: 780 }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>
            Частые вопросы
          </div>
          <h2
            style={{
              fontSize: "clamp(26px, 4vw, 36px)",
              letterSpacing: "-0.5px",
              lineHeight: 1.15,
            }}
          >
            Что обычно{" "}
            <span style={{ color: "var(--brand-gold)" }}>спрашивают</span>
          </h2>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          {FAQS.map((f, i) => (
            <details
              key={i}
              className="bento-card"
              style={{ padding: 0, overflow: "hidden" }}
            >
              <summary
                style={{
                  padding: "20px 22px",
                  cursor: "pointer",
                  fontSize: 15,
                  fontWeight: 600,
                  color: "#fff",
                  listStyle: "none",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <span>{f.q}</span>
                <span
                  style={{
                    color: "var(--brand-gold)",
                    fontSize: 20,
                    lineHeight: 1,
                    transition: "transform 0.2s",
                  }}
                >
                  +
                </span>
              </summary>
              <div
                className="text-platinum"
                style={{
                  padding: "0 22px 20px",
                  fontSize: 14,
                  lineHeight: 1.6,
                }}
              >
                {f.a}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Final CTA ──────────────────────────────────────────── */

function FinalCTA() {
  const cta = useCtaTarget();
  return (
    <section
      style={{
        padding: "96px 0",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(closest-side at 50% 50%, rgba(212,168,67,0.22), transparent 60%)",
          filter: "blur(40px)",
          pointerEvents: "none",
        }}
      />
      <div
        className="container"
        style={{ maxWidth: 720, textAlign: "center", position: "relative" }}
      >
        <h2
          style={{
            fontSize: "clamp(30px, 5vw, 48px)",
            letterSpacing: "-0.8px",
            lineHeight: 1.1,
            marginBottom: 18,
          }}
        >
          Начни писать{" "}
          <span style={{ color: "var(--brand-gold)" }}>сегодня же</span>
        </h2>
        <p
          className="text-platinum"
          style={{
            fontSize: 17,
            lineHeight: 1.5,
            marginBottom: 32,
            maxWidth: 540,
            margin: "0 auto 32px",
          }}
        >
          3 дня бесплатно, 3 000 токенов в подарок — этого хватит на 6-10
          полноценных публикаций. Без карты. Без обязательств.
        </p>
        <Link href={cta.href}>
          <span
            className="btn-gold gold-glow"
            style={{
              padding: "18px 38px",
              fontSize: 17,
              cursor: "pointer",
            }}
          >
            {cta.primary}
            <ArrowRight className="w-5 h-5" />
          </span>
        </Link>
      </div>
    </section>
  );
}

/* ─── Footer ──────────────────────────────────────────────── */

function Footer() {
  return (
    <footer
      style={{
        padding: "32px 0",
        borderTop: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div
        className="container"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 14,
          fontSize: 12,
          color: "var(--muted-foreground)",
        }}
      >
        <span>© Content Studio</span>
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
          <Link href="/legal/terms">
            <span style={{ cursor: "pointer" }}>Пользовательское соглашение</span>
          </Link>
          <Link href="/legal/privacy">
            <span style={{ cursor: "pointer" }}>Конфиденциальность</span>
          </Link>
          <Link href="/legal/personal-data">
            <span style={{ cursor: "pointer" }}>Персональные данные</span>
          </Link>
        </div>
      </div>
    </footer>
  );
}
