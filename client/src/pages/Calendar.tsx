import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Sparkles,
  Cloud,
  CloudOff,
  Wand2,
  Loader2,
} from "lucide-react";
import { allContentTopics } from "@/lib/contentData";
import { trpc } from "@/lib/trpc";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { localCalendar, type ScheduledItem } from "@/lib/syncStorage";
import { CostBadge } from "@/components/CostBadge";

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const MONTHS = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];

const fmtDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/* Когда вызывается с embedded=true (например из /plan через табы),
   собственный hero-хедер не рендерится — у родителя свой. Корневая
   обёртка тоже схлопывается до фрагмента, чтобы не двоились
   min-h-screen + фоны. */
export default function Calendar({ embedded = false }: { embedded?: boolean }) {
  const { workspaceKey, cloudEnabled } = useWorkspace();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [localItems, setLocalItems] = useState<ScheduledItem[]>([]);
  const [selected, setSelected] = useState<string>(fmtDate(today));
  const [picking, setPicking] = useState(false);
  /* Модалка «своя публикация»: произвольный title + выбор формата
     (Telegram-пост / Reels / Stories TG / Stories IG / Карусель и т.п.). */
  const [customOpen, setCustomOpen] = useState(false);
  const [customTitle, setCustomTitle] = useState("");
  const [customFormat, setCustomFormat] = useState<string>("Пост · Telegram");

  const cloudList = trpc.sync.scheduled.list.useQuery(undefined,
    { enabled: cloudEnabled && workspaceKey.length > 0 }
  );
  const cloudSave = trpc.sync.scheduled.save.useMutation({
    onSuccess: () => cloudList.refetch(),
  });
  const cloudDelete = trpc.sync.scheduled.delete.useMutation({
    onSuccess: () => cloudList.refetch(),
  });
  const cloudUpdate = trpc.sync.scheduled.update.useMutation({
    onSuccess: () => cloudList.refetch(),
  });
  const planMutation = trpc.content.generateMonthPlan.useMutation();

  /* DnD state — храним id перетаскиваемой карточки, чтобы highlight'ить
     дроп-зоны. Используем нативный HTML5 DnD, без библиотек. */
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

  /* Параметры авто-плана. */
  const [planOpen, setPlanOpen] = useState(false);
  const [planForm, setPlanForm] = useState({
    weeksCount: 4,
    postsPerWeek: 3,
    segment: "mixed" as "women_25_45" | "men_30_45" | "ambitious_pro" | "mixed",
    platform: "telegram" as "telegram" | "instagram",
    startDate: fmtDate(today),
  });

  useEffect(() => {
    if (!cloudEnabled) setLocalItems(localCalendar.load());
  }, [cloudEnabled]);

  const items: ScheduledItem[] = useMemo(() => {
    if (cloudEnabled) {
      return (cloudList.data ?? []).map((r) => ({
        id: r.id,
        date: r.date,
        title: r.title,
        format: r.format,
        topicId: r.topicId,
      }));
    }
    return localItems;
  }, [cloudEnabled, cloudList.data, localItems]);

  const monthGrid = useMemo(() => {
    const first = new Date(year, month, 1);
    const startOffset = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [year, month]);

  const itemsForDate = (dateStr: string) => items.filter((i) => i.date === dateStr);

  const removeItem = (id: string) => {
    if (cloudEnabled) cloudDelete.mutate({ id });
    else {
      localCalendar.remove(id);
      setLocalItems(localCalendar.load());
    }
  };

  const moveItem = (id: string, newDate: string) => {
    const it = items.find((x) => x.id === id);
    if (!it || it.date === newDate) return;
    if (cloudEnabled) {
      cloudUpdate.mutate({ id, date: newDate });
    } else {
      localCalendar.update(id, { date: newDate });
      setLocalItems(localCalendar.load());
    }
  };

  const runAutoplan = async () => {
    if (!cloudEnabled) {
      alert(
        "Авто-план работает только с включённой синхронизацией: нужен workspace key, чтобы план был на всех устройствах. Открой Sync.",
      );
      return;
    }
    const plan = await planMutation.mutateAsync({
      startDate: planForm.startDate,
      weeksCount: planForm.weeksCount,
      postsPerWeek: planForm.postsPerWeek,
      segment: planForm.segment,
      platform: planForm.platform,
    });
    /* Сохраняем последовательно — D1 REST не любит мегаконкаррентные
       инсёрты на одну таблицу с маленького аккаунта. */
    for (const it of plan.items) {
      await cloudSave.mutateAsync({
        date: it.date,
        title: it.title,
        format: it.format,
      });
    }
    setPlanOpen(false);
  };

  const scheduleTopic = (topicId: number) => {
    const topic = allContentTopics.find((t) => t.id === topicId);
    if (!topic) return;
    if (cloudEnabled) {
      cloudSave.mutate({
        date: selected,
        title: topic.title,
        format: topic.format,
        topicId,
      });
    } else {
      localCalendar.add({
        id: crypto.randomUUID(),
        date: selected,
        title: topic.title,
        format: topic.format,
        topicId,
      });
      setLocalItems(localCalendar.load());
    }
    setPicking(false);
  };

  /* Сохранение произвольной публикации (не из библиотеки тем).
     topicId не задаётся — пост не привязан к идее. */
  const saveCustom = () => {
    const title = customTitle.trim();
    if (!title) return;
    if (cloudEnabled) {
      cloudSave.mutate({ date: selected, title, format: customFormat });
    } else {
      localCalendar.add({
        id: crypto.randomUUID(),
        date: selected,
        title,
        format: customFormat,
      });
      setLocalItems(localCalendar.load());
    }
    setCustomTitle("");
    setCustomOpen(false);
  };

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(year - 1); } else setMonth(month - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(year + 1); } else setMonth(month + 1);
  };

  const scheduledTopicIds = new Set(items.map((i) => i.topicId).filter((v): v is number => typeof v === "number"));
  const unscheduledTopics = allContentTopics.filter((t) => !scheduledTopicIds.has(t.id));

  const inner = (
    <>
      {!embedded && (
      <section style={{ padding: "56px 0 16px" }}>
        <div className="container">
          <div className="flex items-center gap-3" style={{ marginBottom: 14 }}>
            <span className="eyebrow">Календарь публикаций</span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "3px 10px",
                borderRadius: 9999,
                background: cloudEnabled ? "rgba(212,168,67,0.12)" : "rgba(255,255,255,0.06)",
                color: cloudEnabled ? "var(--brand-gold)" : "var(--muted-foreground)",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 1.5,
                textTransform: "uppercase",
              }}
            >
              {cloudEnabled ? <><Cloud className="w-3 h-3" /> Cloud sync · {workspaceKey}</> : <><CloudOff className="w-3 h-3" /> Локально</>}
            </span>
          </div>
          <h1>
            Когда что <span style={{ color: "var(--brand-gold)" }}>выходит.</span>
          </h1>
          <p
            className="text-platinum"
            style={{ maxWidth: 620, fontSize: 18, lineHeight: 1.5, marginTop: 18 }}
          >
            Двигай темы из плана в конкретные дни перетаскиванием. Кнопкой
            ниже Gemini напишет план на несколько недель сразу — с темами,
            рубриками и тонами под твою ЦА.
          </p>

          <div style={{ marginTop: 22, display: "flex", flexWrap: "wrap", gap: 10 }}>
            <button
              onClick={() => setPlanOpen((v) => !v)}
              className="btn-gold gold-glow"
              style={{ padding: "12px 20px", fontSize: 14 }}
            >
              <Wand2 className="w-4 h-4" />
              {planOpen ? "Скрыть параметры" : "Сгенерировать план"}
            </button>
            {planMutation.isPending && (
              <span
                className="text-platinum"
                style={{ alignSelf: "center", fontSize: 13, opacity: 0.7 }}
              >
                <Loader2
                  className="w-3.5 h-3.5 animate-spin"
                  style={{ display: "inline", marginRight: 6 }}
                />
                Пишу план...
              </span>
            )}
            {planMutation.error && (
              <span
                style={{
                  alignSelf: "center",
                  fontSize: 13,
                  color: "#e25555",
                  maxWidth: 480,
                }}
              >
                {planMutation.error.message}
              </span>
            )}
          </div>

          {planOpen && (
            <div
              className="bento-card"
              style={{
                padding: 20,
                marginTop: 16,
                display: "grid",
                gap: 12,
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              }}
            >
              <label style={{ display: "block" }}>
                <div className="eyebrow" style={{ marginBottom: 6 }}>С какой даты</div>
                <input
                  type="date"
                  value={planForm.startDate}
                  onChange={(e) => setPlanForm({ ...planForm, startDate: e.target.value })}
                  style={planInputStyle}
                />
              </label>
              <label style={{ display: "block" }}>
                <div className="eyebrow" style={{ marginBottom: 6 }}>Недель</div>
                <select
                  value={planForm.weeksCount}
                  onChange={(e) => setPlanForm({ ...planForm, weeksCount: Number(e.target.value) })}
                  style={planInputStyle}
                >
                  {[1, 2, 3, 4, 5, 6, 8].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
              <label style={{ display: "block" }}>
                <div className="eyebrow" style={{ marginBottom: 6 }}>Постов в неделю</div>
                <select
                  value={planForm.postsPerWeek}
                  onChange={(e) => setPlanForm({ ...planForm, postsPerWeek: Number(e.target.value) })}
                  style={planInputStyle}
                >
                  {[2, 3, 4, 5, 6, 7].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
              <label style={{ display: "block" }}>
                <div className="eyebrow" style={{ marginBottom: 6 }}>Сегмент ЦА</div>
                <select
                  value={planForm.segment}
                  onChange={(e) =>
                    setPlanForm({ ...planForm, segment: e.target.value as typeof planForm.segment })
                  }
                  style={planInputStyle}
                >
                  <option value="mixed">Смешанная</option>
                  <option value="women_25_45">Женщины 25-45</option>
                  <option value="men_30_45">Мужчины 30-45</option>
                  <option value="ambitious_pro">Амбициозные профи</option>
                </select>
              </label>
              <label style={{ display: "block" }}>
                <div className="eyebrow" style={{ marginBottom: 6 }}>Платформа</div>
                <select
                  value={planForm.platform}
                  onChange={(e) =>
                    setPlanForm({ ...planForm, platform: e.target.value as typeof planForm.platform })
                  }
                  style={planInputStyle}
                >
                  <option value="telegram">Telegram</option>
                  <option value="instagram">Instagram</option>
                </select>
              </label>
              <div style={{ display: "flex", alignItems: "flex-end" }}>
                <button
                  onClick={runAutoplan}
                  disabled={planMutation.isPending || cloudSave.isPending}
                  className="btn-gold"
                  style={{ width: "100%", padding: "10px 16px" }}
                >
                  {planMutation.isPending || cloudSave.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Создаю {planForm.weeksCount * planForm.postsPerWeek}...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Заполнить {planForm.weeksCount * planForm.postsPerWeek} публикаций
                      <CostBadge action="monthPlan" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
      )}

      <section style={{ padding: "24px 0 96px" }}>
        <div className="container grid gap-6" style={{ gridTemplateColumns: "minmax(0, 2fr) minmax(280px, 1fr)" }}>
          <div className="bento-card" style={{ padding: 24 }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 18 }}>
              <h3 style={{ fontSize: 22 }}>{MONTHS[month]} {year}</h3>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={prevMonth} style={{ background: "var(--ink-2)", border: 0, color: "#fff", width: 36, height: 36, borderRadius: 9999, cursor: "pointer" }}>
                  <ChevronLeft className="w-4 h-4" style={{ margin: "0 auto" }} />
                </button>
                <button onClick={nextMonth} style={{ background: "var(--ink-2)", border: 0, color: "#fff", width: 36, height: 36, borderRadius: 9999, cursor: "pointer" }}>
                  <ChevronRight className="w-4 h-4" style={{ margin: "0 auto" }} />
                </button>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 8 }}>
              {WEEKDAYS.map((d) => (
                <div key={d} className="eyebrow" style={{ textAlign: "center", padding: 8, color: "var(--muted-foreground)" }}>
                  {d}
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
              {monthGrid.map((d, i) => {
                if (!d) return <div key={i} />;
                const dateStr = fmtDate(d);
                const cellItems = itemsForDate(dateStr);
                const isToday = dateStr === fmtDate(today);
                const isSelected = dateStr === selected;
                const isDropTarget = dragOverDate === dateStr && draggingId;
                return (
                  <div
                    key={i}
                    onClick={() => setSelected(dateStr)}
                    onDragOver={(e) => {
                      if (draggingId) {
                        e.preventDefault();
                        setDragOverDate(dateStr);
                      }
                    }}
                    onDragLeave={() =>
                      setDragOverDate((cur) =>
                        cur === dateStr ? null : cur,
                      )
                    }
                    onDrop={(e) => {
                      e.preventDefault();
                      const id = e.dataTransfer.getData("text/plain");
                      if (id) moveItem(id, dateStr);
                      setDraggingId(null);
                      setDragOverDate(null);
                    }}
                    style={{
                      background: isDropTarget
                        ? "rgba(212,168,67,0.35)"
                        : isSelected
                          ? "var(--brand-gold)"
                          : "var(--ink-3)",
                      color: isSelected ? "var(--ink)" : "#fff",
                      border: isDropTarget
                        ? "2px dashed var(--brand-gold)"
                        : isToday
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
                      transition: "background .15s, border-color .15s",
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
                        draggable
                        onDragStart={(e) => {
                          e.stopPropagation();
                          e.dataTransfer.setData("text/plain", it.id);
                          e.dataTransfer.effectAllowed = "move";
                          setDraggingId(it.id);
                        }}
                        onDragEnd={() => {
                          setDraggingId(null);
                          setDragOverDate(null);
                        }}
                        title={it.title + " · потащи в другой день"}
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
                          cursor: "grab",
                          opacity: draggingId === it.id ? 0.4 : 1,
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
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bento-card" style={{ padding: 24 }}>
            <div className="eyebrow" style={{ marginBottom: 10 }}>{selected}</div>
            <h3 style={{ fontSize: 22, marginBottom: 16 }}>
              {itemsForDate(selected).length === 0 ? "Пока ничего" : `${itemsForDate(selected).length} публ.`}
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
              {itemsForDate(selected).map((it) => (
                <div key={it.id} style={{ padding: 12, background: "var(--ink-3)", borderRadius: 14, display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, lineHeight: 1.3 }}>{it.title}</div>
                    <div className="eyebrow" style={{ color: "var(--brand-gold)" }}>{it.format}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {it.topicId && (
                      <Link href={`/generator?title=${encodeURIComponent(it.title)}`}>
                        <span
                          title="Открыть в студии"
                          style={{ background: "var(--brand-gold)", color: "var(--ink)", border: 0, borderRadius: 9999, padding: 6, display: "inline-flex", cursor: "pointer" }}
                        >
                          <Sparkles className="w-3 h-3" />
                        </span>
                      </Link>
                    )}
                    <button
                      onClick={() => removeItem(it.id)}
                      style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 9999, padding: 6, color: "var(--muted-foreground)", cursor: "pointer" }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setPicking((v) => !v)}
                className="btn-gold"
                style={{ flex: 1, justifyContent: "center" }}
              >
                <Plus className="w-4 h-4" />
                {picking ? "Закрыть" : "Из идей"}
              </button>
              <button
                onClick={() => setCustomOpen(true)}
                title="Запланировать произвольный пост, Reels или Stories"
                style={{
                  flex: 1,
                  background: "var(--ink-3)",
                  color: "#fff",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 9999,
                  padding: "10px 16px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                <Plus className="w-4 h-4" />
                Своя
              </button>
            </div>

            {picking && (
              <div className="scroll-thin" style={{ marginTop: 14, maxHeight: 360, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                {unscheduledTopics.length === 0 ? (
                  <p style={{ fontSize: 13, color: "var(--muted-foreground)", textAlign: "center", padding: 16 }}>
                    Все темы уже в расписании.
                  </p>
                ) : (
                  unscheduledTopics.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => scheduleTopic(t.id)}
                      style={{ background: "var(--ink-3)", border: 0, textAlign: "left", padding: "10px 12px", borderRadius: 12, color: "#fff", cursor: "pointer", fontFamily: "var(--font-body)", fontSize: 12, lineHeight: 1.3 }}
                    >
                      {t.title}
                      <div className="eyebrow" style={{ color: "var(--brand-gold)", marginTop: 4, fontSize: 10 }}>
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

      {customOpen && (
        <CustomPostModal
          dateStr={selected}
          title={customTitle}
          format={customFormat}
          onTitle={setCustomTitle}
          onFormat={setCustomFormat}
          onSave={saveCustom}
          onClose={() => setCustomOpen(false)}
        />
      )}
    </>
  );

  return embedded ? (
    inner
  ) : (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      {inner}
    </div>
  );
}

const planInputStyle: React.CSSProperties = {
  background: "var(--ink-3)",
  color: "#fff",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 12,
  padding: "8px 12px",
  fontSize: 13,
  fontFamily: "var(--font-body)",
  width: "100%",
};

/* Модалка «Запланировать свой пост / Reels / Stories» — произвольная
   тема + выбор формата. Не привязывается к topicId, не зовёт LLM,
   просто кладёт запись в scheduled. */
function CustomPostModal({
  dateStr,
  title,
  format,
  onTitle,
  onFormat,
  onSave,
  onClose,
}: {
  dateStr: string;
  title: string;
  format: string;
  onTitle: (v: string) => void;
  onFormat: (v: string) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  /* Готовые форматы покрывают типичные сценарии. Юзер также может
     вписать свой текст в свободном поле «Свой формат». */
  const PRESETS = [
    "Пост · Telegram",
    "Пост · Instagram",
    "Reels · Instagram",
    "Reels · YouTube Shorts",
    "Карусель · Instagram",
    "Stories · Instagram",
    "Stories · Telegram",
    "Кружок · Telegram",
    "Long-form · YouTube",
  ];
  const niceDate = new Date(dateStr).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    weekday: "short",
  });

  return (
    <div
      onClick={onClose}
      role="dialog"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bento-card"
        style={{
          width: "min(520px, 100%)",
          padding: 28,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div className="eyebrow" style={{ color: "var(--brand-gold)" }}>
          Своя публикация · {niceDate}
        </div>
        <h2
          style={{
            fontSize: 22,
            margin: 0,
            letterSpacing: "-0.4px",
            color: "#fff",
          }}
        >
          Запланировать пост вручную
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            lineHeight: 1.5,
            color: "var(--brand-platinum)",
          }}
        >
          Это не генерация — просто запись в календаре. Удобно, когда у
          тебя уже есть готовая идея, сценарий или серия Stories.
        </p>

        <Field label="Тема или заголовок">
          <input
            autoFocus
            value={title}
            onChange={(e) => onTitle(e.target.value)}
            placeholder="Например: серия Stories про утренний ритуал"
            style={modalInputStyle}
            onKeyDown={(e) => {
              if (e.key === "Enter" && title.trim()) onSave();
            }}
          />
        </Field>

        <Field label="Формат">
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
            }}
          >
            {PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => onFormat(p)}
                style={{
                  padding: "7px 12px",
                  borderRadius: 9999,
                  border: 0,
                  background:
                    format === p ? "var(--brand-gold)" : "var(--ink-3)",
                  color: format === p ? "var(--ink)" : "var(--brand-platinum)",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {p}
              </button>
            ))}
          </div>
          <input
            value={PRESETS.includes(format) ? "" : format}
            onChange={(e) => onFormat(e.target.value)}
            placeholder="…или свой формат"
            style={{ ...modalInputStyle, marginTop: 8, fontSize: 12 }}
          />
        </Field>

        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: "12px 18px",
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.14)",
              color: "var(--brand-platinum)",
              borderRadius: 9999,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Отмена
          </button>
          <button
            onClick={onSave}
            disabled={!title.trim()}
            className="btn-gold"
            style={{
              flex: 1,
              padding: "12px 18px",
              fontSize: 13,
              justifyContent: "center",
              opacity: title.trim() ? 1 : 0.5,
            }}
          >
            Запланировать
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 8, fontSize: 10 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

const modalInputStyle: React.CSSProperties = {
  width: "100%",
  height: 42,
  padding: "0 14px",
  background: "var(--ink-3)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 10,
  color: "#fff",
  fontSize: 14,
  outline: "none",
  fontFamily: "var(--font-body)",
};
