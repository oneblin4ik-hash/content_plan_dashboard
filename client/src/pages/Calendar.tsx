import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ChevronLeft, ChevronRight, Plus, Trash2, Sparkles } from "lucide-react";
import { allContentTopics } from "@/lib/contentData";

type ScheduledItem = {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  format: string;
  topicId?: number;
};

const STORE = "serbolin.studio.calendar.v1";
const load = (): ScheduledItem[] => {
  try {
    return JSON.parse(localStorage.getItem(STORE) || "[]");
  } catch {
    return [];
  }
};
const save = (items: ScheduledItem[]) =>
  localStorage.setItem(STORE, JSON.stringify(items));

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const MONTHS = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];

const fmtDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

export default function Calendar() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [items, setItems] = useState<ScheduledItem[]>([]);
  const [selected, setSelected] = useState<string>(fmtDate(today));
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    setItems(load());
  }, []);

  const monthGrid = useMemo(() => {
    const first = new Date(year, month, 1);
    const startOffset = (first.getDay() + 6) % 7; // monday-first
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [year, month]);

  const itemsForDate = (dateStr: string) => items.filter((i) => i.date === dateStr);

  const removeItem = (id: string) => {
    const next = items.filter((i) => i.id !== id);
    setItems(next);
    save(next);
  };

  const scheduleTopic = (topicId: number) => {
    const topic = allContentTopics.find((t) => t.id === topicId);
    if (!topic) return;
    const next: ScheduledItem[] = [
      ...items,
      {
        id: crypto.randomUUID(),
        date: selected,
        title: topic.title,
        format: topic.format,
        topicId,
      },
    ];
    setItems(next);
    save(next);
    setPicking(false);
  };

  const prevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear(year - 1);
    } else setMonth(month - 1);
  };
  const nextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear(year + 1);
    } else setMonth(month + 1);
  };

  const scheduledTopicIds = new Set(items.map((i) => i.topicId).filter(Boolean));
  const unscheduledTopics = allContentTopics.filter((t) => !scheduledTopicIds.has(t.id));

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <section style={{ padding: "56px 0 16px" }}>
        <div className="container">
          <div className="eyebrow" style={{ marginBottom: 14 }}>
            Календарь публикаций
          </div>
          <h1>
            Когда что{" "}
            <span style={{ color: "var(--brand-gold)" }}>выходит.</span>
          </h1>
          <p
            className="text-platinum"
            style={{ maxWidth: 620, fontSize: 18, lineHeight: 1.5, marginTop: 18 }}
          >
            Двигай темы из плана в конкретные дни. Локальное расписание — без
            аккаунта и без серверов.
          </p>
        </div>
      </section>

      <section style={{ padding: "24px 0 96px" }}>
        <div
          className="container grid gap-6"
          style={{ gridTemplateColumns: "minmax(0, 2fr) minmax(280px, 1fr)" }}
        >
          <div className="bento-card" style={{ padding: 24 }}>
            <div
              className="flex items-center justify-between"
              style={{ marginBottom: 18 }}
            >
              <h3 style={{ fontSize: 22 }}>
                {MONTHS[month]} {year}
              </h3>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={prevMonth}
                  style={{
                    background: "var(--ink-2)",
                    border: 0,
                    color: "#fff",
                    width: 36,
                    height: 36,
                    borderRadius: 9999,
                    cursor: "pointer",
                  }}
                >
                  <ChevronLeft className="w-4 h-4" style={{ margin: "0 auto" }} />
                </button>
                <button
                  onClick={nextMonth}
                  style={{
                    background: "var(--ink-2)",
                    border: 0,
                    color: "#fff",
                    width: 36,
                    height: 36,
                    borderRadius: 9999,
                    cursor: "pointer",
                  }}
                >
                  <ChevronRight className="w-4 h-4" style={{ margin: "0 auto" }} />
                </button>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                gap: 4,
                marginBottom: 8,
              }}
            >
              {WEEKDAYS.map((d) => (
                <div
                  key={d}
                  className="eyebrow"
                  style={{
                    textAlign: "center",
                    padding: 8,
                    color: "var(--muted-foreground)",
                  }}
                >
                  {d}
                </div>
              ))}
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                gap: 4,
              }}
            >
              {monthGrid.map((d, i) => {
                if (!d) return <div key={i} />;
                const dateStr = fmtDate(d);
                const cellItems = itemsForDate(dateStr);
                const isToday = dateStr === fmtDate(today);
                const isSelected = dateStr === selected;
                return (
                  <button
                    key={i}
                    onClick={() => setSelected(dateStr)}
                    style={{
                      background: isSelected
                        ? "var(--brand-gold)"
                        : "var(--ink-3)",
                      color: isSelected ? "var(--ink)" : "#fff",
                      border: isToday
                        ? "1px solid var(--brand-gold)"
                        : "1px solid transparent",
                      borderRadius: 14,
                      padding: 10,
                      minHeight: 80,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      gap: 4,
                      cursor: "pointer",
                      transition: "background .2s",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "var(--font-display)",
                        fontWeight: 700,
                        fontSize: 16,
                      }}
                    >
                      {d.getDate()}
                    </span>
                    {cellItems.slice(0, 2).map((it) => (
                      <span
                        key={it.id}
                        style={{
                          fontSize: 10,
                          lineHeight: 1.3,
                          background: isSelected
                            ? "rgba(34,34,34,0.18)"
                            : "rgba(212,168,67,0.18)",
                          color: isSelected ? "var(--ink)" : "var(--brand-gold)",
                          borderRadius: 6,
                          padding: "2px 5px",
                          width: "100%",
                          textAlign: "left",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          fontWeight: 600,
                        }}
                      >
                        {it.title}
                      </span>
                    ))}
                    {cellItems.length > 2 && (
                      <span
                        style={{
                          fontSize: 10,
                          color: isSelected
                            ? "rgba(34,34,34,0.6)"
                            : "var(--muted-foreground)",
                        }}
                      >
                        +{cellItems.length - 2} ещё
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* SIDEBAR */}
          <div className="bento-card" style={{ padding: 24 }}>
            <div className="eyebrow" style={{ marginBottom: 10 }}>
              {selected}
            </div>
            <h3 style={{ fontSize: 22, marginBottom: 16 }}>
              {itemsForDate(selected).length === 0
                ? "Пока ничего"
                : `${itemsForDate(selected).length} публ.`}
            </h3>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                marginBottom: 18,
              }}
            >
              {itemsForDate(selected).map((it) => (
                <div
                  key={it.id}
                  style={{
                    padding: 12,
                    background: "var(--ink-3)",
                    borderRadius: 14,
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-start",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        marginBottom: 4,
                        lineHeight: 1.3,
                      }}
                    >
                      {it.title}
                    </div>
                    <div
                      className="eyebrow"
                      style={{ color: "var(--brand-gold)" }}
                    >
                      {it.format}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {it.topicId && (
                      <Link
                        href={`/generator?title=${encodeURIComponent(it.title)}`}
                      >
                        <span
                          title="Открыть в студии"
                          style={{
                            background: "var(--brand-gold)",
                            color: "var(--ink)",
                            border: 0,
                            borderRadius: 9999,
                            padding: 6,
                            display: "inline-flex",
                            cursor: "pointer",
                          }}
                        >
                          <Sparkles className="w-3 h-3" />
                        </span>
                      </Link>
                    )}
                    <button
                      onClick={() => removeItem(it.id)}
                      style={{
                        background: "transparent",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 9999,
                        padding: 6,
                        color: "var(--muted-foreground)",
                        cursor: "pointer",
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setPicking((v) => !v)}
              className="btn-gold"
              style={{ width: "100%", justifyContent: "center" }}
            >
              <Plus className="w-4 h-4" />
              {picking ? "Закрыть" : "Добавить тему"}
            </button>

            {picking && (
              <div
                className="scroll-thin"
                style={{
                  marginTop: 14,
                  maxHeight: 360,
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                {unscheduledTopics.length === 0 ? (
                  <p
                    style={{
                      fontSize: 13,
                      color: "var(--muted-foreground)",
                      textAlign: "center",
                      padding: 16,
                    }}
                  >
                    Все темы уже в расписании.
                  </p>
                ) : (
                  unscheduledTopics.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => scheduleTopic(t.id)}
                      style={{
                        background: "var(--ink-3)",
                        border: 0,
                        textAlign: "left",
                        padding: "10px 12px",
                        borderRadius: 12,
                        color: "#fff",
                        cursor: "pointer",
                        fontFamily: "var(--font-body)",
                        fontSize: 12,
                        lineHeight: 1.3,
                      }}
                    >
                      {t.title}
                      <div
                        className="eyebrow"
                        style={{
                          color: "var(--brand-gold)",
                          marginTop: 4,
                          fontSize: 10,
                        }}
                      >
                        {t.format}
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
