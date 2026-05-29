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
  Plus,
  Loader2,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { allContentTopics, allReelsScripts, allTactics, type ContentTopic } from "@/lib/contentData";
import { trpc } from "@/lib/trpc";
import { useWorkspace } from "@/contexts/WorkspaceContext";

const staticTopics = allContentTopics;
const reelsScripts = allReelsScripts;
const tactics = allTactics;

const potentialColor = (p: string) => {
  if (p === "Вирусный") return "var(--brand-gold)";
  if (p === "Высокий") return "var(--gold-light)";
  if (p === "Средний") return "var(--brand-platinum)";
  return "var(--muted-foreground)";
};

/* Темы юзера (D1) приводим к тому же формату, что захардкоженный
   contentData, чтобы рендерить одной разметкой. */
type DisplayTopic = ContentTopic & { _custom?: boolean; _customId?: string };
type GeneratedDraft = {
  title: string;
  reason: string;
  format: string;
  potential: string;
};

export default function Dashboard() {
  const { workspaceKey, cloudEnabled } = useWorkspace();
  const [searchTerm, setSearchTerm] = useState("");
  const [tab, setTab] = useState<"topics" | "reels" | "tactics">("topics");
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const [genOpen, setGenOpen] = useState(false);
  const [genCount, setGenCount] = useState(6);
  const [genSegment, setGenSegment] = useState<
    "women_25_45" | "men_30_45" | "ambitious_pro" | "mixed"
  >("mixed");
  const [drafts, setDrafts] = useState<GeneratedDraft[]>([]);
  const [draftSelected, setDraftSelected] = useState<Record<number, boolean>>({});

  const customTopics = trpc.topics.list.useQuery(
    { workspaceKey },
    { enabled: cloudEnabled && workspaceKey.length > 0 },
  );
  const generateTopics = trpc.topics.generate.useMutation();
  const saveTopicsBatch = trpc.topics.saveBatch.useMutation({
    onSuccess: () => customTopics.refetch(),
  });
  const deleteTopic = trpc.topics.delete.useMutation({
    onSuccess: () => customTopics.refetch(),
  });

  /* Объединяем кастомные (новее) и захардкоженные темы. Кастомные
     получают отрицательные id, чтобы не пересекаться с числовыми id
     стартового набора и не ломать тип ContentTopic. */
  const mergedTopics = useMemo<DisplayTopic[]>(() => {
    const custom: DisplayTopic[] = (customTopics.data ?? []).map((t, i) => ({
      id: -(i + 1),
      title: t.title,
      reason: t.reason,
      interest: "Высокий",
      format: t.format,
      potential: t.potential,
      _custom: true,
      _customId: t.id,
    }));
    const fromStatic: DisplayTopic[] = staticTopics.map((t) => ({ ...t }));
    return [...custom, ...fromStatic];
  }, [customTopics.data]);

  const handleGenerate = async () => {
    try {
      const res = await generateTopics.mutateAsync({
        workspaceKey: workspaceKey || undefined,
        count: genCount,
        segment: genSegment,
        avoidTitles: mergedTopics.slice(0, 60).map((t) => t.title),
      });
      setDrafts(res.topics);
      // По умолчанию все черновики выбраны.
      const sel: Record<number, boolean> = {};
      res.topics.forEach((_, i) => (sel[i] = true));
      setDraftSelected(sel);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось сгенерировать");
    }
  };

  const handleSaveSelected = async () => {
    if (!cloudEnabled) {
      toast.error("Включи синхронизацию в Настройках, чтобы сохранять темы.");
      return;
    }
    const picked = drafts.filter((_, i) => draftSelected[i]);
    if (picked.length === 0) {
      toast.error("Выбери хотя бы одну тему.");
      return;
    }
    try {
      await saveTopicsBatch.mutateAsync({ workspaceKey, topics: picked });
      toast.success(`Сохранено: ${picked.length}`);
      setDrafts([]);
      setDraftSelected({});
      setGenOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось сохранить");
    }
  };

  const closeGen = () => {
    setGenOpen(false);
    setDrafts([]);
    setDraftSelected({});
  };

  const filtered = useMemo(
    () =>
      mergedTopics.filter((t) =>
        t.title.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    [mergedTopics, searchTerm],
  );

  const viralCount = mergedTopics.filter((t) => t.potential === "Вирусный").length;

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
              value={`${mergedTopics.length}`}
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
                <button
                  className="btn-gold"
                  onClick={() => setGenOpen(true)}
                  style={{ whiteSpace: "nowrap" }}
                  title="Сгенерировать новые темы через ИИ"
                >
                  <Plus className="w-4 h-4" />
                  Сгенерировать ещё
                </button>
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
                        <div className="flex items-center" style={{ gap: 8 }}>
                          <div
                            className="eyebrow"
                            style={{ color: potentialColor(topic.potential) }}
                          >
                            {topic.potential}
                          </div>
                          {topic._custom && (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                padding: "2px 8px",
                                borderRadius: 9999,
                                background: "rgba(212,168,67,0.14)",
                                color: "var(--brand-gold)",
                                fontSize: 9,
                                fontWeight: 700,
                                letterSpacing: 1.2,
                                textTransform: "uppercase",
                              }}
                            >
                              <Sparkles className="w-2.5 h-2.5" />
                              Моя
                            </span>
                          )}
                        </div>
                        {topic._custom && topic._customId && (
                          <button
                            onClick={() =>
                              deleteTopic.mutate({
                                workspaceKey,
                                id: topic._customId!,
                              })
                            }
                            title="Удалить тему"
                            style={{
                              background: "transparent",
                              border: "1px solid rgba(255,255,255,0.08)",
                              borderRadius: 9999,
                              padding: 6,
                              color: "var(--muted-foreground)",
                              cursor: "pointer",
                              lineHeight: 0,
                            }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
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
                Показано {filtered.length} из {mergedTopics.length} тем
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

      {genOpen && (
        <GenerateTopicsModal
          count={genCount}
          setCount={setGenCount}
          segment={genSegment}
          setSegment={setGenSegment}
          drafts={drafts}
          selected={draftSelected}
          setSelected={setDraftSelected}
          onGenerate={handleGenerate}
          onSaveSelected={handleSaveSelected}
          onClose={closeGen}
          isGenerating={generateTopics.isPending}
          isSaving={saveTopicsBatch.isPending}
          cloudEnabled={cloudEnabled}
        />
      )}
    </div>
  );
}

/* Модалка генерации тем. На первом шаге — выбор количества и сегмента ЦА;
   после генерации — список черновиков с чекбоксами и кнопкой «Сохранить». */
function GenerateTopicsModal({
  count,
  setCount,
  segment,
  setSegment,
  drafts,
  selected,
  setSelected,
  onGenerate,
  onSaveSelected,
  onClose,
  isGenerating,
  isSaving,
  cloudEnabled,
}: {
  count: number;
  setCount: (n: number) => void;
  segment: "women_25_45" | "men_30_45" | "ambitious_pro" | "mixed";
  setSegment: (s: "women_25_45" | "men_30_45" | "ambitious_pro" | "mixed") => void;
  drafts: GeneratedDraft[];
  selected: Record<number, boolean>;
  setSelected: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  onGenerate: () => void;
  onSaveSelected: () => void;
  onClose: () => void;
  isGenerating: boolean;
  isSaving: boolean;
  cloudEnabled: boolean;
}) {
  const SEGMENT_OPTIONS = [
    { v: "mixed", label: "Смешанная" },
    { v: "women_25_45", label: "Женщины 25-45" },
    { v: "men_30_45", label: "Мужчины 30-45" },
    { v: "ambitious_pro", label: "Амбициозные профи" },
  ] as const;
  const selectedCount = drafts.filter((_, i) => selected[i]).length;

  return (
    <div
      role="dialog"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(6px)",
        zIndex: 60,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: 24,
        overflowY: "auto",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bento-card"
        style={{
          width: "100%",
          maxWidth: 720,
          padding: 28,
          margin: "40px 0",
        }}
      >
        <div
          className="flex items-start justify-between"
          style={{ marginBottom: 18 }}
        >
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>
              Генератор тем
            </div>
            <h3 style={{ margin: 0 }}>Новые идеи под твою аудиторию</h3>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 9999,
              padding: 8,
              color: "var(--muted-foreground)",
              cursor: "pointer",
              lineHeight: 0,
            }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {drafts.length === 0 ? (
          <>
            <div className="grid gap-3" style={{ marginBottom: 18 }}>
              <div>
                <label
                  className="eyebrow"
                  style={{ display: "block", marginBottom: 8 }}
                >
                  Сколько тем
                </label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {[3, 6, 9, 12].map((n) => (
                    <button
                      key={n}
                      onClick={() => setCount(n)}
                      style={{
                        padding: "8px 16px",
                        borderRadius: 9999,
                        border: 0,
                        fontFamily: "var(--font-body)",
                        fontSize: 13,
                        fontWeight: 600,
                        background:
                          count === n ? "var(--brand-gold)" : "var(--ink-2)",
                        color: count === n ? "var(--ink)" : "#fff",
                        cursor: "pointer",
                      }}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label
                  className="eyebrow"
                  style={{ display: "block", marginBottom: 8 }}
                >
                  Сегмент ЦА
                </label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {SEGMENT_OPTIONS.map((s) => (
                    <button
                      key={s.v}
                      onClick={() => setSegment(s.v)}
                      style={{
                        padding: "8px 14px",
                        borderRadius: 9999,
                        border: 0,
                        fontFamily: "var(--font-body)",
                        fontSize: 12,
                        fontWeight: 600,
                        background:
                          segment === s.v ? "var(--brand-gold)" : "var(--ink-2)",
                        color: segment === s.v ? "var(--ink)" : "#fff",
                        cursor: "pointer",
                      }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <button
              className="btn-gold"
              onClick={onGenerate}
              disabled={isGenerating}
              style={{ width: "100%", justifyContent: "center" }}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Думаю...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Сгенерировать {count} тем
                </>
              )}
            </button>
          </>
        ) : (
          <>
            <p
              className="text-platinum"
              style={{ fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}
            >
              Выбери темы, которые добавить в План. Остальные просто закроются.
            </p>
            <div
              className="grid gap-2"
              style={{ marginBottom: 20, maxHeight: 360, overflowY: "auto" }}
            >
              {drafts.map((d, i) => {
                const isSel = selected[i];
                return (
                  <div
                    key={i}
                    onClick={() =>
                      setSelected((s) => ({ ...s, [i]: !s[i] }))
                    }
                    style={{
                      padding: 14,
                      borderRadius: 14,
                      background: isSel
                        ? "rgba(212,168,67,0.10)"
                        : "var(--ink-2)",
                      border: isSel
                        ? "1px solid rgba(212,168,67,0.4)"
                        : "1px solid rgba(255,255,255,0.06)",
                      cursor: "pointer",
                      display: "flex",
                      gap: 12,
                      alignItems: "flex-start",
                    }}
                  >
                    <div
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 5,
                        marginTop: 2,
                        flexShrink: 0,
                        border: isSel
                          ? "2px solid var(--brand-gold)"
                          : "2px solid rgba(255,255,255,0.2)",
                        background: isSel ? "var(--brand-gold)" : "transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {isSel && (
                        <Check
                          className="w-3 h-3"
                          style={{ color: "var(--ink)" }}
                        />
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        className="flex items-center"
                        style={{ gap: 8, marginBottom: 6 }}
                      >
                        <span
                          className="eyebrow"
                          style={{ color: potentialColor(d.potential) }}
                        >
                          {d.potential}
                        </span>
                        <span
                          style={{
                            fontSize: 10,
                            color: "var(--muted-foreground)",
                            textTransform: "uppercase",
                            letterSpacing: 1.2,
                          }}
                        >
                          {d.format}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: 600,
                          lineHeight: 1.3,
                          marginBottom: 6,
                        }}
                      >
                        {d.title}
                      </div>
                      <p
                        className="text-platinum"
                        style={{ fontSize: 13, lineHeight: 1.45, margin: 0 }}
                      >
                        {d.reason}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
            {!cloudEnabled && (
              <p
                style={{
                  fontSize: 12,
                  color: "#ff9a7a",
                  marginBottom: 12,
                }}
              >
                Чтобы сохранить темы, включи синхронизацию в Настройках.
              </p>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={onGenerate}
                disabled={isGenerating}
                className="btn-gold"
                style={{
                  background: "var(--ink-2)",
                  color: "#fff",
                  flex: 1,
                  justifyContent: "center",
                }}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Думаю...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Сгенерировать ещё
                  </>
                )}
              </button>
              <button
                onClick={onSaveSelected}
                disabled={isSaving || selectedCount === 0 || !cloudEnabled}
                className="btn-gold"
                style={{ flex: 1, justifyContent: "center" }}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Сохраняю...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Сохранить ({selectedCount})
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
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
