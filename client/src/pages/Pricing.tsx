import { Check, Sparkles, Mail, Star } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { PLANS, type Plan } from "@/lib/plans";

/* ============================================================
   /pricing — три тарифа (Старт / Профи / Бренд). Источник истины —
   client/src/lib/plans.ts (utверждено юзером).

   VIP-якорь: «Бренд» 9 900 ₽ в 4× дороже флагмана «Профи» 2 490 ₽ —
   на этом контрасте флагман выглядит «лучшим выбором», подсвечен
   золотым бордером и badge'м. Это классический price anchoring.

   Платёжка пока не подключена — все CTA ведут на mailto. После
   интеграции ЮKassa здесь будет ссылка на checkout. ============================================================ */
export default function Pricing() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <section style={{ padding: "56px 0 16px" }}>
        <div className="container" style={{ maxWidth: 1100, textAlign: "center" }}>
          <div className="eyebrow" style={{ marginBottom: 14 }}>
            Тарифы
          </div>
          <h1
            style={{
              fontSize: 44,
              letterSpacing: "-0.8px",
              lineHeight: 1.1,
              marginBottom: 14,
            }}
          >
            Выбери,{" "}
            <span style={{ color: "var(--brand-gold)" }}>как масштабироваться</span>
          </h1>
          <p
            className="text-platinum"
            style={{ fontSize: 17, lineHeight: 1.5, maxWidth: 620, margin: "0 auto" }}
          >
            Все тарифы — месячная подписка. Без долгих контрактов: можно
            отменить или сменить план в любой момент.
          </p>

          {user && user.plan === "trial" && (
            <div
              style={{
                display: "inline-block",
                marginTop: 22,
                padding: "8px 16px",
                background: "rgba(212,168,67,0.10)",
                border: "1px solid rgba(212,168,67,0.28)",
                borderRadius: 9999,
                fontSize: 13,
                color: "var(--brand-platinum)",
              }}
            >
              Сейчас ты на пробном плане ·{" "}
              <span style={{ color: "var(--brand-gold)", fontWeight: 700 }}>
                {user.tokensRemaining.toLocaleString("ru-RU")}
              </span>{" "}
              токенов осталось
            </div>
          )}
        </div>
      </section>

      <section style={{ padding: "32px 0 80px" }}>
        <div className="container" style={{ maxWidth: 1100 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 18,
              alignItems: "stretch",
            }}
          >
            {PLANS.map((p) => (
              <PlanCard key={p.id} plan={p} userPlan={user?.plan} />
            ))}
          </div>

          <p
            className="text-platinum"
            style={{
              fontSize: 12,
              textAlign: "center",
              marginTop: 32,
              lineHeight: 1.6,
            }}
          >
            Цены указаны без НДС. Оплата — банковская карта (ЮKassa).
            Для оплаты юр.лицом или счёта на год —{" "}
            <a
              href="mailto:hello@content-studio.app"
              style={{ color: "var(--brand-gold)" }}
            >
              напиши нам
            </a>
            .
          </p>
        </div>
      </section>
    </div>
  );
}

function PlanCard({
  plan,
  userPlan,
}: {
  plan: Plan;
  userPlan: string | undefined;
}) {
  const isCurrent = userPlan === plan.id;
  return (
    <div
      className="bento-card"
      style={{
        padding: 26,
        display: "flex",
        flexDirection: "column",
        position: "relative",
        /* Подсветка флагмана: золотой бордер и лёгкая золотая
           подложка. Высота карточки немного больше за счёт badge. */
        border: plan.highlight
          ? "1.5px solid var(--brand-gold)"
          : "1px solid rgba(255,255,255,0.06)",
        background: plan.highlight
          ? "linear-gradient(180deg, rgba(212,168,67,0.05), rgba(212,168,67,0.0) 40%), var(--ink-2)"
          : "var(--ink-2)",
        boxShadow: plan.highlight
          ? "0 12px 48px rgba(212,168,67,0.18)"
          : "none",
      }}
    >
      {plan.badge && (
        <div
          style={{
            position: "absolute",
            top: -10,
            left: "50%",
            transform: "translateX(-50%)",
            padding: "5px 14px",
            background: "var(--brand-gold)",
            color: "var(--ink)",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: 0.8,
            textTransform: "uppercase",
            borderRadius: 9999,
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <Star className="w-3 h-3" fill="currentColor" /> {plan.badge}
        </div>
      )}

      <div style={{ marginBottom: 14, paddingTop: plan.badge ? 8 : 0 }}>
        <div
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: "#fff",
            letterSpacing: "-0.3px",
          }}
        >
          {plan.name}
        </div>
        <div
          className="text-platinum"
          style={{ fontSize: 13, lineHeight: 1.4, marginTop: 4 }}
        >
          {plan.tagline}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 8,
          margin: "10px 0 22px",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 40,
            fontWeight: 700,
            color: plan.highlight ? "var(--brand-gold)" : "#fff",
            letterSpacing: "-1.5px",
            lineHeight: 1,
          }}
        >
          {plan.priceRub != null
            ? plan.priceRub.toLocaleString("ru-RU")
            : "—"}
        </span>
        <span
          style={{
            fontSize: 14,
            color: "var(--muted-foreground)",
          }}
        >
          {plan.pricePeriod}
        </span>
      </div>

      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          display: "flex",
          flexDirection: "column",
          gap: 9,
          flex: 1,
        }}
      >
        {plan.features.map((f, i) => (
          <li
            key={i}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              fontSize: 13,
              lineHeight: 1.5,
              color: i === 0 ? "#fff" : "var(--brand-platinum)",
              /* первая фича выделена жирнее — это «головной» benefit
                 каждого тарифа (объём токенов и т.п.). */
              fontWeight: i === 0 ? 600 : 400,
            }}
          >
            <Check
              className="w-4 h-4"
              style={{
                color: plan.highlight
                  ? "var(--brand-gold)"
                  : "rgba(255,255,255,0.5)",
                flexShrink: 0,
                marginTop: 2,
              }}
            />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <div style={{ marginTop: 26 }}>
        {isCurrent ? (
          <div
            style={{
              padding: "12px 22px",
              background: "var(--ink-3)",
              color: "var(--muted-foreground)",
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 9999,
              textAlign: "center",
            }}
          >
            Твой текущий план
          </div>
        ) : (
          <a
            href={plan.cta.href}
            className={plan.highlight ? "btn-gold gold-glow" : "btn-gold"}
            style={{
              display: "flex",
              justifyContent: "center",
              padding: "12px 22px",
              fontSize: 14,
              background: plan.highlight ? undefined : "var(--ink-3)",
              color: plan.highlight ? undefined : "#fff",
            }}
          >
            {plan.highlight ? (
              <Sparkles className="w-4 h-4" />
            ) : (
              <Mail className="w-4 h-4" />
            )}
            {plan.cta.label}
          </a>
        )}
      </div>
    </div>
  );
}
