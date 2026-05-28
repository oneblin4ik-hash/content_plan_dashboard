import { useMemo, useState } from "react";
import { Link2, RefreshCw, Sparkles, Trash2, Check } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useWorkspace } from "@/contexts/WorkspaceContext";

/* Интеграции: публичный синк Telegram-канала + анализ голоса.
   Сила фичи в том, что генератор начинает писать профильным голосом
   автора, а не «средним по бренду». */

export default function Integrations() {
  const { workspaceKey, cloudEnabled } = useWorkspace();
  const [channel, setChannel] = useState("");

  const integrations = trpc.integrations.get.useQuery(
    { workspaceKey },
    { enabled: cloudEnabled && workspaceKey.length > 0 },
  );
  const syncMutation = trpc.integrations.syncTelegram.useMutation({
    onSuccess: () => integrations.refetch(),
  });
  const analyzeMutation = trpc.integrations.analyzeVoice.useMutation({
    onSuccess: () => integrations.refetch(),
  });
  const clearVoiceMutation = trpc.integrations.clearVoice.useMutation({
    onSuccess: () => integrations.refetch(),
  });

  const data = integrations.data ?? {};
  const tg = data.tg;
  const vp = data.voiceProfile;

  const lastSync = useMemo(
    () => (tg?.synced_at ? new Date(tg.synced_at).toLocaleString("ru-RU") : null),
    [tg?.synced_at],
  );
  const lastAnalysis = useMemo(
    () =>
      vp?.analyzed_at
        ? new Date(vp.analyzed_at).toLocaleString("ru-RU")
        : null,
    [vp?.analyzed_at],
  );

  if (!cloudEnabled) {
    return (
      <div className="min-h-screen" style={{ background: "var(--background)" }}>
        <section style={{ padding: "56px 0" }}>
          <div className="container">
            <span className="eyebrow">Интеграции</span>
            <h1 style={{ marginTop: 12 }}>
              Нужен <span style={{ color: "var(--brand-gold)" }}>cloud sync.</span>
            </h1>
            <p className="text-platinum" style={{ maxWidth: 560, marginTop: 18 }}>
              Голосовой профиль живёт в Cloudflare D1. Подключи sync в /settings —
              тогда профиль будет одним и тем же на всех устройствах.
            </p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <section style={{ padding: "56px 0 16px" }}>
        <div className="container">
          <span className="eyebrow">Интеграции</span>
          <h1 style={{ marginTop: 12 }}>
            Твой голос —{" "}
            <span style={{ color: "var(--brand-gold)" }}>в генераторе.</span>
          </h1>
          <p
            className="text-platinum"
            style={{ maxWidth: 620, fontSize: 18, lineHeight: 1.5, marginTop: 14 }}
          >
            Засинхронь публичный Telegram-канал и проанализируй последние посты —
            генератор будет писать твоим тоном, а не усреднённым.
          </p>
        </div>
      </section>

      <section style={{ padding: "16px 0 96px" }}>
        <div
          className="container grid gap-3"
          style={{ gridTemplateColumns: "1fr 1fr" }}
        >
          {/* Telegram sync */}
          <div className="bento-card" style={{ padding: 24 }}>
            <div
              className="flex items-center gap-2"
              style={{ marginBottom: 16 }}
            >
              <Link2 className="w-4 h-4" style={{ color: "var(--brand-gold)" }} />
              <h3 style={{ margin: 0 }}>Telegram-канал</h3>
            </div>
            <div className="flex gap-2" style={{ marginBottom: 12 }}>
              <input
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                placeholder="@Serbolin или t.me/Serbolin"
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  borderRadius: 9999,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "var(--ink-2)",
                  color: "#fff",
                  fontFamily: "var(--font-body)",
                  fontSize: 13,
                }}
              />
              <button
                onClick={() =>
                  syncMutation.mutate({ workspaceKey, channel: channel || tg?.channel?.replace(/^@/, "") || "" })
                }
                disabled={syncMutation.isPending || (!channel && !tg?.channel)}
                className="btn-gold"
                style={{ padding: "10px 16px", fontSize: 12 }}
              >
                <RefreshCw
                  className="w-3 h-3"
                  style={{
                    animation: syncMutation.isPending ? "spin 1s linear infinite" : undefined,
                  }}
                />
                {tg ? "Обновить" : "Синк"}
              </button>
            </div>
            {syncMutation.error && (
              <p style={{ color: "#ff7a7a", fontSize: 12, marginBottom: 12 }}>
                {syncMutation.error.message}
              </p>
            )}
            {tg ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 10,
                  marginBottom: 12,
                }}
              >
                <Stat label="Канал" value={tg.channel ?? "—"} />
                <Stat label="Подписчики" value={tg.subscribers?.toLocaleString("ru-RU") ?? "—"} />
                <Stat label="Среднее" value={tg.avg_views?.toLocaleString("ru-RU") ?? "—"} suffix="views" />
              </div>
            ) : (
              <p
                className="text-platinum"
                style={{ fontSize: 13, lineHeight: 1.5 }}
              >
                Парсится публичная превью-страница <code>t.me/s/…</code> — без API
                и без токенов. Должны быть видны хотя бы несколько постов.
              </p>
            )}
            {tg?.bio && (
              <p
                className="text-platinum"
                style={{
                  fontSize: 12,
                  lineHeight: 1.5,
                  padding: 12,
                  background: "var(--ink-2)",
                  borderRadius: 12,
                  marginBottom: 12,
                }}
              >
                {tg.bio}
              </p>
            )}
            {lastSync && (
              <p
                style={{
                  fontSize: 11,
                  color: "var(--muted-foreground)",
                }}
              >
                Последний синк: {lastSync} · {tg?.posts?.length ?? 0} постов
              </p>
            )}
          </div>

          {/* Voice profile */}
          <div className="bento-card" style={{ padding: 24 }}>
            <div
              className="flex items-center justify-between"
              style={{ marginBottom: 16 }}
            >
              <div className="flex items-center gap-2">
                <Sparkles
                  className="w-4 h-4"
                  style={{ color: "var(--brand-gold)" }}
                />
                <h3 style={{ margin: 0 }}>Голосовой профиль</h3>
              </div>
              {vp && (
                <button
                  onClick={() => clearVoiceMutation.mutate({ workspaceKey })}
                  style={{
                    background: "transparent",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 9999,
                    padding: "6px 10px",
                    color: "var(--muted-foreground)",
                    cursor: "pointer",
                    fontSize: 11,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <Trash2 className="w-3 h-3" /> Сбросить
                </button>
              )}
            </div>

            <button
              onClick={() => analyzeMutation.mutate({ workspaceKey })}
              disabled={
                analyzeMutation.isPending || !tg?.posts || tg.posts.length < 3
              }
              className="btn-gold"
              style={{
                width: "100%",
                justifyContent: "center",
                padding: "10px 16px",
                fontSize: 13,
                marginBottom: 12,
              }}
            >
              <Sparkles
                className="w-4 h-4"
                style={{
                  animation: analyzeMutation.isPending ? "spin 1s linear infinite" : undefined,
                }}
              />
              {analyzeMutation.isPending
                ? "Анализирую..."
                : vp
                  ? "Переанализировать"
                  : "Проанализировать посты"}
            </button>
            {analyzeMutation.error && (
              <p style={{ color: "#ff7a7a", fontSize: 12, marginBottom: 12 }}>
                {analyzeMutation.error.message}
              </p>
            )}

            {vp ? (
              <div style={{ display: "grid", gap: 10 }}>
                <ProfileRow label="Суть" value={vp.summary} />
                <ProfileRow
                  label="Тональность"
                  value={vp.tone_tags?.join(", ")}
                />
                <ProfileRow
                  label="Хуки"
                  value={vp.hook_patterns?.join(" / ")}
                />
                <ProfileRow
                  label="Темы"
                  value={vp.topics_preferred?.join(", ")}
                />
                <ProfileRow label="CTA" value={vp.cta_style} />
                <ProfileRow
                  label="Обращение"
                  value={vp.audience_address}
                />
                <ProfileRow label="Эмодзи" value={vp.emoji_usage} />
                {lastAnalysis && (
                  <p
                    style={{
                      fontSize: 11,
                      color: "var(--muted-foreground)",
                      marginTop: 4,
                    }}
                  >
                    <Check className="w-3 h-3" style={{ display: "inline", marginRight: 4, color: "var(--brand-gold)" }} />
                    Профиль активен. Внедрён в системный промпт.
                    Обновлён: {lastAnalysis} · {vp.post_count_analyzed} постов.
                  </p>
                )}
              </div>
            ) : (
              <p
                className="text-platinum"
                style={{ fontSize: 13, lineHeight: 1.5 }}
              >
                После синка нажми «Проанализировать» — LLM прочитает посты и
                извлечёт устойчивые черты голоса. Профиль будет добавляться в
                каждый промпт генератора.
              </p>
            )}
          </div>
        </div>
      </section>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function Stat({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div
      style={{
        background: "var(--ink-2)",
        borderRadius: 12,
        padding: "10px 12px",
      }}
    >
      <div
        style={{
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: 1.5,
          color: "var(--muted-foreground)",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 600, color: "#fff" }}>
        {value}
        {suffix && (
          <span
            style={{
              fontSize: 10,
              color: "var(--muted-foreground)",
              marginLeft: 4,
            }}
          >
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function ProfileRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: 10 }}>
      <span
        style={{
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: 1.5,
          color: "var(--muted-foreground)",
          paddingTop: 2,
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 13, color: "#fff", lineHeight: 1.5 }}>{value}</span>
    </div>
  );
}
