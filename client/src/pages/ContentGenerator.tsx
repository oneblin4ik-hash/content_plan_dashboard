import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import {
  Sparkles,
  Loader2,
  Copy,
  Check,
  Send,
  Wand2,
  Hash,
  Layers,
  ShieldCheck,
  AlertTriangle,
  Save,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Streamdown } from "streamdown";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { localLibrary, type Mode } from "@/lib/syncStorage";

const TONE_OPTIONS = [
  { v: "expert", label: "Эксперт", desc: "Авторитет, физиология, опыт зала" },
  { v: "friend", label: "Друг", desc: "Эмпатия, как с подругой за кофе" },
  { v: "provocative", label: "Провокатор", desc: "Цепляет на эмоциях" },
] as const;

const MODES: { v: Mode; label: string; icon: React.ComponentType<{ className?: string }>; desc: string }[] = [
  { v: "pack", label: "Полный пакет", icon: Layers, desc: "Пост + Reels + хуки + хештеги" },
  { v: "post", label: "Пост", icon: Wand2, desc: "Один полный пост" },
  { v: "reels", label: "Reels", icon: Sparkles, desc: "Сценарий для вертикального видео" },
  { v: "hooks", label: "Хуки", icon: Wand2, desc: "7 альтернативных первых фраз" },
  { v: "hashtags", label: "Хештеги", icon: Hash, desc: "15 релевантных тегов" },
  { v: "carousel", label: "Карусель", icon: Layers, desc: "7 слайдов для Instagram" },
];

const useTitleFromQuery = (set: (t: string) => void) => {
  const [location] = useLocation();
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const t = q.get("title");
    if (t) set(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);
};

/* persistence handled by syncStorage / sync.library tRPC */

export default function ContentGenerator() {
  const [title, setTitle] = useState("");
  const [mode, setMode] = useState<Mode>("pack");
  const [tone, setTone] = useState<"expert" | "friend" | "provocative">("expert");
  const [platform, setPlatform] = useState<"telegram" | "instagram">("instagram");
  const [length, setLength] = useState<"short" | "medium" | "long">("medium");
  const [duration, setDuration] = useState<"15-30s" | "30-60s">("15-30s");
  const [slides, setSlides] = useState(7);
  const [hookCount, setHookCount] = useState(7);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [voiceText, setVoiceText] = useState("");

  useTitleFromQuery(setTitle);
  const { workspaceKey, cloudEnabled } = useWorkspace();
  const cloudSave = trpc.sync.library.save.useMutation();

  const pack = trpc.content.generateFullPack.useMutation();
  const post = trpc.content.generatePost.useMutation();
  const reels = trpc.content.generateReelsScript.useMutation();
  const hooks = trpc.content.generateHooks.useMutation();
  const hashtags = trpc.content.generateHashtags.useMutation();
  const carousel = trpc.content.generateCarousel.useMutation();
  const validate = trpc.content.validateVoice.useQuery(
    { text: voiceText || "placeholder text for validation rule check" },
    { enabled: voiceText.length >= 20 }
  );

  const sendPostTG = trpc.telegram.sendPost.useMutation();
  const sendReelsTG = trpc.telegram.sendReelsScript.useMutation();

  const isLoading =
    pack.isPending ||
    post.isPending ||
    reels.isPending ||
    hooks.isPending ||
    hashtags.isPending ||
    carousel.isPending;

  const handleGenerate = async () => {
    if (!title.trim() || title.trim().length < 5) return;
    if (mode === "pack") await pack.mutateAsync({ title, platform });
    else if (mode === "post")
      await post.mutateAsync({ title, tone, platform, length });
    else if (mode === "reels")
      await reels.mutateAsync({ title, duration });
    else if (mode === "hooks")
      await hooks.mutateAsync({ title, count: hookCount });
    else if (mode === "hashtags") await hashtags.mutateAsync({ title, platform });
    else if (mode === "carousel") await carousel.mutateAsync({ title, slides });
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleSaveToLibrary = async () => {
    let payload: Record<string, unknown> | null = null;
    if (mode === "pack" && pack.data) payload = pack.data;
    if (mode === "post" && post.data) payload = post.data;
    if (mode === "reels" && reels.data) payload = reels.data;
    if (mode === "hooks" && hooks.data) payload = hooks.data;
    if (mode === "hashtags" && hashtags.data) payload = hashtags.data;
    if (mode === "carousel" && carousel.data) payload = carousel.data;
    if (!payload) return;

    if (cloudEnabled && workspaceKey) {
      try {
        await cloudSave.mutateAsync({
          workspaceKey,
          title,
          mode,
          platform: mode === "post" || mode === "pack" || mode === "hashtags" ? platform : undefined,
          payload,
        });
      } catch {
        // Fallback to local on cloud failure.
        localLibrary.add({
          id: crypto.randomUUID(),
          createdAt: Date.now(),
          title,
          mode,
          payload,
        });
      }
    } else {
      localLibrary.add({
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        title,
        mode,
        payload,
      });
    }
    setCopiedId("saved");
    setTimeout(() => setCopiedId(null), 1800);
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <section style={{ padding: "56px 0 16px" }}>
        <div className="container">
          <div className="eyebrow" style={{ marginBottom: 14 }}>
            Студия · Powered by Gemini 2.5 Flash
          </div>
          <h1>
            Один пакет —{" "}
            <span style={{ color: "var(--brand-gold)" }}>весь контент</span>{" "}
            вокруг темы.
          </h1>
          <p
            className="text-platinum"
            style={{ maxWidth: 680, fontSize: 18, lineHeight: 1.5, marginTop: 18 }}
          >
            Введи тему — получи пост, сценарий Reels, альтернативные хуки,
            релевантные хештеги и подпись. Голос настроен под Эдуарда: всегда «ты»,
            без канцеляризмов, без декоративных эмодзи.
          </p>
        </div>
      </section>

      {/* MODE PICKER */}
      <section style={{ padding: "24px 0" }}>
        <div className="container">
          <div
            className="grid gap-2"
            style={{
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            }}
          >
            {MODES.map((m) => {
              const active = mode === m.v;
              const Icon = m.icon;
              return (
                <button
                  key={m.v}
                  onClick={() => setMode(m.v)}
                  className="bento-card"
                  style={{
                    padding: 18,
                    textAlign: "left",
                    background: active ? "var(--brand-gold)" : "var(--card)",
                    color: active ? "var(--ink)" : "var(--card-foreground)",
                    cursor: "pointer",
                    border: 0,
                    boxShadow: active
                      ? "0 0 0 1px var(--gold-medal-edge), 0 8px 32px rgba(212,168,67,.25)"
                      : undefined,
                  }}
                >
                  <Icon className="w-5 h-5" />
                  <div
                    style={{
                      fontFamily: "var(--font-display)",
                      fontWeight: 700,
                      fontSize: 17,
                      marginTop: 10,
                      letterSpacing: "-0.3px",
                    }}
                  >
                    {m.label}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      marginTop: 4,
                      opacity: 0.8,
                    }}
                  >
                    {m.desc}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* INPUT */}
      <section style={{ padding: "16px 0 32px" }}>
        <div className="container">
          <div className="bento-card" style={{ padding: 28 }}>
            <div className="eyebrow" style={{ marginBottom: 14 }}>
              Тема контента
            </div>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder='Например: "Почему ПП-десерты — это ловушка"'
              style={{
                background: "var(--ink-3)",
                borderColor: "rgba(255,255,255,0.1)",
                color: "#fff",
                fontSize: 17,
                height: 56,
                borderRadius: 14,
                padding: "0 18px",
              }}
            />

            {/* MODE-specific controls */}
            <div className="grid gap-3 md:grid-cols-3" style={{ marginTop: 20 }}>
              {(mode === "post" || mode === "pack") && (
                <Selector
                  label="Платформа"
                  value={platform}
                  options={[
                    { v: "instagram", label: "Instagram" },
                    { v: "telegram", label: "Telegram" },
                  ]}
                  onChange={(v) => setPlatform(v as "instagram" | "telegram")}
                />
              )}
              {mode === "post" && (
                <>
                  <Selector
                    label="Тон"
                    value={tone}
                    options={TONE_OPTIONS.map((t) => ({ v: t.v, label: t.label }))}
                    onChange={(v) => setTone(v as typeof tone)}
                  />
                  <Selector
                    label="Длина"
                    value={length}
                    options={[
                      { v: "short", label: "Короткий (~250 слов)" },
                      { v: "medium", label: "Средний (~400 слов)" },
                      { v: "long", label: "Длинный (~800 слов)" },
                    ]}
                    onChange={(v) => setLength(v as typeof length)}
                  />
                </>
              )}
              {mode === "reels" && (
                <Selector
                  label="Длительность"
                  value={duration}
                  options={[
                    { v: "15-30s", label: "15–30 с" },
                    { v: "30-60s", label: "30–60 с" },
                  ]}
                  onChange={(v) => setDuration(v as typeof duration)}
                />
              )}
              {mode === "hooks" && (
                <Selector
                  label="Сколько хуков"
                  value={String(hookCount)}
                  options={[
                    { v: "3", label: "3" },
                    { v: "5", label: "5" },
                    { v: "7", label: "7" },
                    { v: "10", label: "10" },
                  ]}
                  onChange={(v) => setHookCount(Number(v))}
                />
              )}
              {mode === "carousel" && (
                <Selector
                  label="Слайдов"
                  value={String(slides)}
                  options={[
                    { v: "5", label: "5" },
                    { v: "6", label: "6" },
                    { v: "7", label: "7" },
                    { v: "8", label: "8" },
                    { v: "10", label: "10" },
                  ]}
                  onChange={(v) => setSlides(Number(v))}
                />
              )}
              {mode === "hashtags" && (
                <Selector
                  label="Платформа"
                  value={platform}
                  options={[
                    { v: "instagram", label: "Instagram" },
                    { v: "telegram", label: "Telegram" },
                  ]}
                  onChange={(v) => setPlatform(v as typeof platform)}
                />
              )}
            </div>

            <div style={{ marginTop: 24, display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button
                onClick={handleGenerate}
                disabled={isLoading || title.trim().length < 5}
                className="btn-gold gold-glow"
                style={{ padding: "14px 28px", fontSize: 15 }}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Генерирую...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" /> Сгенерировать
                  </>
                )}
              </button>
              <button
                onClick={handleSaveToLibrary}
                className="btn-gold"
                style={{ background: "var(--ink-2)", color: "#fff" }}
                disabled={
                  !pack.data &&
                  !post.data &&
                  !reels.data &&
                  !hooks.data &&
                  !hashtags.data &&
                  !carousel.data
                }
              >
                <Save className="w-4 h-4" />
                {copiedId === "saved" ? "Сохранено" : "В библиотеку"}
              </button>
            </div>

            {(pack.error ||
              post.error ||
              reels.error ||
              hooks.error ||
              hashtags.error ||
              carousel.error) && (
              <div
                style={{
                  marginTop: 16,
                  padding: 14,
                  borderRadius: 14,
                  background: "rgba(226,85,85,0.12)",
                  color: "#ffb3b3",
                  fontSize: 14,
                }}
              >
                Что-то отвалилось. Попробуй ещё раз через секунду.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* RESULTS */}
      <section style={{ padding: "16px 0 64px" }}>
        <div className="container grid gap-4">
          {mode === "pack" && pack.data && (
            <PackResult
              data={pack.data as never}
              onCopy={handleCopy}
              copiedId={copiedId}
              onSendPost={() =>
                sendPostTG.mutate({
                  title,
                  content: String((pack.data as Record<string, unknown>).post),
                })
              }
            />
          )}
          {mode === "post" && post.data && (
            <ResultCard
              title="Готовый пост"
              text={post.data.post}
              copyId="post"
              copiedId={copiedId}
              onCopy={handleCopy}
              onSend={() =>
                sendPostTG.mutate({ title: post.data!.title, content: post.data!.post })
              }
            />
          )}
          {mode === "reels" && reels.data && (
            <ResultCard
              title="Сценарий Reels"
              text={reels.data.script}
              copyId="reels"
              copiedId={copiedId}
              onCopy={handleCopy}
              onSend={() =>
                sendReelsTG.mutate({
                  title: reels.data!.title,
                  script: reels.data!.script,
                })
              }
            />
          )}
          {mode === "hooks" && hooks.data && (
            <div className="bento-card" style={{ padding: 28 }}>
              <div className="eyebrow" style={{ marginBottom: 14 }}>
                Хуки · {hooks.data.hooks.length} вариантов
              </div>
              <div className="grid gap-2">
                {hooks.data.hooks.map((h, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "14px 18px",
                      background: "var(--ink-3)",
                      borderRadius: 14,
                      display: "flex",
                      gap: 14,
                      alignItems: "center",
                    }}
                  >
                    <div
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: 22,
                        fontWeight: 700,
                        color: "var(--brand-gold)",
                        minWidth: 30,
                      }}
                    >
                      {i + 1}
                    </div>
                    <p style={{ flex: 1, fontSize: 15, lineHeight: 1.4 }}>{h}</p>
                    <button
                      onClick={() => handleCopy(h, `hook-${i}`)}
                      style={{
                        background: "transparent",
                        border: 0,
                        color: "var(--brand-platinum)",
                        cursor: "pointer",
                      }}
                    >
                      {copiedId === `hook-${i}` ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {mode === "hashtags" && hashtags.data && (
            <div className="bento-card" style={{ padding: 28 }}>
              <div className="eyebrow" style={{ marginBottom: 14 }}>
                Хештеги · {hashtags.data.hashtags.length}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {hashtags.data.hashtags.map((t) => (
                  <span
                    key={t}
                    onClick={() => handleCopy(t, t)}
                    style={{
                      padding: "8px 14px",
                      background: "var(--gold-soft-fill)",
                      color: "var(--brand-gold)",
                      borderRadius: 9999,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      border: "1px solid var(--gold-medal-edge)",
                    }}
                  >
                    {t}
                  </span>
                ))}
              </div>
              <button
                onClick={() => handleCopy(hashtags.data!.hashtags.join(" "), "all-tags")}
                className="btn-gold"
                style={{
                  background: "var(--ink-2)",
                  color: "#fff",
                  marginTop: 20,
                }}
              >
                {copiedId === "all-tags" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                Скопировать все
              </button>
            </div>
          )}
          {mode === "carousel" && carousel.data && (
            <ResultCard
              title={`Карусель · ${carousel.data.slides} слайдов`}
              text={carousel.data.carousel}
              copyId="carousel"
              copiedId={copiedId}
              onCopy={handleCopy}
            />
          )}
        </div>
      </section>

      {/* BRAND-VOICE VALIDATOR */}
      <section style={{ padding: "32px 0 96px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="container">
          <div className="eyebrow" style={{ marginBottom: 14 }}>
            Brand-voice checker
          </div>
          <h2 style={{ marginBottom: 12, fontSize: 36 }}>
            Проверь свой текст. <span style={{ color: "var(--brand-gold)" }}>Звучит как Эдуард?</span>
          </h2>
          <p
            className="text-platinum"
            style={{ maxWidth: 620, fontSize: 16, marginBottom: 24 }}
          >
            Локальный валидатор: ищет «вы», канцеляризмы, агрессивный sales и
            декоративные эмодзи. Запускается, как только в поле ≥ 20 символов.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <textarea
              value={voiceText}
              onChange={(e) => setVoiceText(e.target.value)}
              placeholder="Вставь свой пост или Reels-сценарий..."
              rows={10}
              style={{
                background: "var(--ink-3)",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 20,
                padding: 20,
                fontFamily: "var(--font-body)",
                fontSize: 15,
                lineHeight: 1.5,
                resize: "vertical",
                width: "100%",
              }}
            />
            <div className="bento-card" style={{ padding: 24 }}>
              {!validate.data && voiceText.length < 20 && (
                <p className="text-platinum" style={{ fontSize: 14 }}>
                  Минимум 20 символов — и тут появится оценка.
                </p>
              )}
              {validate.data && (
                <>
                  <div className="flex items-center justify-between" style={{ marginBottom: 18 }}>
                    <div
                      style={{
                        fontFamily: "var(--font-display)",
                        fontWeight: 700,
                        fontSize: 64,
                        letterSpacing: "-2px",
                        lineHeight: 1,
                        color: validate.data.passed
                          ? "var(--brand-gold)"
                          : "#e25555",
                      }}
                    >
                      {validate.data.score}
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div className="eyebrow">Оценка</div>
                      <div style={{ fontSize: 13, marginTop: 6, color: "var(--brand-platinum)" }}>
                        {validate.data.wordCount} слов
                      </div>
                    </div>
                  </div>
                  {validate.data.passed ? (
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "8px 14px",
                        borderRadius: 9999,
                        background: "rgba(212,168,67,0.12)",
                        color: "var(--brand-gold)",
                        fontWeight: 600,
                        fontSize: 13,
                      }}
                    >
                      <ShieldCheck className="w-4 h-4" /> Голос Эдуарда — на месте
                    </div>
                  ) : (
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "8px 14px",
                        borderRadius: 9999,
                        background: "rgba(226,85,85,0.12)",
                        color: "#ffb3b3",
                        fontWeight: 600,
                        fontSize: 13,
                      }}
                    >
                      <AlertTriangle className="w-4 h-4" /> Есть нарушения голоса
                    </div>
                  )}
                  <ul
                    style={{
                      listStyle: "none",
                      padding: 0,
                      margin: "18px 0 0",
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    {validate.data.issues.length === 0 && (
                      <li style={{ fontSize: 14, color: "var(--brand-platinum)" }}>
                        Замечаний нет. Можно публиковать.
                      </li>
                    )}
                    {validate.data.issues.map((iss, i) => (
                      <li
                        key={i}
                        style={{
                          padding: "10px 14px",
                          borderRadius: 12,
                          background: "var(--ink-3)",
                          fontSize: 13,
                          color: iss.severity === "error" ? "#ffb3b3" : "var(--brand-platinum)",
                          display: "flex",
                          gap: 10,
                          alignItems: "flex-start",
                        }}
                      >
                        <span
                          style={{
                            padding: "1px 7px",
                            borderRadius: 9999,
                            background:
                              iss.severity === "error"
                                ? "rgba(226,85,85,0.25)"
                                : "rgba(212,168,67,0.18)",
                            color:
                              iss.severity === "error" ? "#ffb3b3" : "var(--brand-gold)",
                            fontSize: 10,
                            fontWeight: 700,
                            letterSpacing: 1,
                            textTransform: "uppercase",
                            flexShrink: 0,
                          }}
                        >
                          {iss.severity === "error" ? "Стоп" : "Подумай"}
                        </span>
                        <span style={{ flex: 1 }}>
                          {iss.rule}
                          {iss.example && (
                            <em
                              style={{
                                color: "var(--muted-foreground)",
                                marginLeft: 6,
                                fontStyle: "normal",
                              }}
                            >
                              — найдено: «{iss.example}»
                            </em>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function Selector({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { v: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 8 }}>
        {label}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          height: 44,
          padding: "0 14px",
          borderRadius: 12,
          background: "var(--ink-3)",
          color: "#fff",
          border: "1px solid rgba(255,255,255,0.1)",
          fontFamily: "var(--font-body)",
          fontSize: 14,
          fontWeight: 500,
        }}
      >
        {options.map((o) => (
          <option key={o.v} value={o.v} style={{ background: "#222" }}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function ResultCard({
  title,
  text,
  copyId,
  copiedId,
  onCopy,
  onSend,
}: {
  title: string;
  text: string;
  copyId: string;
  copiedId: string | null;
  onCopy: (text: string, id: string) => void;
  onSend?: () => void;
}) {
  return (
    <div className="bento-card" style={{ padding: 28 }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
        <div className="eyebrow">{title}</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => onCopy(text, copyId)}
            className="btn-gold"
            style={{ background: "var(--ink-2)", color: "#fff", padding: "8px 14px", fontSize: 13 }}
          >
            {copiedId === copyId ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copiedId === copyId ? "Скопировано" : "Скопировать"}
          </button>
          {onSend && (
            <button
              onClick={onSend}
              className="btn-gold"
              style={{ padding: "8px 14px", fontSize: 13 }}
            >
              <Send className="w-4 h-4" />В Telegram
            </button>
          )}
        </div>
      </div>
      <div
        style={{
          fontFamily: "var(--font-body)",
          fontSize: 15,
          lineHeight: 1.6,
          color: "var(--brand-platinum)",
          whiteSpace: "pre-wrap",
        }}
      >
        <Streamdown>{text}</Streamdown>
      </div>
    </div>
  );
}

function PackResult({
  data,
  onCopy,
  copiedId,
  onSendPost,
}: {
  data: {
    post?: string;
    reelsScript?: string;
    hooks?: string[];
    hashtags?: string[];
    caption?: string;
    parseError?: boolean;
  };
  onCopy: (text: string, id: string) => void;
  copiedId: string | null;
  onSendPost: () => void;
}) {
  return (
    <>
      {data.parseError && (
        <div
          className="bento-card"
          style={{
            background: "rgba(226,85,85,0.1)",
            padding: 16,
            fontSize: 13,
            color: "#ffb3b3",
          }}
        >
          Не получилось распарсить структурированный ответ — показываю сырой текст.
        </div>
      )}
      {data.post && (
        <ResultCard
          title="Пост"
          text={data.post}
          copyId="pack-post"
          copiedId={copiedId}
          onCopy={onCopy}
          onSend={onSendPost}
        />
      )}
      {data.reelsScript && (
        <ResultCard
          title="Reels-сценарий"
          text={data.reelsScript}
          copyId="pack-reels"
          copiedId={copiedId}
          onCopy={onCopy}
        />
      )}
      {data.caption && (
        <ResultCard
          title="Подпись"
          text={data.caption}
          copyId="pack-caption"
          copiedId={copiedId}
          onCopy={onCopy}
        />
      )}
      {data.hooks && data.hooks.length > 0 && (
        <div className="bento-card" style={{ padding: 28 }}>
          <div className="eyebrow" style={{ marginBottom: 14 }}>
            Альтернативные хуки
          </div>
          <div className="grid gap-2">
            {data.hooks.map((h, i) => (
              <div
                key={i}
                style={{
                  padding: "12px 16px",
                  background: "var(--ink-3)",
                  borderRadius: 14,
                  fontSize: 14,
                  lineHeight: 1.5,
                }}
              >
                <span
                  style={{
                    color: "var(--brand-gold)",
                    fontWeight: 700,
                    marginRight: 8,
                  }}
                >
                  {i + 1}.
                </span>
                {h}
              </div>
            ))}
          </div>
        </div>
      )}
      {data.hashtags && data.hashtags.length > 0 && (
        <div className="bento-card" style={{ padding: 28 }}>
          <div className="eyebrow" style={{ marginBottom: 14 }}>
            Хештеги
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {data.hashtags.map((t) => (
              <span
                key={t}
                style={{
                  padding: "6px 12px",
                  background: "var(--gold-soft-fill)",
                  color: "var(--brand-gold)",
                  borderRadius: 9999,
                  fontSize: 12,
                  fontWeight: 600,
                  border: "1px solid var(--gold-medal-edge)",
                }}
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
