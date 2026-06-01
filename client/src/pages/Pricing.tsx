import { useAuth } from "@/contexts/AuthContext";
import { Sparkles, Mail } from "lucide-react";

/* Заглушка раздела «Тарифы». Платёжка появится в отдельной итерации.
   Сейчас показываем только текущий статус юзера и предложение
   связаться (получим первых пейн-юзеров вручную). */
export default function Pricing() {
  const { user } = useAuth();
  const trialDaysLeft = user
    ? Math.max(0, Math.ceil((user.trialEndsAt - Date.now()) / (24 * 60 * 60 * 1000)))
    : 0;
  const trialActive = user?.plan === "trial" && trialDaysLeft > 0;

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <section style={{ padding: "56px 0 96px" }}>
        <div className="container" style={{ maxWidth: 760, textAlign: "center" }}>
          <div className="eyebrow" style={{ marginBottom: 14 }}>
            Тарифы
          </div>
          <h1
            style={{
              fontSize: 44,
              letterSpacing: "-0.8px",
              lineHeight: 1.1,
              marginBottom: 18,
            }}
          >
            Платные планы{" "}
            <span style={{ color: "var(--brand-gold)" }}>скоро откроются</span>.
          </h1>
          <p
            className="text-platinum"
            style={{ fontSize: 17, lineHeight: 1.5, marginBottom: 32 }}
          >
            Мы сейчас докручиваем тарифы и интеграцию оплаты. Если хочешь
            подписаться раньше всех — напиши на почту, добавим тебя в
            список первых клиентов на ручной активации (без переплат).
          </p>

          {user && (
            <div
              className="bento-card"
              style={{
                padding: 24,
                marginBottom: 24,
                textAlign: "left",
                display: "grid",
                gap: 12,
              }}
            >
              <Stat
                label="Текущий план"
                value={user.plan === "trial" ? "Пробный (триал)" : user.plan}
              />
              <Stat
                label="Триал заканчивается"
                value={
                  trialActive
                    ? `через ${trialDaysLeft} ${ruDays(trialDaysLeft)}`
                    : "истёк"
                }
              />
              <Stat
                label="Осталось токенов"
                value={user.tokensRemaining.toLocaleString("ru-RU")}
              />
            </div>
          )}

          <a
            href="mailto:hello@content-studio.app?subject=Хочу%20тариф%20Content%20Studio"
            className="btn-gold gold-glow"
            style={{
              display: "inline-flex",
              padding: "14px 28px",
              fontSize: 15,
            }}
          >
            <Mail className="w-4 h-4" />
            Написать про подписку
          </a>

          <div
            style={{
              marginTop: 36,
              padding: 20,
              background: "rgba(212,168,67,0.06)",
              border: "1px solid rgba(212,168,67,0.2)",
              borderRadius: 14,
              textAlign: "left",
            }}
          >
            <div
              className="eyebrow"
              style={{
                marginBottom: 8,
                color: "var(--brand-gold)",
              }}
            >
              <Sparkles
                className="w-3 h-3"
                style={{ display: "inline", marginRight: 6 }}
              />
              Что войдёт в платный план
            </div>
            <ul
              className="text-platinum"
              style={{
                fontSize: 14,
                lineHeight: 1.7,
                margin: 0,
                paddingLeft: 18,
              }}
            >
              <li>
                Безлимитная (или с большим лимитом) генерация постов,
                Reels-сценариев, каруселей, хуков, хэштегов.
              </li>
              <li>Анализ трендов и конкурентов без ограничений.</li>
              <li>Автоподстройка под голос вашего канала.</li>
              <li>Расписание публикаций с напоминаниями.</li>
              <li>Приоритетная поддержка.</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}

function ruDays(n: number): string {
  const m = n % 10;
  const m100 = n % 100;
  if (m === 1 && m100 !== 11) return "день";
  if ([2, 3, 4].includes(m) && ![12, 13, 14].includes(m100)) return "дня";
  return "дней";
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "8px 14px",
        background: "var(--ink-2)",
        borderRadius: 10,
      }}
    >
      <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
        {label}
      </span>
      <span style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>
        {value}
      </span>
    </div>
  );
}
