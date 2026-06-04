import { useState } from "react";
import { Link } from "wouter";
import { Microscope, Loader2, Link2, FileText, Sparkles } from "lucide-react";
import { Streamdown } from "streamdown";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { CostBadge } from "@/components/CostBadge";

/* ============================================================
   /analyze — «Разбор чужого поста». Вставляешь ссылку (Telegram) или
   текст удачного поста → AI объясняет, почему он работает, и как
   применить приёмы в твоём голосе. Аналог AI-разбора Reels у Virale,
   но в формате, который мы реально можем сделать без ASR.
   ============================================================ */

type Mode = "url" | "text";

export default function Analyze() {
  const [mode, setMode] = useState<Mode>("url");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const analyze = trpc.analyze.analyzePost.useMutation();

  const run = async () => {
    if (analyze.isPending) return;
    try {
      await analyze.mutateAsync(
        mode === "url" ? { url: url.trim() } : { text: text.trim() },
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось разобрать");
    }
  };

  const canRun =
    mode === "url" ? url.trim().length > 8 : text.trim().length >= 40;

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <section style={{ padding: "40px 0 16px" }}>
        <div className="container" style={{ maxWidth: 820 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>
            <Microscope
              className="w-3.5 h-3.5"
              style={{ display: "inline", marginRight: 6 }}
            />
            Разбор поста
          </div>
          <h1 style={{ letterSpacing: "-0.6px" }}>
            Учись на{" "}
            <span style={{ color: "var(--brand-gold)" }}>чужом успехе</span>
          </h1>
          <p
            className="text-platinum"
            style={{ maxWidth: 620, fontSize: 15, marginTop: 14, lineHeight: 1.5 }}
          >
            Вставь ссылку на удачный пост в Telegram или просто его текст — AI
            разберёт, почему он цепляет, и подскажет, как применить эти приёмы
            в твоём голосе.
          </p>
        </div>
      </section>

      <section style={{ padding: "8px 0 96px" }}>
        <div className="container" style={{ maxWidth: 820 }}>
          <div className="bento-card" style={{ padding: 24 }}>
            {/* Переключатель источника */}
            <div
              style={{
                display: "inline-flex",
                gap: 4,
                padding: 4,
                background: "var(--ink-3)",
                borderRadius: 9999,
                marginBottom: 18,
              }}
            >
              {(
                [
                  ["url", "По ссылке", Link2],
                  ["text", "Вставить текст", FileText],
                ] as const
              ).map(([k, label, Icon]) => (
                <button
                  key={k}
                  onClick={() => setMode(k)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 16px",
                    borderRadius: 9999,
                    border: 0,
                    fontSize: 13,
                    fontWeight: 600,
                    background: mode === k ? "var(--brand-gold)" : "transparent",
                    color: mode === k ? "var(--ink)" : "var(--brand-platinum)",
                    cursor: "pointer",
                  }}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>

            {mode === "url" ? (
              <div>
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && canRun && run()}
                  placeholder="https://t.me/durov/123"
                  style={{
                    width: "100%",
                    height: 48,
                    padding: "0 16px",
                    background: "var(--ink-3)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 12,
                    color: "#fff",
                    fontSize: 15,
                    outline: "none",
                  }}
                />
                <p
                  style={{
                    fontSize: 12,
                    color: "var(--muted-foreground)",
                    marginTop: 8,
                    lineHeight: 1.5,
                  }}
                >
                  Поддерживаются ссылки на посты Telegram (t.me/канал/номер).
                  Для Instagram/TikTok скопируй текст поста и вставь его во
                  вкладке «Вставить текст».
                </p>
              </div>
            ) : (
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Вставь сюда текст поста, который хочешь разобрать..."
                rows={8}
                style={{
                  width: "100%",
                  padding: 16,
                  background: "var(--ink-3)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 12,
                  color: "#fff",
                  fontSize: 15,
                  lineHeight: 1.5,
                  outline: "none",
                  resize: "vertical",
                  fontFamily: "var(--font-body)",
                }}
              />
            )}

            <button
              onClick={run}
              disabled={!canRun || analyze.isPending}
              className="btn-gold"
              style={{
                marginTop: 16,
                padding: "12px 24px",
                fontSize: 14,
                opacity: !canRun || analyze.isPending ? 0.5 : 1,
              }}
            >
              {analyze.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Разбираю...
                </>
              ) : (
                <>
                  <Microscope className="w-4 h-4" /> Разобрать пост
                  <CostBadge action="analyzePost" />
                </>
              )}
            </button>
          </div>

          {/* Результат */}
          {analyze.data && (
            <div className="bento-card" style={{ padding: 28, marginTop: 18 }}>
              {analyze.data.source === "telegram" &&
                analyze.data.extractedText && (
                  <details
                    style={{
                      marginBottom: 20,
                      padding: "12px 16px",
                      background: "var(--ink-3)",
                      borderRadius: 10,
                    }}
                  >
                    <summary
                      style={{
                        cursor: "pointer",
                        fontSize: 12,
                        color: "var(--muted-foreground)",
                        fontWeight: 600,
                      }}
                    >
                      Текст поста, который я прочитал
                    </summary>
                    <p
                      className="text-platinum"
                      style={{
                        fontSize: 13,
                        lineHeight: 1.5,
                        marginTop: 10,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {analyze.data.extractedText}
                    </p>
                  </details>
                )}

              <div className="assistant-md">
                <Streamdown>{analyze.data.analysis}</Streamdown>
              </div>

              <div
                style={{
                  marginTop: 22,
                  paddingTop: 18,
                  borderTop: "1px solid rgba(255,255,255,0.06)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 12,
                }}
              >
                <span
                  style={{ fontSize: 12, color: "var(--muted-foreground)" }}
                >
                  Понравился приём? Примени его на своей теме.
                </span>
                <Link href="/generator">
                  <span
                    className="btn-gold"
                    style={{ padding: "10px 18px", fontSize: 13, cursor: "pointer" }}
                  >
                    <Sparkles className="w-4 h-4" />
                    В Студию
                  </span>
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
