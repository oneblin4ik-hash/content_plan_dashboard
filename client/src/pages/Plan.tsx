import { useState } from "react";
import { useLocation } from "wouter";
import { Calendar as CalendarIcon, Library as LibraryIcon, Cloud, CloudOff } from "lucide-react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import Calendar from "./Calendar";
import Library from "./Library";

/* /plan — объединённый раздел «Календарь + Архив».
   Стартовый таб определяется маршрутом, через который зашли:
   /calendar → «Календарь», /library → «Архив». Внутри хедер общий,
   дочерние компоненты подгружаются с embedded=true. */
type Tab = "calendar" | "library";

export default function Plan() {
  const [location] = useLocation();
  const { workspaceKey, cloudEnabled } = useWorkspace();
  const initial: Tab =
    location.startsWith("/library") || location.startsWith("/archive")
      ? "library"
      : "calendar";
  const [tab, setTab] = useState<Tab>(initial);

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <section style={{ padding: "56px 0 16px" }}>
        <div className="container">
          <div className="flex items-center gap-3" style={{ marginBottom: 14 }}>
            <span className="eyebrow">Контент</span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "3px 10px",
                borderRadius: 9999,
                background: cloudEnabled
                  ? "rgba(212,168,67,0.12)"
                  : "rgba(255,255,255,0.06)",
                color: cloudEnabled
                  ? "var(--brand-gold)"
                  : "var(--muted-foreground)",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 1.5,
                textTransform: "uppercase",
              }}
            >
              {cloudEnabled ? (
                <>
                  <Cloud className="w-3 h-3" /> Cloud sync · {workspaceKey}
                </>
              ) : (
                <>
                  <CloudOff className="w-3 h-3" /> Локально
                </>
              )}
            </span>
          </div>
          <h1>
            {tab === "calendar" ? (
              <>
                Когда что{" "}
                <span style={{ color: "var(--brand-gold)" }}>выходит.</span>
              </>
            ) : (
              <>
                Сохранённый{" "}
                <span style={{ color: "var(--brand-gold)" }}>контент.</span>
              </>
            )}
          </h1>
          <p
            className="text-platinum"
            style={{
              maxWidth: 620,
              fontSize: 18,
              lineHeight: 1.5,
              marginTop: 18,
            }}
          >
            {tab === "calendar"
              ? "Расписание публикаций с drag-and-drop и авто-планом на месяц."
              : "Архив всех сгенерированных постов, reels и хуков — копируй или ставь в план."}
          </p>

          <div
            style={{
              marginTop: 28,
              display: "inline-flex",
              gap: 4,
              padding: 4,
              background: "var(--ink-2)",
              borderRadius: 9999,
            }}
          >
            <TabBtn
              active={tab === "calendar"}
              onClick={() => setTab("calendar")}
              icon={<CalendarIcon className="w-4 h-4" />}
              label="Календарь"
            />
            <TabBtn
              active={tab === "library"}
              onClick={() => setTab("library")}
              icon={<LibraryIcon className="w-4 h-4" />}
              label="Архив"
            />
          </div>
        </div>
      </section>

      {tab === "calendar" ? <Calendar embedded /> : <Library embedded />}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "8px 16px",
        borderRadius: 9999,
        border: 0,
        fontFamily: "var(--font-body)",
        fontSize: 13,
        fontWeight: 600,
        background: active ? "var(--brand-gold)" : "transparent",
        color: active ? "var(--ink)" : "var(--brand-platinum)",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      {icon}
      {label}
    </button>
  );
}
