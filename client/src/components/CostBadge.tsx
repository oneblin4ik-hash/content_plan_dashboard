import { Zap, AlertTriangle } from "lucide-react";
import { Link } from "wouter";
import { LLM_ACTIONS, type LlmActionId } from "@/lib/pricing";
import { useAuth } from "@/contexts/AuthContext";

/* ============================================================
   Бейдж стоимости LLM-операции. Используется рядом с кнопками
   генерации: «Сгенерировать ~120 ⚡».

   Если у юзера осталось мало токенов (< 2× стоимости) — бейдж
   подсвечивается красным и показывает warning. Если уже не
   хватает — оставляет ссылку на /pricing.

   variant:
   - "inline" — компактный, для размещения рядом с лейблом кнопки
   - "block" — отдельная плашка с подсказкой (для крупных кнопок)

   Админу бейдж не показывается — у него безлимит и цифры путают.
   ============================================================ */

export function CostBadge({
  action,
  variant = "inline",
}: {
  action: LlmActionId;
  variant?: "inline" | "block";
}) {
  const { user } = useAuth();
  if (user?.role === "admin") return null;

  const a = LLM_ACTIONS[action];
  const balance = user?.tokensRemaining ?? null;
  const insufficient = balance != null && balance < a.cost;
  const low = balance != null && !insufficient && balance < a.cost * 2;

  if (variant === "block") {
    return (
      <div
        title={a.desc}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 12px",
          borderRadius: 9999,
          background: insufficient
            ? "rgba(248,113,113,0.10)"
            : low
              ? "rgba(212,168,67,0.10)"
              : "rgba(255,255,255,0.04)",
          border: `1px solid ${
            insufficient
              ? "rgba(248,113,113,0.35)"
              : low
                ? "rgba(212,168,67,0.35)"
                : "rgba(255,255,255,0.08)"
          }`,
          fontSize: 12,
          color: insufficient
            ? "#f87171"
            : low
              ? "var(--brand-gold)"
              : "var(--brand-platinum)",
          whiteSpace: "nowrap",
        }}
      >
        {insufficient ? (
          <AlertTriangle className="w-3.5 h-3.5" />
        ) : (
          <Zap className="w-3.5 h-3.5" />
        )}
        <span style={{ fontWeight: 700 }}>{a.cost}</span>
        <span style={{ opacity: 0.7 }}>токенов</span>
        {insufficient && (
          <Link href="/pricing">
            <span
              style={{
                marginLeft: 4,
                textDecoration: "underline",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              пополнить
            </span>
          </Link>
        )}
      </div>
    );
  }

  /* inline: маленький бейдж, который встаёт рядом с лейблом кнопки. */
  return (
    <span
      title={`${a.desc} · списывается ~${a.cost} токенов`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        padding: "2px 7px",
        borderRadius: 9999,
        marginLeft: 6,
        background: insufficient
          ? "rgba(248,113,113,0.18)"
          : low
            ? "rgba(212,168,67,0.18)"
            : "rgba(0,0,0,0.18)",
        color: insufficient
          ? "#fecaca"
          : low
            ? "var(--brand-gold)"
            : "rgba(255,255,255,0.85)",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 0.3,
        whiteSpace: "nowrap",
        verticalAlign: "middle",
      }}
    >
      <Zap className="w-2.5 h-2.5" />
      {a.cost}
    </span>
  );
}
