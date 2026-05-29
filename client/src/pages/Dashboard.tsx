import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Input } from "@/components/ui/input";
import {
  Search,
  Sparkles,
  Trophy,
  Zap,
  BookOpen,
  ArrowUpRight,
  Copy,
  Check,
} from "lucide-react";
import { allContentTopics, allReelsScripts, allTactics } from "@/lib/contentData";

const contentTopics = allContentTopics;
const reelsScripts = allReelsScripts;
const tactics = allTactics;

const potentialColor = (p: string) => {
  if (p === "Вирусный") return "var(--brand-gold)";
  if (p === "Высокий") return "var(--gold-light)";
  if (p === "Средний") return "var(--brand-platinum)";
  return "var(--muted-foreground)";
};

export default function Dashboard() {
  const [searchTerm, setSearchTerm] = useState("");
  const [tab, setTab] = useState<"topics" | "reels" | "tactics">("topics");
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const filtered = useMemo(
    () =>
      contentTopics.filter((t) =>
        t.title.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [searchTerm]
  );

  const viralCount = contentTopics.filter((t) => t.potential === "Вирусный").length;

  const handleCopy = (text: string, id: number) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      {/* HERO */}
      <section style={{ padding: "64px 0 32px" }}>
        <div className="container">
          <div className="eyebrow" style={{ marginBottom: 16 }}>
            Content Studio · Mr. Serbolin
          </div>
          <h1>
            Контент-план,{" "}
            <span style={{ color: "var(--brand-gold)" }}>заточенный под</span>
            <br />
            твою аудиторию.
          </h1>
          <p
            className="text-platinum"
            style={{ maxWidth: 620, fontSize: 19, marginTop: 24, lineHeight: 1.5 }}
          >
            30 тем, 20 reels-сценариев, 7 тактических рекомендаций. Один аккаунт,
            один тренер, один голос. Без воды, без «вы», без декоративных эмодзи.
          </p>

          {/* BENTO STATS */}
          <div
            className="grid gap-3"
            style={{
              gridTemplateColumns: "repeat(4, 1fr)",
              marginTop: 48,
            }}
          >
            <StatTile
              eyebrow="Темы"
              value={`${contentTopics.length}`}
              label="готовых заголовков"
              icon={<BookOpen className="w-5 h-5" />}
            />
            <StatTile
              eyebrow="Вирусный потенциал"
              value={`${viralCount}`}
              label="из коллекции"
              icon={<Zap className="w-5 h-5" />}
              accent
            />
            <StatTile
              eyebrow="Reels-сценариев"
              value={`${reelsScripts.length}`}
              label="готовых к съёмке"
              icon={<Trophy className="w-5 h-5" />}
            />
            <StatTile
              eyebrow="Тактик"
              value={`${tactics.length}`}
              label="рекомендаций по запуску"
              icon={<Sparkles className="w-5 h-5" />}
            />
          </div>
        </div>
      </section>

      {/* TABS */}
      <section style={{ padding: "16px 0 96px" }}>
        <div className="container">
          <div
            className="flex items-center justify-between gap-4 flex-wrap"
            style={{ marginBottom: 24 }}
          >
            <div
              style={{
                display: "inline-flex",
                gap: 4,
                padding: 4,
                background: "var(--ink-2)",
                borderRadius: 9999,
              }}
            >
              {(
                [
                  ["topics", "Темы"],
                  ["reels", "Reels"],
                  ["tactics", "Тактики"],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setTab(k)}
                  style={{
                    padding: "8px 18px",
                    borderRadius: 9999,
                    border: 0,
                    fontFamily: "var(--font-body)",
                    fontSize: 13,
                    fontWeight: 600,
                    background: tab === k ? "var(--brand-gold)" : "transparent",
                    color: tab === k ? "var(--ink)" : "var(--brand-platinum)",
                    transition: "all .2s",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex gap-2 items-center">
              <Link href="/generator">
                <span className="btn-gold">
                  <Sparkles className="w-4 h-4" />
                  Открыть студию
                </span>
              </Link>
            </div>
          </div>

          {tab === "topics" && (
            <>
              <div
                className="flex gap-3 flex-col sm:flex-row"
                style={{ marginBottom: 24 }}
              >
                <div className="relative flex-1">
                  <Search
                    className="absolute left-3 top-3 w-4 h-4"
                    style={{ color: "var(--muted-foreground)" }}
                  />
                  <Input
                    placeholder="Найти тему..."
                    className="pl-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{
                      background: "var(--ink-2)",
                      borderColor: "rgba(255,255,255,0.08)",
                      color: "var(--foreground)",
                      height: 44,
                      borderRadius: 9999,
                    }}
                  />
                </div>
              </div>

              <div
                className="grid gap-3"
                style={{
                  gridTemplateColumns:
                    "repeat(auto-fill, minmax(360px, 1fr))",
                }}
              >
                {filtered.map((topic) => {
                  return (
                    <div
                      key={topic.id}
                      className="bento-card"
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 14,
                      }}
                    >
                      <div
                        className="flex items-start justify-between gap-3"
                        style={{ marginBottom: 4 }}
                      >
                        <div
                          className="eyebrow"
                          style={{ color: potentialColor(topic.potential) }}
                        >
                          {topic.potential}
                        </div>
                      </div>
                      <h3
                        style={{
                          fontSize: 18,
                          lineHeight: 1.3,
                          letterSpacing: "-0.4px",
                        }}
                      >
                        {topic.title}
                      </h3>
                      <p
                        className="text-platinum"
                        style={{ fontSize: 14, lineHeight: 1.5 }}
                      >
                        {topic.reason}
                      </p>
                      <div
                        className="flex items-center justify-between"
                        style={{
                          marginTop: "auto",
                          paddingTop: 12,
                          borderTop: "1px solid rgba(255,255,255,0.06)",
                          fontSize: 12,
                        }}
                      >
                        <span style={{ color: "var(--muted-foreground)" }}>
                          {topic.format}
                        </span>
                        <Link href={`/generator?title=${encodeURIComponent(topic.title)}`}>
                          <span
                            style={{
                              color: "var(--brand-gold)",
                              fontWeight: 600,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            Сгенерировать
                            <ArrowUpRight className="w-3 h-3" />
                          </span>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>

              <p
                className="text-platinum"
                style={{
                  textAlign: "center",
                  fontSize: 13,
                  marginTop: 32,
                  color: "var(--muted-foreground)",
                }}
              >
                Показано {filtered.length} из {contentTopics.length} тем
              </p>
            </>
          )}

          {tab === "reels" && (
            <div
              className="grid gap-3"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))" }}
            >
              {reelsScripts.map((script) => (
                <div key={script.id} className="bento-card" style={{ gap: 14 }}>
                  <div className="eyebrow">Reels · сценарий #{script.id}</div>
                  <h3 style={{ fontSize: 20, letterSpacing: "-0.4px" }}>
                    {script.title}
                  </h3>
                  <ReelsBlock label="Хук" text={script.hook} />
                  {script.body && <ReelsBlock label="Тело" text={script.body} />}
                  <ReelsBlock label="Триггер" text={script.trigger} />
                  <ReelsBlock label="CTA" text={script.cta} italic />
                  <button
                    onClick={() => {
                      const full = `${script.title}\n\nХук: ${script.hook}\n${
                        script.body ? `Тело: ${script.body}\n` : ""
                      }Триггер: ${script.trigger}\n\nCTA: ${script.cta}`;
                      handleCopy(full, script.id);
                    }}
                    className="btn-gold"
                    style={{
                      background: "var(--ink-2)",
                      color: "#fff",
                      width: "100%",
                      justifyContent: "center",
                      marginTop: 8,
                    }}
                  >
                    {copiedId === script.id ? (
                      <>
                        <Check className="w-4 h-4" /> Скопировано
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" /> Скопировать сценарий
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}

          {tab === "tactics" && (
            <div
              className="grid gap-3"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))" }}
            >
              {tactics.map((t) => (
                <div key={t.id} className="bento-card">
                  <div
                    style={{
                      fontSize: 28,
                      marginBottom: 12,
                      color: "var(--brand-gold)",
                    }}
                  >
                    {t.icon}
                  </div>
                  <h3 style={{ fontSize: 20, marginBottom: 10 }}>{t.title}</h3>
                  <p className="text-platinum" style={{ fontSize: 14, lineHeight: 1.5 }}>
                    {t.description}
                  </p>
                  {t.details && (
                    <div
                      style={{
                        marginTop: 12,
                        padding: 12,
                        borderRadius: 14,
                        background: "rgba(212,168,67,0.08)",
                        fontSize: 12,
                        color: "var(--brand-platinum)",
                      }}
                    >
                      {t.details}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* SLOGAN STRIP */}
      <section
        style={{
          background: "var(--brand-gold)",
          color: "var(--ink)",
          padding: "56px 0",
        }}
      >
        <div
          className="container flex items-center justify-between gap-6 flex-wrap"
        >
          <h2 style={{ color: "var(--ink)", maxWidth: 720, fontSize: 36 }}>
            Не жди результат — научись получать удовольствие от процесса.
          </h2>
          <Link href="/generator">
            <span
              style={{
                background: "var(--ink)",
                color: "#fff",
                padding: "16px 28px",
                borderRadius: 9999,
                fontFamily: "var(--font-body)",
                fontSize: 15,
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              Запустить студию
              <ArrowUpRight className="w-4 h-4" />
            </span>
          </Link>
        </div>
      </section>
    </div>
  );
}

function StatTile({
  eyebrow,
  value,
  label,
  icon,
  accent,
}: {
  eyebrow: string;
  value: string;
  label: string;
  icon: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className="bento-card"
      style={{
        background: accent ? "var(--brand-gold)" : "var(--card)",
        color: accent ? "var(--ink)" : "var(--card-foreground)",
        minHeight: 140,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <div className="flex items-center justify-between">
        <div
          className="eyebrow"
          style={{
            color: accent ? "rgba(34,34,34,0.7)" : "var(--brand-gold)",
          }}
        >
          {eyebrow}
        </div>
        <span style={{ opacity: 0.6 }}>{icon}</span>
      </div>
      <div>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 44,
            fontWeight: 700,
            letterSpacing: "-1.6px",
            lineHeight: 1,
          }}
        >
          {value}
        </div>
        <div
          style={{
            fontSize: 13,
            marginTop: 6,
            opacity: 0.8,
          }}
        >
          {label}
        </div>
      </div>
    </div>
  );
}

function ReelsBlock({
  label,
  text,
  italic,
}: {
  label: string;
  text: string;
  italic?: boolean;
}) {
  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 6 }}>
        {label}
      </div>
      <p
        style={{
          fontSize: 14,
          lineHeight: 1.5,
          color: "var(--foreground)",
          fontStyle: italic ? "italic" : "normal",
        }}
      >
        {text}
      </p>
    </div>
  );
}
