import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  Loader2,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

/* Цветовая семантика статуса канала. ok = зелёный (отдал посты),
   empty / http_error / fetch_error = красный (мёртвый),
   unknown = серый (ещё не парсили). */
function statusColor(status: string): string {
  if (status === "ok") return "#3ecf8e";
  if (status === "unknown") return "var(--muted-foreground)";
  return "#e25555";
}
function statusLabel(status: string): string {
  if (status === "ok") return "Активен";
  if (status === "empty") return "Нет постов";
  if (status === "http_error") return "Не отвечает";
  if (status === "fetch_error") return "Ошибка сети";
  return "Не проверен";
}

export default function Trends() {
  const [, navigate] = useLocation();
  const list = trpc.trends.list.useQuery();
  const channels = trpc.trends.channels.useQuery();
  const refresh = trpc.trends.refresh.useMutation({
    onSuccess: (res) => {
      list.refetch();
      channels.refetch();
      toast.success(
        `Готово: ${res.topics} тем из ${res.channelsOk}/${res.channelsTotal} каналов (${res.posts} постов)`,
      );
    },
    onError: (e) => toast.error(e.message),
  });
  const addChannel = trpc.trends.addChannel.useMutation({
    onSuccess: (r) => {
      channels.refetch();
      if (r.status === "ok") {
        toast.success(`Канал добавлен, есть ${r.postCount} постов`);
      } else {
        toast.error(`Канал добавлен, но не отдал постов (${r.status})`);
      }
    },
    onError: (e) => toast.error(e.message),
  });
  const setEnabled = trpc.trends.setEnabled.useMutation({
    onSuccess: () => channels.refetch(),
  });
  const removeChannel = trpc.trends.removeChannel.useMutation({
    onSuccess: () => channels.refetch(),
  });

  const [newChannel, setNewChannel] = useState("");
  const [showAllChannels, setShowAllChannels] = useState(false);

  const lastFetched = list.data?.lastRefreshedAt
    ? new Date(list.data.lastRefreshedAt).toLocaleString("ru-RU")
    : null;

  const chs = channels.data ?? [];
  const enabledCount = chs.filter((c) => c.enabled).length;
  const okCount = chs.filter((c) => c.enabled && c.status === "ok").length;
  const visibleChannels = showAllChannels ? chs : chs.slice(0, 12);

  const handleAddChannel = () => {
    const cleaned = newChannel
      .trim()
      .replace(/^@/, "")
      .replace(/^https?:\/\/t\.me\/(s\/)?/i, "")
      .replace(/\/.*$/, "");
    if (!cleaned) return;
    addChannel.mutate({ name: cleaned });
    setNewChannel("");
  };

  return (
    <main>
      <section style={{ padding: "48px 0 16px" }}>
        <div className="container">
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            <TrendingUp
              className="w-3.5 h-3.5"
              style={{ display: "inline", marginRight: 6 }}
            />
            Банк трендов
          </div>
          <h1
            style={{
              lineHeight: 1.05,
              letterSpacing: "-1.5px",
              marginBottom: 14,
            }}
          >
            Что сейчас{" "}
            <span style={{ color: "var(--brand-gold)" }}>взрывает</span> у
            конкурентов
          </h1>
          <p
            className="text-platinum"
            style={{ fontSize: 17, maxWidth: 720, marginBottom: 24 }}
          >
            Раз в сутки Worker заходит на ~{chs.length || 50} публичных
            TG-каналов фитнес-ниши и просит Gemini кластеризовать их посты
            в трендовые темы под твою ЦА. Жми «Создать пост» — тема улетит
            в Студию.
          </p>

          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "center",
              marginBottom: 24,
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
                  <Loader2 className="w-4 h-4 animate-spin" /> Обновляю
                  ~30 сек...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" /> Обновить сейчас
                </>
              )}
            </button>
            {lastFetched && (
              <span
                className="text-platinum"
                style={{ fontSize: 13, opacity: 0.7 }}
              >
                Обновлено: {lastFetched}
              </span>
            )}
            {chs.length > 0 && (
              <span
                className="text-platinum"
                style={{ fontSize: 13, opacity: 0.7 }}
              >
                Каналов: {enabledCount} активных · {okCount} рабочих
              </span>
            )}
          </div>

          {refresh.error && (
            <div
              className="bento-card"
              style={{
                padding: 16,
                marginBottom: 24,
                borderLeft: "3px solid #e25555",
              }}
            >
              <div style={{ fontSize: 13, color: "#e25555", fontWeight: 600 }}>
                Не удалось обновить
              </div>
              <div
                className="text-platinum"
                style={{ fontSize: 13, marginTop: 4 }}
              >
                {refresh.error.message}
              </div>
            </div>
          )}

          {list.isLoading && (
            <div className="text-platinum" style={{ fontSize: 14 }}>
              <Loader2
                className="w-4 h-4 animate-spin"
                style={{ display: "inline", marginRight: 8 }}
              />
              Загружаю тренды...
            </div>
          )}

          {list.data && list.data.topics.length === 0 && (
            <div className="bento-card" style={{ padding: 24 }}>
              <div className="text-platinum" style={{ fontSize: 14 }}>
                Пока пусто. Нажми «Обновить сейчас» — Worker сходит за
                свежими постами и кластеризует темы.
              </div>
            </div>
          )}

          {list.data && list.data.topics.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              {list.data.topics.map((t) => (
                <div
                  key={t.id}
                  className="bento-card"
                  style={{
                    padding: 24,
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  <h3
                    style={{
                      fontSize: 22,
                      lineHeight: 1.2,
                      letterSpacing: "-0.5px",
                    }}
                  >
                    {t.title}
                  </h3>
                  <p
                    className="text-platinum"
                    style={{ fontSize: 14, lineHeight: 1.5 }}
                  >
                    {t.summary}
                  </p>
                  <div
                    style={{
                      padding: 12,
                      background: "var(--ink-3)",
                      borderRadius: 12,
                      fontSize: 13,
                    }}
                  >
                    <div
                      className="eyebrow"
                      style={{ marginBottom: 6, fontSize: 11 }}
                    >
                      Почему сейчас
                    </div>
                    <div className="text-platinum">{t.whyViral}</div>
                  </div>
                  {t.examples.length > 0 && (
                    <ul
                      style={{
                        margin: 0,
                        paddingLeft: 18,
                        fontSize: 12,
                        opacity: 0.65,
                      }}
                    >
                      {t.examples.slice(0, 2).map((e, i) => (
                        <li
                          key={i}
                          style={{
                            marginBottom: 4,
                            fontStyle: "italic",
                          }}
                        >
                          «{e}»
                        </li>
                      ))}
                    </ul>
                  )}
                  <button
                    onClick={() =>
                      navigate(
                        `/generator?title=${encodeURIComponent(t.title)}`,
                      )
                    }
                    className="btn-gold"
                    style={{ marginTop: "auto", padding: "10px 18px" }}
                  >
                    <Sparkles className="w-4 h-4" />
                    Создать пост по теме
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Управление источниками — отдельным блоком ниже трендов. */}
      <section style={{ padding: "32px 0 96px" }}>
        <div className="container">
          <div
            className="flex items-center justify-between"
            style={{ marginBottom: 16, gap: 12, flexWrap: "wrap" }}
          >
            <div>
              <h2
                style={{
                  fontSize: 26,
                  letterSpacing: "-0.6px",
                  marginBottom: 6,
                }}
              >
                Источники
              </h2>
              <p
                className="text-platinum"
                style={{ fontSize: 14, opacity: 0.7 }}
              >
                {enabledCount} включено · {okCount} реально отдают посты.
                Выключи мёртвые, добавь свои.
              </p>
            </div>
          </div>

          <div
            className="bento-card"
            style={{ padding: 16, marginBottom: 16 }}
          >
            <div className="flex gap-2 items-center">
              <input
                value={newChannel}
                onChange={(e) => setNewChannel(e.target.value)}
                placeholder="@channel_name или t.me/channel_name"
                onKeyDown={(e) => e.key === "Enter" && handleAddChannel()}
                style={{
                  flex: 1,
                  background: "var(--ink-3)",
                  color: "#fff",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 9999,
                  padding: "10px 16px",
                  fontFamily: "var(--font-body)",
                  fontSize: 14,
                }}
              />
              <button
                onClick={handleAddChannel}
                disabled={addChannel.isPending || !newChannel.trim()}
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

          {channels.isLoading ? (
            <div className="text-platinum" style={{ fontSize: 14 }}>
              <Loader2
                className="w-4 h-4 animate-spin"
                style={{ display: "inline", marginRight: 8 }}
              />
              Загружаю список каналов...
            </div>
          ) : (
            <>
              <div
                className="grid gap-2"
                style={{
                  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                }}
              >
                {visibleChannels.map((c) => (
                  <div
                    key={c.name}
                    style={{
                      padding: "10px 14px",
                      background: c.enabled
                        ? "var(--ink-2)"
                        : "rgba(255,255,255,0.02)",
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.06)",
                      display: "flex",
                      gap: 10,
                      alignItems: "center",
                      opacity: c.enabled ? 1 : 0.55,
                    }}
                  >
                    <div
                      style={{
                        flexShrink: 0,
                        color: statusColor(c.status),
                      }}
                      title={statusLabel(c.status)}
                    >
                      {c.status === "ok" ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : c.status === "unknown" ? (
                        <div
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 9999,
                            background: "currentColor",
                            margin: 4,
                          }}
                        />
                      ) : (
                        <AlertCircle className="w-4 h-4" />
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        @{c.name}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--muted-foreground)",
                        }}
                      >
                        {statusLabel(c.status)}
                        {c.status === "ok" && ` · ${c.lastPostCount} постов`}
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        setEnabled.mutate({
                          name: c.name,
                          enabled: !c.enabled,
                        })
                      }
                      title={c.enabled ? "Выключить" : "Включить"}
                      style={{
                        background: "transparent",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 9999,
                        padding: "4px 10px",
                        fontSize: 11,
                        color: c.enabled
                          ? "var(--brand-gold)"
                          : "var(--muted-foreground)",
                        cursor: "pointer",
                      }}
                    >
                      {c.enabled ? "вкл" : "выкл"}
                    </button>
                    <button
                      onClick={() => removeChannel.mutate({ name: c.name })}
                      title="Удалить"
                      style={{
                        background: "transparent",
                        border: 0,
                        color: "var(--muted-foreground)",
                        cursor: "pointer",
                        padding: 4,
                        lineHeight: 0,
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
              {chs.length > 12 && (
                <div style={{ textAlign: "center", marginTop: 16 }}>
                  <button
                    onClick={() => setShowAllChannels(!showAllChannels)}
                    style={{
                      background: "var(--ink-2)",
                      border: 0,
                      color: "var(--brand-gold)",
                      padding: "8px 18px",
                      borderRadius: 9999,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {showAllChannels
                      ? "Свернуть"
                      : `Показать все ${chs.length} каналов`}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}
