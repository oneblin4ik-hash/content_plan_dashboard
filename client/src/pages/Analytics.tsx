import { useState } from "react";
import {
  Brain,
  Plus,
  Trash2,
  Pencil,
  Check,
  Loader2,
  Users,
  BarChart3,
  RefreshCw,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Send,
  Youtube,
} from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useWorkspace } from "@/contexts/WorkspaceContext";

/* Раздел /analytics состоит из двух табов:
   - «Конкуренты» — публичный парсинг TG + YouTube + AI-анализ
     (что работает у конкурента, как использовать у себя)
   - «Мои публикации» — ручной ввод метрик постов + AI-инсайты
     (бывшая RealMetricsSection) */
type AnalyticsTab = "competitors" | "self";

export default function Analytics() {
  const [tab, setTab] = useState<AnalyticsTab>("competitors");
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
            style={{
              maxWidth: 620,
              fontSize: 18,
              lineHeight: 1.5,
              marginTop: 18,
            }}
          >
            {tab === "competitors"
              ? "Парсим публичные каналы конкурентов в фитнес-нише и просим AI разобрать, какой контент у них залетает и как это использовать."
              : "Заноси цифры после публикации — AI разберёт, какие темы, форматы и хуки реально зашли твоей аудитории."}
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
              active={tab === "competitors"}
              onClick={() => setTab("competitors")}
              icon={<Users className="w-4 h-4" />}
              label="Конкуренты"
            />
            <TabBtn
              active={tab === "self"}
              onClick={() => setTab("self")}
              icon={<BarChart3 className="w-4 h-4" />}
              label="Мои публикации"
            />
          </div>
        </div>
      </header>

      {tab === "competitors" ? <CompetitorsSection /> : <RealMetricsSection />}
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

/* ============================================================
   Конкуренты — парсинг TG/YT + per-канал AI-отчёт.
   Таблица из карточек: подписчики, средние просмотры, что особенного,
   что залетает, как использовать.
   ============================================================ */
function CompetitorsSection() {
  const { workspaceKey, cloudEnabled } = useWorkspace();
  const [, navigate] = useLocation();
  const list = trpc.competitors.list.useQuery(undefined, {
    enabled: cloudEnabled,
  });
  const refresh = trpc.competitors.refresh.useMutation({
    onSuccess: (r) => {
      list.refetch();
      toast.success(`Обновил ${r.okCount} из ${r.total} каналов`);
    },
    onError: (e) => toast.error(e.message),
  });
  const analyze = trpc.competitors.analyze.useMutation({
    onSuccess: () => {
      list.refetch();
      toast.success("AI-отчёт готов");
    },
    onError: (e) => toast.error(e.message),
  });
  const addChannel = trpc.competitors.add.useMutation({
    onSuccess: (r) => {
      list.refetch();
      if (r.status === "ok") toast.success(`Добавлен, ${r.postCount} постов`);
      else toast.error(`Добавлен, но не отдал постов (${r.status})`);
    },
    onError: (e) => toast.error(e.message),
  });
  const removeChannel = trpc.competitors.remove.useMutation({
    onSuccess: () => list.refetch(),
  });

  const [newHandle, setNewHandle] = useState("");
  const [newPlatform, setNewPlatform] = useState<"tg" | "yt">("tg");
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);

  if (!cloudEnabled) {
    return (
      <section className="container py-12">
        <div className="bento-card" style={{ padding: 24 }}>
          <p className="text-platinum">
            Включи синхронизацию в Настройках, чтобы видеть конкурентов и
            сохранять отчёты.
          </p>
        </div>
      </section>
    );
  }

  const channels = list.data ?? [];
  const okCount = channels.filter((c) => c.status === "ok").length;

  const handleAdd = () => {
    const cleaned = newHandle
      .trim()
      .replace(/^@/, "")
      .replace(/^https?:\/\/(www\.)?youtube\.com\/@?/i, "")
      .replace(/^https?:\/\/(www\.)?t\.me\/(s\/)?/i, "")
      .replace(/\/.*$/, "");
    if (!cleaned) return;
    addChannel.mutate({ platform: newPlatform, handle: cleaned });
    setNewHandle("");
  };

  return (
    <section style={{ padding: "16px 0 96px" }}>
      <div className="container">
        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
            marginBottom: 18,
          }}
        >
          <button
            onClick={() => refresh.mutate({})}
            disabled={refresh.isPending}
            className="btn-gold gold-glow"
            style={{ padding: "12px 22px", fontSize: 14 }}
          >
            {refresh.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Парсю каналы...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" /> Обновить все
              </>
            )}
          </button>
          {channels.length > 0 && (
            <span
              className="text-platinum"
              style={{ fontSize: 13, opacity: 0.7 }}
            >
              {channels.length} каналов · {okCount} рабочих
            </span>
          )}
        </div>

        {/* Форма добавить */}
        <div
          className="bento-card"
          style={{ padding: 16, marginBottom: 18 }}
        >
          <div className="flex gap-2 items-center" style={{ flexWrap: "wrap" }}>
            <div
              style={{
                display: "inline-flex",
                gap: 2,
                padding: 3,
                background: "var(--ink-3)",
                borderRadius: 9999,
              }}
            >
              <PlatformChip
                active={newPlatform === "tg"}
                onClick={() => setNewPlatform("tg")}
                icon={<Send className="w-3.5 h-3.5" />}
                label="Telegram"
              />
              <PlatformChip
                active={newPlatform === "yt"}
                onClick={() => setNewPlatform("yt")}
                icon={<Youtube className="w-3.5 h-3.5" />}
                label="YouTube"
              />
            </div>
            <input
              value={newHandle}
              onChange={(e) => setNewHandle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder={
                newPlatform === "tg"
                  ? "@channel или t.me/channel"
                  : "@handle или youtube.com/@handle"
              }
              style={{
                flex: 1,
                minWidth: 200,
                background: "var(--ink-3)",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 9999,
                padding: "10px 16px",
                fontSize: 14,
              }}
            />
            <button
              onClick={handleAdd}
              disabled={addChannel.isPending || !newHandle.trim()}
              className="btn-gold"
              style={{ padding: "10px 18px" }}
            >
              {addChannel.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Добавить
            </button>
          </div>
        </div>

        {/* Таблица карточек */}
        {list.isLoading ? (
          <div className="text-platinum" style={{ fontSize: 14 }}>
            <Loader2
              className="w-4 h-4 animate-spin"
              style={{ display: "inline", marginRight: 8 }}
            />
            Загружаю...
          </div>
        ) : channels.length === 0 ? (
          <div className="bento-card" style={{ padding: 24 }}>
            <p className="text-platinum">
              Пусто. Добавь канал выше или нажми «Обновить все», чтобы
              начать.
            </p>
          </div>
        ) : (
          <div
            className="grid gap-3"
            style={{
              gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))",
            }}
          >
            {channels.map((c) => (
              <CompetitorCard
                key={c.id}
                channel={c}
                onAnalyze={() => {
                  setAnalyzingId(c.id);
                  analyze.mutate(
                    { id: c.id },
                    { onSettled: () => setAnalyzingId(null) },
                  );
                }}
                onRemove={() => removeChannel.mutate({ id: c.id })}
                isAnalyzing={
                  analyze.isPending && analyzingId === c.id
                }
                onUseRecommendation={(rec) => {
                  /* Deep-link в Студию с темой, собранной из имени
                     конкурента и текста рекомендации. Промпт через
                     callLLM уже подмешивает полные рекомендации, так
                     что здесь нужен только осмысленный заголовок. */
                  const trimmed = rec.length > 80 ? `${rec.slice(0, 80)}…` : rec;
                  const title = `По мотивам @${c.handle}: ${trimmed}`;
                  navigate(
                    `/generator?title=${encodeURIComponent(title)}&mode=post`,
                  );
                }}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function PlatformChip({
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
        padding: "6px 12px",
        borderRadius: 9999,
        border: 0,
        background: active ? "var(--brand-gold)" : "transparent",
        color: active ? "var(--ink)" : "var(--brand-platinum)",
        fontFamily: "var(--font-body)",
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      {icon}
      {label}
    </button>
  );
}

type CompetitorChannel = {
  id: string;
  platform: "tg" | "yt";
  handle: string;
  title: string | null;
  subscribers: number | null;
  avgViews: number | null;
  bio: string | null;
  samplePosts: Array<{ text: string; views?: number; url?: string }>;
  analysis: {
    niche_summary: string;
    what_works: string[];
    content_formats: string[];
    hook_patterns: string[];
    recommendations_for_serbolin: string[];
  } | null;
  status: string;
  lastSyncedAt: number | null;
  lastAnalyzedAt: number | null;
  lastError: string | null;
};

function CompetitorCard({
  channel,
  onAnalyze,
  onRemove,
  isAnalyzing,
  onUseRecommendation,
}: {
  channel: CompetitorChannel;
  onAnalyze: () => void;
  onRemove: () => void;
  isAnalyzing: boolean;
  onUseRecommendation: (rec: string) => void;
}) {
  const platformIcon =
    channel.platform === "tg" ? (
      <Send className="w-3.5 h-3.5" />
    ) : (
      <Youtube className="w-3.5 h-3.5" />
    );
  const platformUrl =
    channel.platform === "tg"
      ? `https://t.me/${channel.handle}`
      : `https://www.youtube.com/@${channel.handle}`;
  const isOk = channel.status === "ok";

  return (
    <div
      className="bento-card"
      style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}
    >
      <div
        className="flex items-start justify-between"
        style={{ gap: 12 }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            className="flex items-center"
            style={{ gap: 6, marginBottom: 6, fontSize: 11 }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "2px 8px",
                borderRadius: 9999,
                background:
                  channel.platform === "tg"
                    ? "rgba(34,158,217,0.12)"
                    : "rgba(255,0,0,0.12)",
                color: channel.platform === "tg" ? "#229ED9" : "#ff4d4d",
                fontWeight: 700,
                letterSpacing: 1.2,
                textTransform: "uppercase",
              }}
            >
              {platformIcon}
              {channel.platform === "tg" ? "Telegram" : "YouTube"}
            </span>
            <span
              style={{
                color: isOk ? "#3ecf8e" : "var(--muted-foreground)",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              {isOk ? (
                <CheckCircle2 className="w-3 h-3" />
              ) : (
                <AlertCircle className="w-3 h-3" />
              )}
              {isOk ? "активен" : channel.status}
            </span>
          </div>
          <h3
            style={{
              fontSize: 18,
              letterSpacing: "-0.3px",
              lineHeight: 1.25,
              marginBottom: 4,
            }}
          >
            <a
              href={platformUrl}
              target="_blank"
              rel="noreferrer"
              style={{ color: "inherit", textDecoration: "none" }}
            >
              {channel.title || `@${channel.handle}`}
            </a>
          </h3>
          <div
            style={{
              fontSize: 12,
              color: "var(--muted-foreground)",
            }}
          >
            @{channel.handle}
          </div>
        </div>
        <button
          onClick={onRemove}
          title="Удалить из списка"
          style={{
            background: "transparent",
            border: 0,
            color: "var(--muted-foreground)",
            cursor: "pointer",
            padding: 4,
            lineHeight: 0,
          }}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Метрики */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
        }}
      >
        <Stat
          label="Подписчики"
          value={
            channel.subscribers
              ? channel.subscribers.toLocaleString("ru-RU")
              : "—"
          }
        />
        <Stat
          label={
            channel.platform === "yt" ? "Среднее видео" : "Средний пост"
          }
          value={
            channel.avgViews
              ? channel.avgViews.toLocaleString("ru-RU")
              : "—"
          }
          suffix={channel.avgViews ? "просмотров" : undefined}
        />
      </div>

      {channel.bio && (
        <p
          style={{
            fontSize: 12,
            lineHeight: 1.5,
            color: "var(--brand-platinum)",
            padding: 10,
            background: "var(--ink-3)",
            borderRadius: 10,
            margin: 0,
          }}
        >
          {channel.bio}
        </p>
      )}

      {/* AI-отчёт */}
      {channel.analysis ? (
        <div
          style={{
            padding: 12,
            background: "rgba(212,168,67,0.06)",
            border: "1px solid rgba(212,168,67,0.2)",
            borderRadius: 12,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <ReportRow
            label="Ниша"
            value={channel.analysis.niche_summary}
          />
          <ReportList
            label="Что залетает"
            items={channel.analysis.what_works}
          />
          <ReportList
            label="Форматы"
            items={channel.analysis.content_formats}
            inline
          />
          <ReportList
            label="Паттерны хуков"
            items={channel.analysis.hook_patterns}
          />
          <ReportList
            label="Как использовать"
            items={channel.analysis.recommendations_for_serbolin}
            accent
            onItemAction={onUseRecommendation}
            itemActionLabel="Сделать пост по этой рекомендации"
          />
          {channel.lastAnalyzedAt && (
            <div
              style={{
                fontSize: 10,
                color: "var(--muted-foreground)",
                marginTop: 4,
              }}
            >
              Отчёт от{" "}
              {new Date(channel.lastAnalyzedAt).toLocaleString("ru-RU")}
            </div>
          )}
        </div>
      ) : isOk ? (
        <div
          className="text-platinum"
          style={{ fontSize: 12, opacity: 0.7 }}
        >
          Спарсили {channel.samplePosts.length}{" "}
          {channel.platform === "yt" ? "видео" : "постов"}. Жми
          «Разобрать», чтобы AI выдал отчёт.
        </div>
      ) : (
        <div
          style={{
            fontSize: 12,
            color: "#ff9a7a",
          }}
        >
          Канал недоступен публично или не существует. Можно удалить из
          списка.
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={onAnalyze}
          disabled={!isOk || isAnalyzing || channel.samplePosts.length < 3}
          className="btn-gold"
          style={{
            flex: 1,
            justifyContent: "center",
            padding: "10px 14px",
            fontSize: 13,
          }}
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Анализирую...
            </>
          ) : (
            <>
              <Brain className="w-4 h-4" />
              {channel.analysis ? "Переанализировать" : "Разобрать"}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  suffix,
}: {
  label: string;
  value: string;
  suffix?: string;
}) {
  return (
    <div
      style={{
        background: "var(--ink-2)",
        borderRadius: 10,
        padding: "8px 12px",
      }}
    >
      <div
        style={{
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: 1.4,
          color: "var(--muted-foreground)",
          marginBottom: 3,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 600, color: "#fff" }}>
        {value}
        {suffix && (
          <span
            style={{
              fontSize: 9,
              color: "var(--muted-foreground)",
              marginLeft: 4,
              textTransform: "uppercase",
              letterSpacing: 0.8,
            }}
          >
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function ReportRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        className="eyebrow"
        style={{ fontSize: 10, marginBottom: 4 }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 13,
          lineHeight: 1.5,
          color: "#fff",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function ReportList({
  label,
  items,
  accent,
  inline,
  onItemAction,
  itemActionLabel,
}: {
  label: string;
  items: string[];
  accent?: boolean;
  inline?: boolean;
  /* Опциональная per-item кнопка справа от пункта (для рекомендаций
     конкурентов — «Сделать пост по этому»). */
  onItemAction?: (item: string) => void;
  itemActionLabel?: string;
}) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <div
        className="eyebrow"
        style={{
          fontSize: 10,
          marginBottom: 4,
          color: accent ? "var(--brand-gold)" : undefined,
        }}
      >
        {label}
      </div>
      {inline ? (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {items.map((it, i) => (
            <span
              key={i}
              style={{
                fontSize: 11,
                padding: "3px 10px",
                borderRadius: 9999,
                background: "var(--ink-2)",
                color: "#fff",
              }}
            >
              {it}
            </span>
          ))}
        </div>
      ) : (
        <ul
          style={{
            margin: 0,
            paddingLeft: 18,
            fontSize: 12,
            lineHeight: 1.55,
            color: accent ? "var(--brand-gold)" : "var(--brand-platinum)",
          }}
        >
          {items.map((it, i) => (
            <li key={i} style={{ marginBottom: 6 }}>
              {it}
              {onItemAction && (
                <button
                  onClick={() => onItemAction(it)}
                  title={itemActionLabel ?? "Сделать пост по этому"}
                  style={{
                    marginLeft: 6,
                    background: "rgba(212,168,67,0.18)",
                    border: "1px solid rgba(212,168,67,0.4)",
                    color: "var(--brand-gold)",
                    padding: "2px 8px",
                    borderRadius: 9999,
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: "pointer",
                    letterSpacing: 0.4,
                    verticalAlign: "middle",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <Sparkles className="w-2.5 h-2.5" />
                  В пост
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
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
    { limit: 100 },
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

  /* Inline-правка цифр метрики: при клике на иконку карандаша в
     строке таблицы — открывается редактор всех counter'ов + notes. */
  const update = trpc.metrics.update.useMutation({
    onSuccess: () => list.refetch(),
    onError: (e) => toast.error(e.message),
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    views: "",
    reactions: "",
    comments: "",
    saves: "",
    shares: "",
    notes: "",
  });

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
            insights.mutate({ windowDays });
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
            const isEditing = editingId === m.id;
            const numInput = (
              key: keyof typeof editForm,
              w = 60,
            ) => (
              <input
                type="number"
                min={0}
                value={editForm[key]}
                onChange={(e) =>
                  setEditForm((s) => ({ ...s, [key]: e.target.value }))
                }
                style={{
                  width: w,
                  background: "var(--ink-3)",
                  color: "#fff",
                  border: "1px solid rgba(212,168,67,0.4)",
                  borderRadius: 8,
                  padding: "4px 8px",
                  fontSize: 12,
                  fontFamily: "var(--font-body)",
                  textAlign: "right",
                  fontVariantNumeric: "tabular-nums",
                }}
              />
            );
            return (
              <div
                key={m.id}
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "1fr 80px 100px 80px 70px 70px 70px 70px 70px 70px",
                  gap: 0,
                  alignItems: "center",
                  fontSize: 13,
                  padding: "12px 16px",
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                  background: isEditing
                    ? "rgba(212,168,67,0.06)"
                    : undefined,
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
                  {isEditing ? numInput("views", 80) : m.views.toLocaleString("ru-RU")}
                </div>
                <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", opacity: 0.85 }}>
                  {isEditing ? numInput("reactions") : m.reactions}
                </div>
                <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", opacity: 0.85 }}>
                  {isEditing ? numInput("comments") : m.comments}
                </div>
                <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", opacity: 0.85 }}>
                  {isEditing ? numInput("saves") : m.saves}
                </div>
                <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", opacity: 0.85 }}>
                  {isEditing ? numInput("shares") : m.shares}
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
                <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                  {isEditing ? (
                    <>
                      <button
                        onClick={() => {
                          if (!workspaceKey) return;
                          update.mutate({
                            id: m.id,
                            views: parseInt(editForm.views || "0", 10) || 0,
                            reactions: parseInt(editForm.reactions || "0", 10) || 0,
                            comments: parseInt(editForm.comments || "0", 10) || 0,
                            saves: parseInt(editForm.saves || "0", 10) || 0,
                            shares: parseInt(editForm.shares || "0", 10) || 0,
                            notes: editForm.notes || undefined,
                          });
                          setEditingId(null);
                        }}
                        title="Сохранить"
                        style={{
                          background: "var(--brand-gold)",
                          color: "var(--ink)",
                          border: 0,
                          borderRadius: 9999,
                          width: 24,
                          height: 24,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Check className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        title="Отмена"
                        style={{
                          background: "transparent",
                          border: "1px solid rgba(255,255,255,0.1)",
                          color: "var(--muted-foreground)",
                          borderRadius: 9999,
                          width: 24,
                          height: 24,
                          cursor: "pointer",
                          fontSize: 11,
                        }}
                      >
                        ✕
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setEditingId(m.id);
                          setEditForm({
                            views: String(m.views),
                            reactions: String(m.reactions),
                            comments: String(m.comments),
                            saves: String(m.saves),
                            shares: String(m.shares),
                            notes: m.notes ?? "",
                          });
                        }}
                        title="Править цифры"
                        style={{
                          background: "transparent",
                          border: 0,
                          color: "var(--brand-platinum)",
                          opacity: 0.5,
                          cursor: "pointer",
                          padding: 0,
                        }}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (!workspaceKey) return;
                          if (!confirm(`Удалить «${m.postTitle.slice(0, 40)}»?`)) return;
                          del.mutate({ id: m.id });
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
                    </>
                  )}
                </div>
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
