import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Loader2, RefreshCw, Sparkles, TrendingUp } from "lucide-react";

export default function Trends() {
  const [, navigate] = useLocation();
  const list = trpc.trends.list.useQuery();
  const channels = trpc.trends.channels.useQuery();
  const refresh = trpc.trends.refresh.useMutation({
    onSuccess: () => list.refetch(),
  });

  const lastFetched = list.data?.lastRefreshedAt
    ? new Date(list.data.lastRefreshedAt).toLocaleString("ru-RU")
    : null;

  return (
    <main>
      <section style={{ padding: "48px 0 24px" }}>
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
              fontSize: 56,
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
            Каждый день в 9:00 МСК cron-Worker заходит на публичные
            превью-страницы каналов конкурентов в нише и просит Gemini
            кластеризовать их посты в 5-7 трендовых тем под твою ЦА. Жми
            «Создать пост» — тема улетит в Студию.
          </p>

          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "center",
              marginBottom: 32,
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
                  тренды...
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
                Последнее обновление: {lastFetched}
              </span>
            )}
            {channels.data && (
              <span
                className="text-platinum"
                style={{ fontSize: 13, opacity: 0.7 }}
              >
                Каналов в анализе: {channels.data.channels.length}
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
                свежими постами и кластеризует темы. Это занимает
                ~20-30 секунд.
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
    </main>
  );
}
