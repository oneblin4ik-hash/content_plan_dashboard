import { useEffect, useState } from "react";
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
  Brain,
  BarChart3,
  ArrowRight,
} from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Streamdown } from "streamdown";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { localLibrary, type Mode } from "@/lib/syncStorage";

/* 8 тонов — синхронизировано с TONES в server/routers/content.ts */
const TONE_OPTIONS = [
  { v: "expert", label: "Эксперт" },
  { v: "friend", label: "Друг" },
  { v: "provocative", label: "Провокатор" },
  { v: "tough_champion", label: "Жёсткий чемпион" },
  { v: "caring_mentor", label: "Заботливый наставник" },
  { v: "ironic_humor", label: "Ироничный юмор" },
  { v: "motivational_drive", label: "Мотивационный драйв" },
  { v: "mythbuster", label: "Разоблачитель мифов" },
] as const;
type Tone = (typeof TONE_OPTIONS)[number]["v"];

/* 10 рубрик — синхронизировано с RUBRICS в server/routers/content.ts.
   Подстановка структуры идёт на сервере, тут только лейблы. */
const RUBRICS = [
  { v: "general", label: "Общая" },
  { v: "lifehack", label: "Лайфхак" },
  { v: "overheard", label: "🎙 Подслушано у тренера" },
  { v: "case", label: "Кейс клиента" },
  { v: "personal_story", label: "Личная история Эдуарда" },
  { v: "myth_debunk", label: "Разбор мифа" },
  { v: "checklist", label: "Чек-лист" },
  { v: "before_after", label: "До / после" },
  { v: "q_and_a", label: "Вопрос — ответ" },
  { v: "science", label: "Научный разбор" },
] as const;
type Rubric = (typeof RUBRICS)[number]["v"];

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

export default function ContentGenerator() {
  const [title, setTitle] = useState("");
  const [mode, setMode] = useState<Mode>("pack");
  const [tone, setTone] = useState<Tone>("expert");
  const [platform, setPlatform] = useState<"telegram" | "instagram">("instagram");
  const [length, setLength] = useState<"short" | "medium" | "long">("medium");
  const [duration, setDuration] = useState<"15-30s" | "30-60s">("15-30s");
  const [slides, setSlides] = useState(7);
  const [hookCount, setHookCount] = useState(7);
  const [rubric, setRubric] = useState<Rubric>("general");
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
  const refine = trpc.content.refine.useMutation();

  /* inline-редактор: текст, инструкция, локальная история версий */
  const [refineInstruction, setRefineInstruction] = useState("");
  const [refinedOverrides, setRefinedOverrides] = useState<Record<string, string>>({});
  const [refineHistory, setRefineHistory] = useState<Record<string, string[]>>({});

  const applyRefine = async (
    key: "post" | "reels" | "carousel" | "hook" | "free",
    original: string,
  ) => {
    if (!refineInstruction.trim() || refineInstruction.trim().length < 3) return;
    const r = await refine.mutateAsync({
      original,
      instruction: refineInstruction.trim(),
      kind: key,
      workspaceKey: workspaceKey || undefined,
    });
    setRefinedOverrides((s) => ({ ...s, [key]: r.refined }));
    setRefineHistory((s) => ({
      ...s,
      [key]: [...(s[key] ?? []), original].slice(-5),
    }));
    setRefineInstruction("");
  };

  const undoRefine = (key: "post" | "reels" | "carousel" | "hook" | "free") => {
    const stack = refineHistory[key] ?? [];
    if (!stack.length) return;
    const prev = stack[stack.length - 1];
    setRefinedOverrides((s) => ({ ...s, [key]: prev }));
    setRefineHistory((s) => ({ ...s, [key]: stack.slice(0, -1) }));
  };
  /* Статистика «петли результата» — что подмешивается в промпт. */
  const contextStats = trpc.content.contextStats.useQuery(
    { workspaceKey },
    { enabled: cloudEnabled, refetchOnWindowFocus: false },
  );
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

  /* рубрика теперь применяется на сервере через input.rubric — не нужно
     ничего вшивать в title */
  const handleGenerate = async () => {
    if (!title.trim() || title.trim().length < 5) return;
    const wk = workspaceKey || undefined;
    if (mode === "pack")
      await pack.mutateAsync({ title, platform, tone, rubric, workspaceKey: wk });
    else if (mode === "post")
      await post.mutateAsync({ title, tone, platform, length, rubric, workspaceKey: wk });
    else if (mode === "reels")
      await reels.mutateAsync({ title, duration, workspaceKey: wk });
    else if (mode === "hooks")
      await hooks.mutateAsync({ title, count: hookCount, workspaceKey: wk });
    else if (mode === "hashtags")
      await hashtags.mutateAsync({ title, platform, workspaceKey: wk });
    else if (mode === "carousel")
      await carousel.mutateAsync({ title, slides, workspaceKey: wk });
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
          platform:
            mode === "post" || mode === "pack" || mode === "hashtags"
              ? platform
              : undefined,
          payload,
        });
      } catch {
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
            <span style={{ color: "var(--brand-gold)" }}>весь контент</span> вокруг темы.
          </h1>
          <p
            className="text-platinum"
            style={{ maxWidth: 680, fontSize: 18, lineHeight: 1.5, marginTop: 18 }}
          >
            Введи тему — получи пост, сценарий Reels, альтернативные хуки,
            релевантные хештеги и подпись. Голос настроен под Эдуарда: всегда «ты»,
            без канцеляризмов, без декоративных эмодзи.
          </p>

          {/* Петля результата: badge показывает, что генератор учитывает
              реальные данные пользователя (его метрики + анализ конкурентов).
              Если данных нет — мягкая подсказка как их добавить. */}
          {cloudEnabled && contextStats.data && (
            <ContextLoopBadge stats={contextStats.data} />
          )}
        </div>
      </section>

      <section style={{ padding: "24px 0" }}>
        <div className="container">
          <div
            className="grid gap-2"
            style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}
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
                  <div style={{ fontSize: 12, marginTop: 4, opacity: 0.8 }}>
                    {m.desc}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

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

            <div className="grid gap-3 md:grid-cols-3" style={{ marginTop: 20 }}>
              <Selector
                label="Рубрика"
                value={rubric}
                options={RUBRICS.map((r) => ({ v: r.v, label: r.label }))}
                onChange={(v) => setRubric(v as Rubric)}
              />
              {(mode === "post" || mode === "pack" || mode === "hashtags") && (
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
              {(mode === "post" || mode === "pack") && (
                <Selector
                  label="Тон"
                  value={tone}
                  options={TONE_OPTIONS.map((t) => ({ v: t.v, label: t.label }))}
                  onChange={(v) => setTone(v as Tone)}
                />
              )}
              {mode === "post" && (
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
                {copiedId === "saved"
                  ? cloudEnabled
                    ? "В облаке"
                    : "Сохранено"
                  : "В библиотеку"}
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

      <section style={{ padding: "16px 0 64px" }}>
        <div className="container grid gap-4">
          <ModelBadge
            model={
              (mode === "pack" && pack.data?.model) ||
              (mode === "post" && post.data?.model) ||
              (mode === "reels" && reels.data?.model) ||
              (mode === "hooks" && hooks.data?.model) ||
              (mode === "hashtags" && hashtags.data?.model) ||
              (mode === "carousel" && carousel.data?.model) ||
              ""
            }
          />
          {mode === "pack" && pack.data && (
            <PackResult
              data={pack.data as never}
              onCopy={handleCopy}
              copiedId={copiedId}
              onSendPost={() =>
                sendPostTG.mutate({
                  title,
                  content: String((pack.data as Record<string, unknown>).post),
                  workspaceKey,
                })
              }
            />
          )}
          {mode === "post" && post.data && (
            <ResultCard
              title="Готовый пост"
              text={refinedOverrides.post ?? post.data.post}
              copyId="post"
              copiedId={copiedId}
              onCopy={handleCopy}
              onSend={() =>
                sendPostTG.mutate({
                  title: post.data!.title,
                  content: refinedOverrides.post ?? post.data!.post,
                  workspaceKey,
                })
              }
            />
          )}
          {mode === "reels" && reels.data && (
            <ResultCard
              title="Сценарий Reels"
              text={refinedOverrides.reels ?? reels.data.script}
              copyId="reels"
              copiedId={copiedId}
              onCopy={handleCopy}
              onSend={() =>
                sendReelsTG.mutate({
                  title: reels.data!.title,
                  script: refinedOverrides.reels ?? reels.data!.script,
                  workspaceKey,
                })
              }
            />
          )}
          {mode === "hooks" && hooks.data && (
            <div className="bento-card" style={{ padding: 28 }}>
              <div className="eyebrow" style={{ marginBottom: 14 }}>
                Хуки · {hooks.data.hooks.length} вариантов · отсортированы
                по predicted engagement
              </div>
              <div className="grid gap-2">
                {hooks.data.hooks.map((h, i) => {
                  const scoreColor =
                    h.score >= 9
                      ? "#3ecf8e"
                      : h.score >= 7
                        ? "var(--brand-gold)"
                        : h.score >= 5
                          ? "#c9a35a"
                          : "#a07474";
                  return (
                    <div
                      key={i}
                      style={{
                        padding: "14px 18px",
                        background: "var(--ink-3)",
                        borderRadius: 14,
                        display: "flex",
                        gap: 14,
                        alignItems: "flex-start",
                      }}
                    >
                      <div
                        style={{
                          fontFamily: "var(--font-display)",
                          fontSize: 28,
                          fontWeight: 700,
                          color: scoreColor,
                          minWidth: 52,
                          textAlign: "center",
                          lineHeight: 1,
                          paddingTop: 2,
                        }}
                        title={`Predicted engagement: ${h.score}/10`}
                      >
                        {h.score}
                        <div
                          style={{
                            fontSize: 9,
                            fontWeight: 500,
                            color: "var(--brand-platinum)",
                            opacity: 0.6,
                            marginTop: 2,
                            letterSpacing: "0.5px",
                          }}
                        >
                          / 10
                        </div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 15, lineHeight: 1.4 }}>
                          {h.text}
                        </p>
                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            flexWrap: "wrap",
                            marginTop: 6,
                            alignItems: "center",
                          }}
                        >
                          <span
                            style={{
                              fontSize: 11,
                              padding: "2px 8px",
                              background: "var(--gold-soft-fill)",
                              color: "var(--brand-gold)",
                              borderRadius: 9999,
                              fontWeight: 600,
                            }}
                          >
                            Паттерн {h.pattern}
                          </span>
                          <span
                            className="text-platinum"
                            style={{
                              fontSize: 12,
                              opacity: 0.7,
                              lineHeight: 1.4,
                            }}
                          >
                            {h.reason}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleCopy(h.text, `hook-${i}`)}
                        style={{
                          background: "transparent",
                          border: 0,
                          color: "var(--brand-platinum)",
                          cursor: "pointer",
                          padding: 4,
                          alignSelf: "center",
                        }}
                        title="Скопировать"
                      >
                        {copiedId === `hook-${i}` ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  );
                })}
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
                onClick={() =>
                  handleCopy(hashtags.data!.hashtags.join(" "), "all-tags")
                }
                className="btn-gold"
                style={{
                  background: "var(--ink-2)",
                  color: "#fff",
                  marginTop: 20,
                }}
              >
                {copiedId === "all-tags" ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                Скопировать все
              </button>
            </div>
          )}
          {mode === "carousel" && carousel.data && (
            <ResultCard
              title={`Карусель · ${carousel.data.slides} слайдов`}
              text={refinedOverrides.carousel ?? carousel.data.carousel}
              copyId="carousel"
              copiedId={copiedId}
              onCopy={handleCopy}
            />
          )}

          {/* INLINE REFINE — появляется после готовой генерации post/reels/carousel */}
          {(post.data || reels.data || carousel.data) &&
            (mode === "post" || mode === "reels" || mode === "carousel") && (
              <div
                className="bento-card"
                style={{ padding: 24, marginTop: 16 }}
              >
                <div className="eyebrow" style={{ marginBottom: 10 }}>
                  Доработать
                </div>
                <p
                  className="text-platinum"
                  style={{ fontSize: 14, marginBottom: 14 }}
                >
                  Напиши, что поправить — Эдуард отредактирует точечно, не
                  переписывая всё заново. До 5 версий в истории.
                </p>
                <textarea
                  value={refineInstruction}
                  onChange={(e) => setRefineInstruction(e.target.value)}
                  placeholder="Например: «Сократи на треть и добавь провокацию в хук»"
                  rows={2}
                  style={{
                    background: "var(--ink-3)",
                    color: "#fff",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 14,
                    padding: 12,
                    fontFamily: "var(--font-body)",
                    fontSize: 14,
                    width: "100%",
                    resize: "vertical",
                  }}
                />
                <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                  <button
                    onClick={() => {
                      const text =
                        mode === "post"
                          ? refinedOverrides.post ?? post.data?.post ?? ""
                          : mode === "reels"
                            ? refinedOverrides.reels ?? reels.data?.script ?? ""
                            : refinedOverrides.carousel ??
                              carousel.data?.carousel ??
                              "";
                      const kind: "post" | "reels" | "carousel" =
                        mode === "post"
                          ? "post"
                          : mode === "reels"
                            ? "reels"
                            : "carousel";
                      applyRefine(kind, text);
                    }}
                    disabled={
                      refine.isPending || refineInstruction.trim().length < 3
                    }
                    className="btn-gold"
                    style={{ padding: "10px 20px", fontSize: 14 }}
                  >
                    {refine.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Правлю...
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-4 h-4" /> Доработать
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      const kind: "post" | "reels" | "carousel" =
                        mode === "post"
                          ? "post"
                          : mode === "reels"
                            ? "reels"
                            : "carousel";
                      undoRefine(kind);
                    }}
                    disabled={
                      (refineHistory[
                        mode === "post"
                          ? "post"
                          : mode === "reels"
                            ? "reels"
                            : "carousel"
                      ]?.length ?? 0) === 0
                    }
                    className="btn-gold"
                    style={{
                      background: "var(--ink-2)",
                      color: "#fff",
                      padding: "10px 20px",
                      fontSize: 14,
                    }}
                  >
                    Откатить
                  </button>
                  {refinedOverrides[
                    mode === "post"
                      ? "post"
                      : mode === "reels"
                        ? "reels"
                        : "carousel"
                  ] && (
                    <span
                      className="text-platinum"
                      style={{
                        fontSize: 12,
                        alignSelf: "center",
                        opacity: 0.7,
                      }}
                    >
                      Версий в истории:{" "}
                      {refineHistory[
                        mode === "post"
                          ? "post"
                          : mode === "reels"
                            ? "reels"
                            : "carousel"
                      ]?.length ?? 0}
                    </span>
                  )}
                </div>
              </div>
            )}
        </div>
      </section>

      <section
        style={{
          padding: "32px 0 96px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="container">
          <div className="eyebrow" style={{ marginBottom: 14 }}>
            Brand-voice checker
          </div>
          <h2 style={{ marginBottom: 12, fontSize: 36 }}>
            Проверь свой текст.{" "}
            <span style={{ color: "var(--brand-gold)" }}>Звучит как Эдуард?</span>
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
                  <div
                    className="flex items-center justify-between"
                    style={{ marginBottom: 18 }}
                  >
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
                      <div
                        style={{
                          fontSize: 13,
                          marginTop: 6,
                          color: "var(--brand-platinum)",
                        }}
                      >
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
                          color:
                            iss.severity === "error"
                              ? "#ffb3b3"
                              : "var(--brand-platinum)",
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
                              iss.severity === "error"
                                ? "#ffb3b3"
                                : "var(--brand-gold)",
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

/* Бэйдж «петли результата» — показывается под описанием Студии и
   делает видимым, какие данные подмешиваются в системный промпт:
   - сколько твоих постов учитывается (топ/худшие из post_metrics)
   - сколько проанализированных конкурентов даёт recommendations
   Если данных нет — мягкая инструкция как заполнить (linkки на разделы). */
function ContextLoopBadge({
  stats,
}: {
  stats: { metrics: number; competitors: number; enabled: boolean };
}) {
  const { metrics, competitors, enabled } = stats;
  if (enabled) {
    const parts: string[] = [];
    if (metrics >= 3) parts.push(`${metrics} твоих постов`);
    if (competitors > 0)
      parts.push(`${competitors} ${competitors === 1 ? "конкурента" : "конкурентов"}`);
    return (
      <div
        style={{
          marginTop: 20,
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 16px",
          borderRadius: 14,
          background: "rgba(62,207,142,0.08)",
          border: "1px solid rgba(62,207,142,0.25)",
          color: "#3ecf8e",
          fontSize: 13,
          lineHeight: 1.4,
        }}
        title="Эти данные подмешиваются в системный промпт перед каждой генерацией"
      >
        <Brain className="w-4 h-4" style={{ flexShrink: 0 }} />
        <span>
          <strong style={{ fontWeight: 700 }}>Петля включена:</strong> учитываю{" "}
          {parts.join(" + ")} при генерации.
        </span>
      </div>
    );
  }
  /* Петля выключена — мягко зову заполнить данные. */
  return (
    <div
      style={{
        marginTop: 20,
        padding: "12px 16px",
        borderRadius: 14,
        background: "rgba(212,168,67,0.06)",
        border: "1px solid rgba(212,168,67,0.18)",
        display: "flex",
        gap: 12,
        flexWrap: "wrap",
        alignItems: "center",
        fontSize: 13,
        lineHeight: 1.4,
      }}
    >
      <Brain
        className="w-4 h-4"
        style={{ color: "var(--brand-gold)", flexShrink: 0 }}
      />
      <span className="text-platinum" style={{ flex: 1, minWidth: 200 }}>
        Чтобы генератор учился на твоих результатах, заполни метрики
        постов и проанализируй пару конкурентов.
      </span>
      <Link href="/analytics">
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            color: "var(--brand-gold)",
            fontWeight: 600,
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          Открыть Аналитику
          <ArrowRight className="w-3.5 h-3.5" />
        </span>
      </Link>
    </div>
  );
}

/* Бэйдж модели — показывается над результатом генерации.
   Если на проде сработал fallback с 3.5 на 2.5 (например из-за
   daily quota AI Studio free tier), это видно сразу. */
function ModelBadge({ model }: { model: string }) {
  if (!model) return null;
  const lower = model.toLowerCase();
  const is35 = lower.includes("3.5") || lower.includes("3-5");
  const is3 = !is35 && (lower.includes("gemini-3") || lower.startsWith("gemini-3"));
  const isTopTier = is35 || is3;
  const label = is35
    ? "Gemini 3.5 Flash · максимум качества"
    : is3
      ? "Gemini 3 Flash"
      : lower.includes("2.5")
        ? "Gemini 2.5 Flash · fallback"
        : model;
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 9999,
        background: isTopTier
          ? "rgba(62,207,142,0.12)"
          : "rgba(212,168,67,0.10)",
        color: isTopTier ? "#3ecf8e" : "var(--brand-gold)",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 1.2,
        textTransform: "uppercase",
        width: "max-content",
      }}
      title={`Ответ сгенерирован моделью ${model}`}
    >
      <Sparkles className="w-3 h-3" />
      {label}
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
      <div
        className="flex items-center justify-between"
        style={{ marginBottom: 16 }}
      >
        <div className="eyebrow">{title}</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => onCopy(text, copyId)}
            className="btn-gold"
            style={{
              background: "var(--ink-2)",
              color: "#fff",
              padding: "8px 14px",
              fontSize: 13,
            }}
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
