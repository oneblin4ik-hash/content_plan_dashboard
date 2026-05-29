import { useState } from "react";
import { Brain, Plus, Trash2, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useWorkspace } from "@/contexts/WorkspaceContext";

export default function Analytics() {
  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <header style={{ padding: "56px 0 8px" }}>
        <div className="container">
          <div className="eyebrow" style={{ marginBottom: 14 }}>
            Аналитика
          </div>
          <h1>
            Что{" "}
            <span style={{ color: "var(--brand-gold)" }}>работает.</span>
          </h1>
          <p
            className="text-platinum"
            style={{ maxWidth: 620, fontSize: 18, lineHeight: 1.5, marginTop: 18 }}
          >
            Заноси цифры после публикации — а AI разберёт, какие темы, форматы
            и хуки реально зашли твоей аудитории.
          </p>
        </div>
      </header>

      <RealMetricsSection />
    </div>
  );
}


/* ============================================================
   Реальная аналитика по публикациям + AI-инсайты (идея #5).
   Хранит метрики в D1, ска́упится workspace-key'ом.
   ============================================================ */

type LocalMetricForm = {
  postTitle: string;
  postType: "post" | "reels" | "carousel" | "story" | "other";
  platform: "telegram" | "instagram" | "youtube" | "other";
  topic: string;
  publishedDate: string;
  views: string;
  reactions: string;
  comments: string;
  saves: string;
  shares: string;
  notes: string;
};

const EMPTY_FORM: LocalMetricForm = {
  postTitle: "",
  postType: "post",
  platform: "telegram",
  topic: "",
  publishedDate: new Date().toISOString().slice(0, 10),
  views: "",
  reactions: "",
  comments: "",
  saves: "",
  shares: "",
  notes: "",
};

function RealMetricsSection() {
  const { workspaceKey, cloudEnabled } = useWorkspace();
  const list = trpc.metrics.list.useQuery(
    { workspaceKey: workspaceKey ?? "", limit: 100 },
    { enabled: !!workspaceKey && cloudEnabled },
  );
  const add = trpc.metrics.add.useMutation({
    onSuccess: () => list.refetch(),
  });
  const del = trpc.metrics.delete.useMutation({
    onSuccess: () => list.refetch(),
  });
  const insights = trpc.metrics.insights.useMutation();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<LocalMetricForm>(EMPTY_FORM);
  const [windowDays, setWindowDays] = useState(30);

  if (!cloudEnabled) {
    return (
      <section className="container py-12">
        <div
          className="bento-card"
          style={{
            padding: 28,
            borderLeft: "3px solid var(--brand-gold)",
          }}
        >
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            <Brain className="w-3.5 h-3.5 inline mr-1.5" />
            AI-аналитика
          </div>
          <h3 style={{ fontSize: 22, marginBottom: 6 }}>
            Включи sync — и сюда подтянется реальная статистика
          </h3>
          <p className="text-platinum" style={{ fontSize: 14 }}>
            Раздел работает по workspace key (как библиотека и медиа-банк).
            Открой «Sync» в навигации, чтобы привязать рабочее пространство.
          </p>
        </div>
      </section>
    );
  }

  const items = list.data ?? [];

  return (
    <section className="container py-12">
      <div style={{ marginBottom: 24 }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>
          <Brain className="w-3.5 h-3.5 inline mr-1.5" />
          AI-аналитика
        </div>
        <h2 style={{ fontSize: 36, letterSpacing: "-0.5px", marginBottom: 8 }}>
          Реальные{" "}
          <span style={{ color: "var(--brand-gold)" }}>метрики</span> и
          инсайты
        </h2>
        <p
          className="text-platinum"
          style={{ fontSize: 15, maxWidth: 720 }}
        >
          Заноси цифры после публикации — views, реакции, комменты, сохранения.
          Когда наберётся 5-10 постов, жми «Получить AI-инсайты», и Gemini
          даст разбор: что зашло, что слили, что повторять следующие 7 дней.
        </p>
      </div>

      {/* Add form */}
      <div style={{ marginBottom: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="btn-gold gold-glow"
          style={{ padding: "10px 18px", fontSize: 14 }}
        >
          <Plus className="w-4 h-4" />
          {showForm ? "Закрыть форму" : "Добавить публикацию"}
        </button>
        <select
          value={windowDays}
          onChange={(e) => setWindowDays(Number(e.target.value))}
          style={{
            background: "var(--ink-3)",
            color: "#fff",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 14,
            padding: "10px 14px",
            fontSize: 13,
          }}
        >
          <option value={7}>За 7 дней</option>
          <option value={14}>За 14 дней</option>
          <option value={30}>За 30 дней</option>
          <option value={60}>За 60 дней</option>
          <option value={90}>За 90 дней</option>
        </select>
        <button
          onClick={() => {
            if (!workspaceKey) return;
            insights.mutate({ workspaceKey, windowDays });
          }}
          disabled={insights.isPending || items.length < 3}
          className="btn-gold"
          style={{
            background: "var(--ink-2)",
            color: "#fff",
            padding: "10px 18px",
            fontSize: 14,
          }}
          title={items.length < 3 ? "Нужно минимум 3 публикации" : "Запустить разбор"}
        >
          {insights.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Думаю...
            </>
          ) : (
            <>
              <Brain className="w-4 h-4" /> Получить AI-инсайты
            </>
          )}
        </button>
      </div>

      {showForm && (
        <div className="bento-card" style={{ padding: 20, marginBottom: 24 }}>
          <div className="grid gap-3 md:grid-cols-3">
            <input
              type="text"
              value={form.postTitle}
              onChange={(e) => setForm({ ...form, postTitle: e.target.value })}
              placeholder="Заголовок поста *"
              style={metricInputStyle}
            />
            <select
              value={form.postType}
              onChange={(e) =>
                setForm({ ...form, postType: e.target.value as LocalMetricForm["postType"] })
              }
              style={metricInputStyle}
            >
              <option value="post">Пост</option>
              <option value="reels">Reels</option>
              <option value="carousel">Карусель</option>
              <option value="story">Stories</option>
              <option value="other">Другое</option>
            </select>
            <select
              value={form.platform}
              onChange={(e) =>
                setForm({ ...form, platform: e.target.value as LocalMetricForm["platform"] })
              }
              style={metricInputStyle}
            >
              <option value="telegram">Telegram</option>
              <option value="instagram">Instagram</option>
              <option value="youtube">YouTube</option>
              <option value="other">Другое</option>
            </select>
            <input
              type="text"
              value={form.topic}
              onChange={(e) => setForm({ ...form, topic: e.target.value })}
              placeholder="Тема (напр. ягодицы, питание)"
              style={metricInputStyle}
            />
            <input
              type="date"
              value={form.publishedDate}
              onChange={(e) => setForm({ ...form, publishedDate: e.target.value })}
              style={metricInputStyle}
            />
            <input
              type="number"
              value={form.views}
              onChange={(e) => setForm({ ...form, views: e.target.value })}
              placeholder="Просмотры"
              style={metricInputStyle}
            />
            <input
              type="number"
              value={form.reactions}
              onChange={(e) => setForm({ ...form, reactions: e.target.value })}
              placeholder="Реакции / лайки"
              style={metricInputStyle}
            />
            <input
              type="number"
              value={form.comments}
              onChange={(e) => setForm({ ...form, comments: e.target.value })}
              placeholder="Комментарии"
              style={metricInputStyle}
            />
            <input
              type="number"
              value={form.saves}
              onChange={(e) => setForm({ ...form, saves: e.target.value })}
              placeholder="Сохранения"
              style={metricInputStyle}
            />
            <input
              type="number"
              value={form.shares}
              onChange={(e) => setForm({ ...form, shares: e.target.value })}
              placeholder="Шейры / репосты"
              style={metricInputStyle}
            />
            <input
              type="text"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Заметка (опционально)"
              style={{ ...metricInputStyle, gridColumn: "span 2" }}
            />
          </div>
          <button
            onClick={async () => {
              if (!workspaceKey) return;
              if (form.postTitle.trim().length < 1) return;
              await add.mutateAsync({
                workspaceKey,
                postTitle: form.postTitle.trim(),
                postType: form.postType,
                platform: form.platform,
                topic: form.topic.trim() || undefined,
                publishedAt: new Date(form.publishedDate).getTime(),
                views: parseInt(form.views || "0", 10) || 0,
                reactions: parseInt(form.reactions || "0", 10) || 0,
                comments: parseInt(form.comments || "0", 10) || 0,
                saves: parseInt(form.saves || "0", 10) || 0,
                shares: parseInt(form.shares || "0", 10) || 0,
                notes: form.notes.trim() || undefined,
              });
              setForm(EMPTY_FORM);
              setShowForm(false);
            }}
            disabled={add.isPending}
            className="btn-gold"
            style={{ marginTop: 14, padding: "10px 18px" }}
          >
            {add.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Сохраняю...
              </>
            ) : (
              "Сохранить публикацию"
            )}
          </button>
        </div>
      )}

      {/* AI report */}
      {insights.data && insights.data.report && (
        <div
          className="bento-card"
          style={{
            padding: 24,
            marginBottom: 24,
            borderLeft: "3px solid var(--brand-gold)",
          }}
        >
          <div
            className="eyebrow"
            style={{ marginBottom: 12, color: "var(--brand-gold)" }}
          >
            AI-разбор · {insights.data.metricsAnalyzed} публикаций · за{" "}
            {insights.data.windowDays} дней
          </div>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              fontFamily: "var(--font-body)",
              fontSize: 14,
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            {insights.data.report}
          </pre>
        </div>
      )}
      {insights.data && insights.data.needsMore && (
        <div className="bento-card" style={{ padding: 18, marginBottom: 24 }}>
          <div className="text-platinum" style={{ fontSize: 13 }}>
            {insights.data.message}
          </div>
        </div>
      )}
      {insights.error && (
        <div
          className="bento-card"
          style={{
            padding: 16,
            marginBottom: 24,
            borderLeft: "3px solid #e25555",
          }}
        >
          <div style={{ fontSize: 13, color: "#e25555", fontWeight: 600 }}>
            Разбор сорвался
          </div>
          <div className="text-platinum" style={{ fontSize: 13, marginTop: 4 }}>
            {insights.error.message}
          </div>
        </div>
      )}

      {/* Table */}
      {list.isLoading && (
        <div className="text-platinum" style={{ fontSize: 14 }}>
          <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
          Загружаю метрики...
        </div>
      )}
      {!list.isLoading && items.length === 0 && (
        <div className="bento-card" style={{ padding: 24 }}>
          <div className="text-platinum" style={{ fontSize: 14 }}>
            Пока ничего не занесено. После публикации жми «Добавить
            публикацию» и заноси цифры — через 5-10 постов появится первый
            осмысленный AI-разбор.
          </div>
        </div>
      )}
      {items.length > 0 && (
        <div className="bento-card" style={{ padding: 0, overflow: "hidden" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "1fr 80px 100px 70px 70px 70px 70px 70px 70px 40px",
              gap: 0,
              fontSize: 12,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              opacity: 0.6,
              padding: "12px 16px",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div>Заголовок</div>
            <div>Тип</div>
            <div>Дата</div>
            <div style={{ textAlign: "right" }}>Views</div>
            <div style={{ textAlign: "right" }}>R</div>
            <div style={{ textAlign: "right" }}>C</div>
            <div style={{ textAlign: "right" }}>S</div>
            <div style={{ textAlign: "right" }}>Sh</div>
            <div style={{ textAlign: "right" }}>ER%</div>
            <div></div>
          </div>
          {items.map((m) => {
            const dateStr = new Date(m.publishedAt).toLocaleDateString("ru-RU", {
              day: "2-digit",
              month: "short",
            });
            const erColor =
              m.erPercent >= 8
                ? "#3ecf8e"
                : m.erPercent >= 4
                  ? "var(--brand-gold)"
                  : "var(--brand-platinum)";
            return (
              <div
                key={m.id}
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "1fr 80px 100px 70px 70px 70px 70px 70px 70px 40px",
                  gap: 0,
                  alignItems: "center",
                  fontSize: 13,
                  padding: "12px 16px",
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                }}
              >
                <div
                  title={m.postTitle}
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {m.postTitle}
                  {m.topic && (
                    <span
                      style={{
                        marginLeft: 8,
                        fontSize: 11,
                        padding: "1px 8px",
                        background: "var(--gold-soft-fill)",
                        color: "var(--brand-gold)",
                        borderRadius: 9999,
                      }}
                    >
                      #{m.topic}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>{m.postType}</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>{dateStr}</div>
                <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                  {m.views.toLocaleString("ru-RU")}
                </div>
                <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", opacity: 0.85 }}>
                  {m.reactions}
                </div>
                <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", opacity: 0.85 }}>
                  {m.comments}
                </div>
                <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", opacity: 0.85 }}>
                  {m.saves}
                </div>
                <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", opacity: 0.85 }}>
                  {m.shares}
                </div>
                <div
                  style={{
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                    fontWeight: 700,
                    color: erColor,
                  }}
                >
                  {m.erPercent}%
                </div>
                <button
                  onClick={() => {
                    if (!workspaceKey) return;
                    if (!confirm(`Удалить «${m.postTitle.slice(0, 40)}»?`)) return;
                    del.mutate({ workspaceKey, id: m.id });
                  }}
                  style={{
                    background: "transparent",
                    border: 0,
                    color: "var(--brand-platinum)",
                    opacity: 0.5,
                    cursor: "pointer",
                    padding: 0,
                  }}
                  title="Удалить"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

const metricInputStyle: React.CSSProperties = {
  background: "var(--ink-3)",
  color: "#fff",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 14,
  padding: "10px 14px",
  fontSize: 13,
  fontFamily: "var(--font-body)",
  width: "100%",
};
