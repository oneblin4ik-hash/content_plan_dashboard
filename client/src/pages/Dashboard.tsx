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
  Folder as FolderIcon,
} from "lucide-react";
import { toast } from "sonner";
import { allContentTopics, allReelsScripts, allTactics, type ContentTopic, type ReelsScript } from "@/lib/contentData";
import { trpc } from "@/lib/trpc";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { CostBadge } from "@/components/CostBadge";
import { restartOnboardingTour } from "@/components/OnboardingTour";

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
type DisplayTopic = ContentTopic & {
  _custom?: boolean;
  _customId?: string;
  _folderId?: string | null;
};
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
  /* drafts накапливает идеи, добавленные за текущую сессию модалки —
     просто как подтверждение «вот что улетело в список». Сохранение
     происходит автоматически при генерации, ручного выбора нет. */
  const [drafts, setDrafts] = useState<GeneratedDraft[]>([]);

  /* Активная папка-фильтр: null = «Все», "none" = «Без папки»,
     иначе — id папки. */
  const [activeFolder, setActiveFolder] = useState<string | null>(null);

  const customTopics = trpc.topics.list.useQuery(undefined,
    { enabled: cloudEnabled && workspaceKey.length > 0 },
  );
  const folders = trpc.topics.listFolders.useQuery(undefined, {
    enabled: cloudEnabled && workspaceKey.length > 0,
  });
  const generateTopics = trpc.topics.generate.useMutation();
  const saveTopicsBatch = trpc.topics.saveBatch.useMutation({
    onSuccess: () => customTopics.refetch(),
  });
  const deleteTopic = trpc.topics.delete.useMutation({
    onSuccess: () => customTopics.refetch(),
  });
  const createFolder = trpc.topics.createFolder.useMutation({
    onSuccess: () => folders.refetch(),
  });
  const deleteFolderM = trpc.topics.deleteFolder.useMutation({
    onSuccess: () => {
      folders.refetch();
      customTopics.refetch();
      setActiveFolder(null);
    },
  });
  const setTopicFolder = trpc.topics.setTopicFolder.useMutation({
    onSuccess: () => {
      customTopics.refetch();
      folders.refetch();
    },
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
      _folderId: t.folderId,
    }));
    const fromStatic: DisplayTopic[] = staticTopics.map((t) => ({ ...t }));
    return [...custom, ...fromStatic];
  }, [customTopics.data]);

  /* Генерация + автосохранение в один шаг. Сгенерированные идеи сразу
     уходят в D1 и дописываются к списку раздела (с бейджем «Моя»).
     Новые идеи накапливаются в drafts поверх предыдущих — чтобы в
     модалке было видно всё, что добавилось за сессию. */
  const handleGenerate = async () => {
    if (!cloudEnabled) {
      toast.error("Включи синхронизацию в Настройках, чтобы сохранять идеи.");
      return;
    }
    try {
      const res = await generateTopics.mutateAsync({
        count: genCount,
        segment: genSegment,
        // Избегаем дублей: и стартовые темы, и уже добавленные за сессию.
        avoidTitles: [
          ...drafts.map((d) => d.title),
          ...mergedTopics.slice(0, 60).map((t) => t.title),
        ].slice(0, 80),
      });
      if (res.topics.length === 0) {
        toast.error("Не удалось придумать новые идеи, попробуй ещё раз.");
        return;
      }
      await saveTopicsBatch.mutateAsync({
        topics: res.topics,
      });
      setDrafts((prev) => [...res.topics, ...prev]);
      toast.success(`Добавлено идей: ${res.topics.length}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось сгенерировать");
    }
  };

  const closeGen = () => {
    setGenOpen(false);
    setDrafts([]);
  };

  const filtered = useMemo(
    () =>
      mergedTopics.filter((t) => {
        if (!t.title.toLowerCase().includes(searchTerm.toLowerCase()))
          return false;
        /* Папка-фильтр. «Все» (null) — без фильтра. «Без папки»
           ("none") — кастомные без folder_id + все статичные (они
           вне системы папок). Конкретная папка — только кастомные с
           этим folder_id. */
        if (activeFolder === null) return true;
        if (activeFolder === "none")
          return !t._custom || !t._folderId;
        return t._custom && t._folderId === activeFolder;
      }),
    [mergedTopics, searchTerm, activeFolder],
  );

  const viralCount = mergedTopics.filter((t) => t.potential === "Вирусный").length;

  const handleCopy = (text: string, id: number) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      {/* HERO — сжатый: только заголовок и подзаголовок, без bento-стат,
          чтобы быстрее показать список тем. Цифры всё равно есть на
          табах. */}
      <section style={{ padding: "40px 0 16px" }}>
        <div className="container">
          <div className="eyebrow" style={{ marginBottom: 12 }}>
            Идеи
          </div>
          <h1 style={{ letterSpacing: "-0.6px" }}>
            Готовые темы{" "}
            <span style={{ color: "var(--brand-gold)" }}>и Reels-сценарии</span>
          </h1>
          <p
            className="text-platinum"
            style={{
              maxWidth: 620,
              fontSize: 15,
              marginTop: 14,
              lineHeight: 1.5,
            }}
          >
            Выбери тему — и одним кликом отправь её в Студию. Или сгенерируй
            новые под свою аудиторию.
          </p>
          {/* «Показать обучение» — запускает многошаговый тур по разделам.
              Кнопка в виде ghost-pill: не отвлекает от основного экрана,
              но первая видна тем, кто хочет освежить инструкцию. */}
          <button
            onClick={restartOnboardingTour}
            style={{
              marginTop: 16,
              padding: "8px 16px",
              borderRadius: 9999,
              background: "rgba(212,168,67,0.08)",
              border: "1px solid rgba(212,168,67,0.28)",
              color: "var(--brand-gold)",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 0.6,
              textTransform: "uppercase",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
            title="Пройти мини-гид по сервису заново"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Показать обучение
          </button>
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

              {/* Чипы-папки (коллекции). Показываем только в облаке. */}
              {cloudEnabled && (
                <FolderChips
                  folders={folders.data ?? []}
                  active={activeFolder}
                  onPick={setActiveFolder}
                  onCreate={(name) => createFolder.mutate({ name })}
                  onDelete={(id) => deleteFolderM.mutate({ id })}
                />
              )}

              {/* Минималистичный список: каждая тема — одна строка.
                  Format-бейдж слева, заголовок по центру, потенциал и
                  «→ Студия» справа. Кнопка удаления у кастомных тем
                  появляется при ховере. */}
              <div
                style={{
                  background: "var(--ink-2)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 14,
                  overflow: "hidden",
                }}
              >
                {filtered.map((topic, idx) => (
                  <TopicRow
                    key={topic.id}
                    topic={topic}
                    first={idx === 0}
                    folders={folders.data ?? []}
                    canFolder={cloudEnabled && !!topic._custom && !!topic._customId}
                    onSetFolder={(folderId) =>
                      topic._customId &&
                      setTopicFolder.mutate({ topicId: topic._customId, folderId })
                    }
                    onDelete={
                      topic._custom && topic._customId
                        ? () => deleteTopic.mutate({ id: topic._customId! })
                        : undefined
                    }
                  />
                ))}
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
            /* Reels — список свёрнутых строк с раскрытием по клику.
               В свёрнутом виде: заголовок + превью хука. Раскрытие
               показывает все блоки (хук/тело/триггер/CTA) и
               действия. */
            <div
              style={{
                background: "var(--ink-2)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 14,
                overflow: "hidden",
              }}
            >
              {reelsScripts.map((script, idx) => (
                <ReelsRow
                  key={script.id}
                  script={script}
                  first={idx === 0}
                  isCopied={copiedId === script.id}
                  onCopy={() => {
                    const full = `${script.title}\n\nХук: ${script.hook}\n${
                      script.body ? `Тело: ${script.body}\n` : ""
                    }Триггер: ${script.trigger}\n\nCTA: ${script.cta}`;
                    handleCopy(full, script.id);
                  }}
                />
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
          onGenerate={handleGenerate}
          onClose={closeGen}
          isGenerating={generateTopics.isPending || saveTopicsBatch.isPending}
          cloudEnabled={cloudEnabled}
        />
      )}
    </div>
  );
}

/* Модалка генерации тем. Настройки (количество + сегмент) всегда сверху.
   Кнопка генерации сразу сохраняет идеи в раздел — ручного выбора нет.
   Ниже копится список того, что добавилось за сессию («✓ Добавлено»). */
function GenerateTopicsModal({
  count,
  setCount,
  segment,
  setSegment,
  drafts,
  onGenerate,
  onClose,
  isGenerating,
  cloudEnabled,
}: {
  count: number;
  setCount: (n: number) => void;
  segment: "women_25_45" | "men_30_45" | "ambitious_pro" | "mixed";
  setSegment: (s: "women_25_45" | "men_30_45" | "ambitious_pro" | "mixed") => void;
  drafts: GeneratedDraft[];
  onGenerate: () => void;
  onClose: () => void;
  isGenerating: boolean;
  cloudEnabled: boolean;
}) {
  const SEGMENT_OPTIONS = [
    { v: "mixed", label: "Смешанная" },
    { v: "women_25_45", label: "Женщины 25-45" },
    { v: "men_30_45", label: "Мужчины 30-45" },
    { v: "ambitious_pro", label: "Амбициозные профи" },
  ] as const;
  const hasDrafts = drafts.length > 0;

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

        {/* Настройки — всегда видны */}
        <div className="grid gap-3" style={{ marginBottom: 16 }}>
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

        {!cloudEnabled && (
          <p style={{ fontSize: 12, color: "#ff9a7a", marginBottom: 12 }}>
            Чтобы идеи сохранялись, включи синхронизацию в Настройках.
          </p>
        )}

        {/* Кнопка генерации — сразу сохраняет и добавляет в раздел */}
        <button
          className="btn-gold"
          onClick={onGenerate}
          disabled={isGenerating || !cloudEnabled}
          style={{ width: "100%", justifyContent: "center" }}
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Думаю и добавляю...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              {hasDrafts
                ? `Сгенерировать ещё ${count}`
                : `Сгенерировать и добавить ${count}`}
              <CostBadge action="topics" />
            </>
          )}
        </button>

        {/* Что добавилось за сессию */}
        {hasDrafts && (
          <>
            <div
              className="flex items-center"
              style={{ gap: 8, margin: "22px 0 12px" }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  color: "#3ecf8e",
                  fontSize: 12,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: 1.2,
                }}
              >
                <Check className="w-3.5 h-3.5" />
                Добавлено в Идеи · {drafts.length}
              </span>
            </div>
            <div
              className="grid gap-2"
              style={{ maxHeight: 320, overflowY: "auto", marginBottom: 18 }}
            >
              {drafts.map((d, i) => (
                <div
                  key={i}
                  style={{
                    padding: 14,
                    borderRadius: 14,
                    background: "var(--ink-2)",
                    border: "1px solid rgba(62,207,142,0.2)",
                  }}
                >
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
              ))}
            </div>
            <button
              onClick={onClose}
              className="btn-gold"
              style={{
                width: "100%",
                justifyContent: "center",
                background: "var(--ink-2)",
                color: "#fff",
              }}
            >
              Готово
            </button>
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

/* ─── Row-компоненты для списочного вида «Идей» ─────────────── */

/* Одна строка темы. Format-бейдж + заголовок + потенциал-eyebrow.
   Кнопка → ведёт в Студию с пред-заполненным title. Кастомные темы
   получают красную trash-кнопку справа (только при ховере на десктопе,
   всегда на тач-устройствах). */
function TopicRow({
  topic,
  first,
  folders,
  canFolder,
  onSetFolder,
  onDelete,
}: {
  topic: DisplayTopic;
  first: boolean;
  folders: { id: string; name: string; count: number }[];
  canFolder: boolean;
  onSetFolder: (folderId: string | null) => void;
  onDelete?: () => void;
}) {
  const [folderMenu, setFolderMenu] = useState(false);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "14px 18px",
        borderTop: first ? "none" : "1px solid rgba(255,255,255,0.05)",
        transition: "background 0.12s",
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.background = "rgba(255,255,255,0.03)")
      }
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {/* Format-бейдж — компактный, монокомпактный */}
      <span
        style={{
          minWidth: 70,
          padding: "3px 9px",
          background: "rgba(255,255,255,0.05)",
          color: "var(--brand-platinum)",
          borderRadius: 6,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 0.5,
          textTransform: "uppercase",
          textAlign: "center",
          flexShrink: 0,
        }}
      >
        {topic.format}
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "#fff",
            lineHeight: 1.35,
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          {topic.title}
          {topic._custom && (
            <span
              style={{
                fontSize: 9,
                padding: "1px 6px",
                background: "rgba(212,168,67,0.16)",
                color: "var(--brand-gold)",
                borderRadius: 5,
                fontWeight: 700,
                letterSpacing: 0.7,
                textTransform: "uppercase",
              }}
            >
              Моя
            </span>
          )}
        </div>
      </div>

      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 1,
          textTransform: "uppercase",
          color: potentialColor(topic.potential),
          flexShrink: 0,
          whiteSpace: "nowrap",
        }}
      >
        {topic.potential}
      </span>

      <Link href={`/generator?title=${encodeURIComponent(topic.title)}`}>
        <span
          title="Открыть в Студии"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 32,
            height: 32,
            borderRadius: 9999,
            background: "transparent",
            color: "var(--brand-gold)",
            cursor: "pointer",
            flexShrink: 0,
            transition: "background 0.12s",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = "rgba(212,168,67,0.14)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = "transparent")
          }
        >
          <ArrowUpRight className="w-4 h-4" />
        </span>
      </Link>

      {canFolder && (
        <div style={{ position: "relative", flexShrink: 0 }}>
          <button
            onClick={() => setFolderMenu((s) => !s)}
            title="Папка"
            style={{
              background: topic._folderId ? "rgba(212,168,67,0.14)" : "transparent",
              border: 0,
              color: topic._folderId ? "var(--brand-gold)" : "var(--muted-foreground)",
              cursor: "pointer",
              padding: 6,
              borderRadius: 9999,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <FolderIcon className="w-3.5 h-3.5" />
          </button>
          {folderMenu && (
            <>
              {/* клик вне меню — закрыть */}
              <div
                onClick={() => setFolderMenu(false)}
                style={{ position: "fixed", inset: 0, zIndex: 30 }}
              />
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 4px)",
                  right: 0,
                  zIndex: 31,
                  minWidth: 180,
                  background: "var(--ink-3)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 10,
                  padding: 4,
                  boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
                }}
              >
                <FolderMenuItem
                  label="Без папки"
                  active={!topic._folderId}
                  onClick={() => {
                    onSetFolder(null);
                    setFolderMenu(false);
                  }}
                />
                {folders.map((f) => (
                  <FolderMenuItem
                    key={f.id}
                    label={f.name}
                    active={topic._folderId === f.id}
                    onClick={() => {
                      onSetFolder(f.id);
                      setFolderMenu(false);
                    }}
                  />
                ))}
                {folders.length === 0 && (
                  <div
                    style={{
                      padding: "8px 10px",
                      fontSize: 11,
                      color: "var(--muted-foreground)",
                      lineHeight: 1.4,
                    }}
                  >
                    Создай папку кнопкой «+ Папка» выше
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {onDelete && (
        <button
          onClick={onDelete}
          title="Удалить тему"
          style={{
            background: "transparent",
            border: 0,
            color: "var(--muted-foreground)",
            cursor: "pointer",
            padding: 6,
            borderRadius: 9999,
            flexShrink: 0,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

/* Свёрнутая строка Reels-сценария. Клик по строке раскрывает блоки
   (хук/тело/триггер/CTA) inline. В свёрнутом — превью хука одной
   строкой с ellipsis. */
function ReelsRow({
  script,
  first,
  isCopied,
  onCopy,
}: {
  script: ReelsScript;
  first: boolean;
  isCopied: boolean;
  onCopy: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div
      style={{
        borderTop: first ? "none" : "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <button
        onClick={() => setOpen((s) => !s)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "14px 18px",
          background: "transparent",
          border: 0,
          textAlign: "left",
          cursor: "pointer",
          color: "inherit",
          transition: "background 0.12s",
        }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.background = "rgba(255,255,255,0.03)")
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.background = "transparent")
        }
      >
        <span
          style={{
            minWidth: 70,
            padding: "3px 9px",
            background: "rgba(255,255,255,0.05)",
            color: "var(--brand-platinum)",
            borderRadius: 6,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 0.5,
            textTransform: "uppercase",
            textAlign: "center",
            flexShrink: 0,
          }}
        >
          Reels #{script.id}
        </span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "#fff",
              lineHeight: 1.3,
              marginBottom: 2,
            }}
          >
            {script.title}
          </div>
          {!open && (
            <div
              style={{
                fontSize: 12,
                color: "var(--muted-foreground)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {script.hook}
            </div>
          )}
        </div>

        <span
          style={{
            color: "var(--muted-foreground)",
            fontSize: 11,
            flexShrink: 0,
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.2s",
          }}
        >
          ▾
        </span>
      </button>

      {open && (
        <div
          style={{
            padding: "0 18px 18px 102px",
            display: "grid",
            gap: 12,
          }}
        >
          <ReelsBlock label="Хук" text={script.hook} />
          {script.body && <ReelsBlock label="Тело" text={script.body} />}
          <ReelsBlock label="Триггер" text={script.trigger} />
          <ReelsBlock label="CTA" text={script.cta} italic />
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCopy();
              }}
              style={{
                padding: "8px 14px",
                background: "var(--ink-3)",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 9999,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {isCopied ? (
                <>
                  <Check className="w-3.5 h-3.5" /> Скопировано
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" /> Скопировать сценарий
                </>
              )}
            </button>
            <Link
              href={`/generator?title=${encodeURIComponent(script.title)}`}
            >
              <span
                style={{
                  padding: "8px 14px",
                  background: "transparent",
                  color: "var(--brand-gold)",
                  border: "1px solid rgba(212,168,67,0.32)",
                  borderRadius: 9999,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                В Студию
                <ArrowUpRight className="w-3.5 h-3.5" />
              </span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

/* Чипы-папки над списком тем. «Все» / «Без папки» / папки + «+ Папка».
   Активная папка подсвечена золотым. Долгое нажатие/правый клик не
   используем — удаление папки через ✕ на активном чипе. */
function FolderChips({
  folders,
  active,
  onPick,
  onCreate,
  onDelete,
}: {
  folders: { id: string; name: string; count: number }[];
  active: string | null;
  onPick: (v: string | null) => void;
  onCreate: (name: string) => void;
  onDelete: (id: string) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");

  const chip = (
    key: string | null,
    label: string,
    count?: number,
    removable?: string,
  ) => {
    const isActive = active === key;
    return (
      <div
        key={key ?? "all"}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 12px",
          borderRadius: 9999,
          background: isActive ? "var(--brand-gold)" : "var(--ink-2)",
          color: isActive ? "var(--ink)" : "var(--brand-platinum)",
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
          border: "1px solid rgba(255,255,255,0.06)",
          whiteSpace: "nowrap",
        }}
        onClick={() => onPick(key)}
      >
        <span>{label}</span>
        {typeof count === "number" && (
          <span style={{ opacity: 0.65 }}>{count}</span>
        )}
        {removable && isActive && (
          <span
            onClick={(e) => {
              e.stopPropagation();
              if (window.confirm("Удалить папку? Темы останутся, но без папки."))
                onDelete(removable);
            }}
            title="Удалить папку"
            style={{ display: "inline-flex", marginLeft: 2 }}
          >
            <X className="w-3 h-3" />
          </span>
        )}
      </div>
    );
  };

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        marginBottom: 16,
        alignItems: "center",
      }}
    >
      {chip(null, "Все")}
      {chip("none", "Без папки")}
      {folders.map((f) => chip(f.id, f.name, f.count, f.id))}

      {creating ? (
        <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim()) {
                onCreate(name.trim());
                setName("");
                setCreating(false);
              } else if (e.key === "Escape") {
                setCreating(false);
                setName("");
              }
            }}
            placeholder="Название папки"
            style={{
              height: 32,
              padding: "0 12px",
              background: "var(--ink-3)",
              border: "1px solid rgba(212,168,67,0.4)",
              borderRadius: 9999,
              color: "#fff",
              fontSize: 12,
              outline: "none",
              width: 150,
            }}
          />
          <button
            onClick={() => {
              if (name.trim()) {
                onCreate(name.trim());
                setName("");
              }
              setCreating(false);
            }}
            style={{
              background: "transparent",
              border: 0,
              color: "var(--brand-gold)",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            ОК
          </button>
        </div>
      ) : (
        <button
          onClick={() => setCreating(true)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "6px 12px",
            borderRadius: 9999,
            background: "transparent",
            border: "1px dashed rgba(255,255,255,0.18)",
            color: "var(--muted-foreground)",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <Plus className="w-3 h-3" />
          Папка
        </button>
      )}
    </div>
  );
}

function FolderMenuItem({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        padding: "8px 10px",
        background: "transparent",
        border: 0,
        borderRadius: 7,
        color: active ? "var(--brand-gold)" : "var(--brand-platinum)",
        fontSize: 13,
        cursor: "pointer",
        textAlign: "left",
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.background = "rgba(255,255,255,0.05)")
      }
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {label}
      </span>
      {active && <Check className="w-3.5 h-3.5" style={{ flexShrink: 0 }} />}
    </button>
  );
}
