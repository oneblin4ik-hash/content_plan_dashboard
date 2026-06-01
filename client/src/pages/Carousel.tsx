import { useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import JSZip from "jszip";
import {
  Sparkles,
  Loader2,
  Plus,
  Trash2,
  Copy as CopyIcon,
  ChevronLeft,
  ChevronRight,
  Download,
  Images,
  Save,
  CalendarPlus,
  Check,
  Layers,
  Palette,
  Type as TypeIcon,
  Image as ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { localLibrary, localCalendar } from "@/lib/syncStorage";

/* ============================================================
   Конструктор каруселей для Instagram (вдохновлён Virale / chatplace).
   AI генерирует структурированные слайды → визуальный редактор:
   правка текста, темы оформления, формат кадра, перестановка,
   экспорт каждого слайда в PNG или всех в ZIP.
   ============================================================ */

type SlideKind = "cover" | "content" | "cta";
type Slide = {
  id: string;
  kind: SlideKind;
  headline: string;
  body: string;
  /* Фоновое фото. Храним dataURL (data:image/...;base64,...) —
     это снимает CORS-проблемы при экспорте через html-to-image и
     гарантирует, что превью и экспорт идентичны. Файлы конвертим
     через FileReader, внешние URL — через fetch+FileReader. */
  imageUrl?: string;
  /* Затемнение фото 0..1 (для читаемости текста на ярких фото). */
  overlay?: number;
};

type Theme = {
  id: string;
  name: string;
  bg: string;
  text: string;
  body: string;
  accent: string;
  accentText: string;
  fontHead: string;
  fontBody: string;
};

const FONT_DISPLAY =
  '"Space Grotesk", "Inter", -apple-system, sans-serif';
const FONT_BODY = '"Inter", -apple-system, sans-serif';

const THEMES: Theme[] = [
  {
    id: "ink_gold",
    name: "Тёмная · золото",
    bg: "#1a1a1a",
    text: "#ffffff",
    body: "rgba(255,255,255,0.78)",
    accent: "#d4a843",
    accentText: "#1a1a1a",
    fontHead: FONT_DISPLAY,
    fontBody: FONT_BODY,
  },
  {
    id: "cream",
    name: "Светлая · крем",
    bg: "#f4efe6",
    text: "#1a1a1a",
    body: "rgba(26,26,26,0.72)",
    accent: "#c08a2d",
    accentText: "#ffffff",
    fontHead: FONT_DISPLAY,
    fontBody: FONT_BODY,
  },
  {
    id: "gold_grad",
    name: "Градиент · золото",
    bg: "linear-gradient(150deg, #2a2410 0%, #1a1a1a 55%, #0d0d0d 100%)",
    text: "#f6e7c2",
    body: "rgba(246,231,194,0.8)",
    accent: "#d4a843",
    accentText: "#1a1a1a",
    fontHead: FONT_DISPLAY,
    fontBody: FONT_BODY,
  },
  {
    id: "violet",
    name: "Градиент · виолет",
    bg: "linear-gradient(160deg, #6d28d9 0%, #4c1d95 50%, #2e1065 100%)",
    text: "#ffffff",
    body: "rgba(255,255,255,0.82)",
    accent: "#f0abfc",
    accentText: "#2e1065",
    fontHead: FONT_DISPLAY,
    fontBody: FONT_BODY,
  },
  {
    id: "ocean",
    name: "Градиент · океан",
    bg: "linear-gradient(160deg, #0ea5e9 0%, #0369a1 55%, #082f49 100%)",
    text: "#ffffff",
    body: "rgba(255,255,255,0.82)",
    accent: "#7dd3fc",
    accentText: "#082f49",
    fontHead: FONT_DISPLAY,
    fontBody: FONT_BODY,
  },
  {
    id: "mono",
    name: "Чёрный · моно",
    bg: "#0a0a0a",
    text: "#ffffff",
    body: "rgba(255,255,255,0.7)",
    accent: "#ffffff",
    accentText: "#0a0a0a",
    fontHead: FONT_DISPLAY,
    fontBody: FONT_BODY,
  },
];

type Ratio = "4:5" | "1:1" | "9:16";
const RATIO_DIMS: Record<Ratio, { w: number; h: number }> = {
  "4:5": { w: 1080, h: 1350 },
  "1:1": { w: 1080, h: 1080 },
  "9:16": { w: 1080, h: 1920 },
};

const ACCENT_SWATCHES = [
  "#d4a843",
  "#f0abfc",
  "#7dd3fc",
  "#34d399",
  "#fb7185",
  "#ffffff",
];

const uid = () => Math.random().toString(36).slice(2, 10);

/* Лимит на фото — чтобы payload карусели не раздулся в D1 и не вылетел
   за лимит строки (1 MB). 4 MB исходника после base64 ≈ 5.3 MB; для
   обложки этого с запасом, а тяжёлые DSLR-снимки не нужны. */
const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
const ALLOWED_MIME = /^image\/(jpeg|jpg|png|webp)$/i;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Не удалось прочитать файл"));
    r.readAsDataURL(file);
  });
}

/* Берём чужую картинку и конвертим в dataURL: иначе html-to-image
   получает tainted canvas (CORS) и экспорт PNG падает. Если fetch
   не пройдёт (CORS / 404) — возвращаем исходный URL, превью покажет,
   но при экспорте может ругнуться. */
async function urlToDataUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    if (!ALLOWED_MIME.test(blob.type)) {
      throw new Error(`Не картинка: ${blob.type || "unknown"}`);
    }
    if (blob.size > MAX_PHOTO_BYTES) {
      throw new Error(`Файл больше 4 MB`);
    }
    const file = new File([blob], "remote", { type: blob.type });
    return await fileToDataUrl(file);
  } catch {
    return url;
  }
}

const SEGMENTS = [
  { v: "mixed", label: "Смешанная" },
  { v: "women_25_45", label: "Женщины 25-45" },
  { v: "men_30_45", label: "Мужчины 30-45" },
  { v: "ambitious_pro", label: "Профи" },
] as const;

export default function Carousel() {
  const { workspaceKey, cloudEnabled } = useWorkspace();

  const [title, setTitle] = useState("");
  const [count, setCount] = useState(7);
  const [segment, setSegment] =
    useState<(typeof SEGMENTS)[number]["v"]>("mixed");

  const [slides, setSlides] = useState<Slide[]>([]);
  const [selected, setSelected] = useState(0);

  const [themeId, setThemeId] = useState("ink_gold");
  const [accent, setAccent] = useState<string | null>(null);
  const [handle, setHandle] = useState("@serbolin");
  const [showPages, setShowPages] = useState(true);
  const [showHandle, setShowHandle] = useState(true);
  const [ratio, setRatio] = useState<Ratio>("4:5");
  const [panel, setPanel] = useState<"slide" | "design">("slide");
  const [exporting, setExporting] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [planDate, setPlanDate] = useState(() => {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    return t.toISOString().slice(0, 10);
  });

  const baseTheme = THEMES.find((t) => t.id === themeId) ?? THEMES[0];
  const theme: Theme = useMemo(
    () => (accent ? { ...baseTheme, accent } : baseTheme),
    [baseTheme, accent],
  );
  const dims = RATIO_DIMS[ratio];

  const generate = trpc.content.generateCarouselSlides.useMutation();
  const cloudSave = trpc.sync.library.save.useMutation();
  const cloudSchedule = trpc.sync.scheduled.save.useMutation();

  /* Скрытые full-size ноды для экспорта (1080px), по одной на слайд. */
  const exportRefs = useRef<(HTMLDivElement | null)[]>([]);

  const handleGenerate = async () => {
    if (title.trim().length < 5) {
      toast.error("Введи тему (минимум 5 символов)");
      return;
    }
    try {
      const res = await generate.mutateAsync({
        title: title.trim(),
        slides: count,
        segment,
        workspaceKey: workspaceKey || undefined,
      });
      setSlides(
        res.slides.map((s) => ({
          id: uid(),
          kind: s.kind as SlideKind,
          headline: s.headline,
          body: s.body,
        })),
      );
      setSelected(0);
      toast.success(`Готово: ${res.slides.length} слайдов`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось сгенерировать");
    }
  };

  const updateSlide = (idx: number, patch: Partial<Slide>) =>
    setSlides((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    );

  const addSlide = () => {
    setSlides((prev) => {
      const insertAt = Math.min(prev.length, selected + 1);
      const next = [...prev];
      next.splice(insertAt, 0, {
        id: uid(),
        kind: "content",
        headline: "Новый слайд",
        body: "Текст слайда",
      });
      return next;
    });
    setSelected((s) => s + 1);
  };

  const duplicateSlide = (idx: number) => {
    setSlides((prev) => {
      const next = [...prev];
      next.splice(idx + 1, 0, { ...prev[idx], id: uid() });
      return next;
    });
    setSelected(idx + 1);
  };

  const removeSlide = (idx: number) => {
    setSlides((prev) => prev.filter((_, i) => i !== idx));
    setSelected((s) => Math.max(0, Math.min(s, slides.length - 2)));
  };

  const moveSlide = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= slides.length) return;
    setSlides((prev) => {
      const next = [...prev];
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
    setSelected(j);
  };

  const downloadDataUrl = (dataUrl: string, name: string) => {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = name;
    a.click();
  };

  const slugTitle = (title || "carousel")
    .toLowerCase()
    .replace(/[^a-zа-я0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

  const exportOne = async (idx: number) => {
    const node = exportRefs.current[idx];
    if (!node) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(node, { pixelRatio: 1, cacheBust: true });
      downloadDataUrl(dataUrl, `${slugTitle}-${idx + 1}.png`);
    } catch {
      toast.error("Не удалось экспортировать слайд");
    } finally {
      setExporting(false);
    }
  };

  const exportAll = async () => {
    if (slides.length === 0) return;
    setExporting(true);
    try {
      const zip = new JSZip();
      for (let i = 0; i < slides.length; i++) {
        const node = exportRefs.current[i];
        if (!node) continue;
        const dataUrl = await toPng(node, { pixelRatio: 1, cacheBust: true });
        zip.file(
          `${slugTitle}-${String(i + 1).padStart(2, "0")}.png`,
          dataUrl.split(",")[1],
          { base64: true },
        );
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      downloadDataUrl(url, `${slugTitle}-carousel.zip`);
      URL.revokeObjectURL(url);
      toast.success(`Экспортировано слайдов: ${slides.length}`);
    } catch {
      toast.error("Не удалось собрать ZIP");
    } finally {
      setExporting(false);
    }
  };

  const saveToLibrary = async () => {
    const payload = {
      title,
      slides,
      design: { themeId, accent, handle, showPages, showHandle, ratio },
    };
    if (cloudEnabled && workspaceKey) {
      try {
        await cloudSave.mutateAsync({
          workspaceKey,
          title: title || "Карусель",
          mode: "carousel",
          payload,
        });
        toast.success("Сохранено в библиотеку");
        return;
      } catch {
        /* fallback ниже */
      }
    }
    localLibrary.add({
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      title: title || "Карусель",
      mode: "carousel",
      payload,
    });
    toast.success("Сохранено локально");
  };

  const saveToPlan = (date: string) => {
    if (cloudEnabled && workspaceKey) {
      cloudSchedule.mutate(
        { workspaceKey, date, title: title || "Карусель", format: "Карусель" },
        {
          onSuccess: () => toast.success(`В плане на ${date}`),
          onError: (e) => toast.error(e.message),
        },
      );
    } else {
      localCalendar.add({
        id: "car-" + Date.now(),
        date,
        title: title || "Карусель",
        format: "Карусель",
      });
      toast.success(`В плане на ${date}`);
    }
    setPlanOpen(false);
  };

  const hasSlides = slides.length > 0;
  const current = slides[selected];

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <section style={{ padding: "48px 0 8px" }}>
        <div className="container">
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            <Layers
              className="w-3.5 h-3.5"
              style={{ display: "inline", marginRight: 6 }}
            />
            Конструктор каруселей
          </div>
          <h1 style={{ letterSpacing: "-1px", marginBottom: 12 }}>
            Карусели,{" "}
            <span style={{ color: "var(--brand-gold)" }}>готовые к посту.</span>
          </h1>
          <p
            className="text-platinum"
            style={{ fontSize: 16, maxWidth: 680, marginBottom: 20 }}
          >
            Введи тему — AI соберёт слайды в твоём голосе. Поправь текст,
            выбери оформление и скачай готовые картинки для Instagram.
          </p>

          {/* Панель генерации */}
          <div
            className="bento-card"
            style={{ padding: 18, display: "grid", gap: 14 }}
          >
            <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
                placeholder="Тема карусели, напр. «3 ошибки на сушке»"
                style={{
                  flex: 1,
                  minWidth: 240,
                  background: "var(--ink-3)",
                  color: "#fff",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 12,
                  padding: "12px 16px",
                  fontSize: 15,
                  fontFamily: "var(--font-body)",
                }}
              />
              <button
                onClick={handleGenerate}
                disabled={generate.isPending}
                className="btn-gold gold-glow"
                style={{ padding: "12px 24px", fontSize: 15 }}
              >
                {generate.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Собираю...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />{" "}
                    {hasSlides ? "Пересобрать" : "Сгенерировать"}
                  </>
                )}
              </button>
            </div>
            <div className="flex" style={{ gap: 18, flexWrap: "wrap" }}>
              <Inline label="Слайдов">
                {[5, 6, 7, 8, 10].map((n) => (
                  <Chip
                    key={n}
                    active={count === n}
                    onClick={() => setCount(n)}
                  >
                    {n}
                  </Chip>
                ))}
              </Inline>
              <Inline label="Сегмент ЦА">
                {SEGMENTS.map((s) => (
                  <Chip
                    key={s.v}
                    active={segment === s.v}
                    onClick={() => setSegment(s.v)}
                  >
                    {s.label}
                  </Chip>
                ))}
              </Inline>
            </div>
          </div>
        </div>
      </section>

      {!hasSlides ? (
        <section style={{ padding: "32px 0 96px" }}>
          <div className="container">
            <div
              className="bento-card"
              style={{
                padding: 48,
                textAlign: "center",
                color: "var(--muted-foreground)",
              }}
            >
              <Images
                className="w-10 h-10"
                style={{ margin: "0 auto 16px", opacity: 0.4 }}
              />
              <p style={{ fontSize: 15 }}>
                Пока пусто. Введи тему выше и нажми «Сгенерировать» —
                карусель появится здесь с превью и редактором.
              </p>
            </div>
          </div>
        </section>
      ) : (
        <section style={{ padding: "24px 0 96px" }}>
          <div
            className="container"
            style={{
              display: "grid",
              gap: 20,
              gridTemplateColumns: "minmax(0, 1fr) 360px",
              alignItems: "start",
            }}
          >
            {/* ЛЕВО: превью + лента слайдов */}
            <div>
              {/* Тулбар экспорта */}
              <div
                className="flex"
                style={{ gap: 8, marginBottom: 16, flexWrap: "wrap" }}
              >
                <button
                  onClick={() => exportOne(selected)}
                  disabled={exporting}
                  className="btn-gold"
                  style={{ padding: "10px 16px", fontSize: 13 }}
                >
                  {exporting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  Скачать слайд
                </button>
                <button
                  onClick={exportAll}
                  disabled={exporting}
                  className="btn-gold gold-glow"
                  style={{ padding: "10px 16px", fontSize: 13 }}
                >
                  <Images className="w-4 h-4" />
                  Скачать все ({slides.length})
                </button>
                <button
                  onClick={saveToLibrary}
                  className="btn-gold"
                  style={{
                    padding: "10px 16px",
                    fontSize: 13,
                    background: "var(--ink-2)",
                    color: "#fff",
                  }}
                >
                  <Save className="w-4 h-4" />
                  В библиотеку
                </button>
                {planOpen ? (
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input
                      type="date"
                      value={planDate}
                      onChange={(e) => setPlanDate(e.target.value)}
                      autoFocus
                      style={{
                        background: "var(--ink-3)",
                        color: "#fff",
                        border: "1px solid rgba(212,168,67,0.4)",
                        borderRadius: 9999,
                        padding: "9px 12px",
                        fontSize: 12,
                        colorScheme: "dark",
                      }}
                    />
                    <button
                      onClick={() => saveToPlan(planDate)}
                      className="btn-gold"
                      style={{ padding: "9px 12px" }}
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setPlanOpen(false)}
                      style={{
                        background: "transparent",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 9999,
                        padding: "9px 12px",
                        color: "var(--muted-foreground)",
                        cursor: "pointer",
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setPlanOpen(true)}
                    className="btn-gold"
                    style={{
                      padding: "10px 16px",
                      fontSize: 13,
                      background: "var(--ink-2)",
                      color: "#fff",
                    }}
                  >
                    <CalendarPlus className="w-4 h-4" />В план
                  </button>
                )}
              </div>

              {/* Большое превью текущего слайда */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  background: "var(--ink-3)",
                  borderRadius: 20,
                  padding: 24,
                }}
              >
                {current && (
                  <div
                    style={{
                      width: "100%",
                      maxWidth: ratio === "9:16" ? 320 : 420,
                    }}
                  >
                    <SlideCanvas
                      slide={current}
                      index={selected}
                      total={slides.length}
                      theme={theme}
                      handle={handle}
                      showPages={showPages}
                      showHandle={showHandle}
                      width={ratio === "9:16" ? 320 : 420}
                      ratio={ratio}
                    />
                  </div>
                )}
              </div>

              {/* Лента слайдов */}
              <div
                className="scroll-strip"
                style={{
                  display: "flex",
                  gap: 10,
                  marginTop: 16,
                  overflowX: "auto",
                  paddingBottom: 8,
                }}
              >
                {slides.map((s, i) => (
                  <button
                    key={s.id}
                    onClick={() => setSelected(i)}
                    style={{
                      flexShrink: 0,
                      width: 92,
                      borderRadius: 10,
                      padding: 0,
                      border:
                        i === selected
                          ? "2px solid var(--brand-gold)"
                          : "2px solid transparent",
                      background: "transparent",
                      cursor: "pointer",
                      position: "relative",
                    }}
                    title={`Слайд ${i + 1}`}
                  >
                    <SlideCanvas
                      slide={s}
                      index={i}
                      total={slides.length}
                      theme={theme}
                      handle={handle}
                      showPages={showPages}
                      showHandle={showHandle}
                      width={88}
                      ratio={ratio}
                    />
                    <span
                      style={{
                        position: "absolute",
                        top: 4,
                        left: 4,
                        background: "rgba(0,0,0,0.6)",
                        color: "#fff",
                        fontSize: 10,
                        fontWeight: 700,
                        borderRadius: 6,
                        padding: "1px 6px",
                      }}
                    >
                      {i + 1}
                    </span>
                  </button>
                ))}
                <button
                  onClick={addSlide}
                  style={{
                    flexShrink: 0,
                    width: 92,
                    aspectRatio: `${dims.w} / ${dims.h}`,
                    borderRadius: 10,
                    border: "2px dashed rgba(255,255,255,0.2)",
                    background: "var(--ink-2)",
                    color: "var(--muted-foreground)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  title="Добавить слайд"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* ПРАВО: панель редактирования */}
            <div className="bento-card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <PanelTab
                  active={panel === "slide"}
                  onClick={() => setPanel("slide")}
                  icon={<TypeIcon className="w-4 h-4" />}
                  label="Слайд"
                />
                <PanelTab
                  active={panel === "design"}
                  onClick={() => setPanel("design")}
                  icon={<Palette className="w-4 h-4" />}
                  label="Дизайн"
                />
              </div>

              <div style={{ padding: 18 }}>
                {panel === "slide" && current ? (
                  <div style={{ display: "grid", gap: 16 }}>
                    <div
                      className="flex items-center justify-between"
                      style={{ gap: 8 }}
                    >
                      <span className="eyebrow">
                        Слайд {selected + 1} / {slides.length}
                      </span>
                      <div style={{ display: "flex", gap: 4 }}>
                        <IconBtn
                          onClick={() => moveSlide(selected, -1)}
                          disabled={selected === 0}
                          title="Влево"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </IconBtn>
                        <IconBtn
                          onClick={() => moveSlide(selected, 1)}
                          disabled={selected === slides.length - 1}
                          title="Вправо"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </IconBtn>
                        <IconBtn
                          onClick={() => duplicateSlide(selected)}
                          title="Дублировать"
                        >
                          <CopyIcon className="w-4 h-4" />
                        </IconBtn>
                        <IconBtn
                          onClick={() => removeSlide(selected)}
                          disabled={slides.length <= 1}
                          title="Удалить"
                        >
                          <Trash2 className="w-4 h-4" />
                        </IconBtn>
                      </div>
                    </div>

                    <Field label="Роль слайда">
                      <div style={{ display: "flex", gap: 6 }}>
                        {(["cover", "content", "cta"] as SlideKind[]).map(
                          (k) => (
                            <Chip
                              key={k}
                              active={current.kind === k}
                              onClick={() =>
                                updateSlide(selected, { kind: k })
                              }
                            >
                              {k === "cover"
                                ? "Обложка"
                                : k === "cta"
                                  ? "CTA"
                                  : "Контент"}
                            </Chip>
                          ),
                        )}
                      </div>
                    </Field>

                    <Field label="Заголовок">
                      <textarea
                        value={current.headline}
                        onChange={(e) =>
                          updateSlide(selected, { headline: e.target.value })
                        }
                        rows={2}
                        style={editAreaStyle}
                      />
                    </Field>
                    <Field label="Текст">
                      <textarea
                        value={current.body}
                        onChange={(e) =>
                          updateSlide(selected, { body: e.target.value })
                        }
                        rows={4}
                        style={editAreaStyle}
                      />
                    </Field>

                    <PhotoField
                      slide={current}
                      onChange={(patch) => updateSlide(selected, patch)}
                    />
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 18 }}>
                    <Field label="Тема оформления">
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: 8,
                        }}
                      >
                        {THEMES.map((t) => (
                          <button
                            key={t.id}
                            onClick={() => {
                              setThemeId(t.id);
                              setAccent(null);
                            }}
                            style={{
                              padding: 10,
                              borderRadius: 12,
                              border:
                                themeId === t.id
                                  ? "2px solid var(--brand-gold)"
                                  : "1px solid rgba(255,255,255,0.08)",
                              background: t.bg,
                              color: t.text,
                              cursor: "pointer",
                              textAlign: "left",
                              fontFamily: t.fontHead,
                              fontSize: 12,
                              fontWeight: 600,
                              minHeight: 52,
                            }}
                          >
                            <span style={{ color: t.accent }}>Aa</span> {t.name}
                          </button>
                        ))}
                      </div>
                    </Field>

                    <Field label="Акцентный цвет">
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {ACCENT_SWATCHES.map((c) => (
                          <button
                            key={c}
                            onClick={() => setAccent(c)}
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 9999,
                              background: c,
                              border:
                                theme.accent === c
                                  ? "2px solid #fff"
                                  : "1px solid rgba(255,255,255,0.2)",
                              cursor: "pointer",
                            }}
                            title={c}
                          />
                        ))}
                        <button
                          onClick={() => setAccent(null)}
                          style={{
                            height: 28,
                            padding: "0 10px",
                            borderRadius: 9999,
                            background: "var(--ink-2)",
                            border: "1px solid rgba(255,255,255,0.12)",
                            color: "var(--muted-foreground)",
                            fontSize: 11,
                            cursor: "pointer",
                          }}
                        >
                          сброс
                        </button>
                      </div>
                    </Field>

                    <Field label="Формат кадра">
                      <div style={{ display: "flex", gap: 6 }}>
                        {(["4:5", "1:1", "9:16"] as Ratio[]).map((r) => (
                          <Chip
                            key={r}
                            active={ratio === r}
                            onClick={() => setRatio(r)}
                          >
                            {r}
                          </Chip>
                        ))}
                      </div>
                    </Field>

                    <Field label="Подпись автора">
                      <input
                        value={handle}
                        onChange={(e) => setHandle(e.target.value)}
                        style={editInputStyle}
                        placeholder="@serbolin"
                      />
                    </Field>

                    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                      <Toggle
                        label="Номера слайдов"
                        on={showPages}
                        onClick={() => setShowPages((v) => !v)}
                      />
                      <Toggle
                        label="Показывать @автора"
                        on={showHandle}
                        onClick={() => setShowHandle((v) => !v)}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Скрытые full-size ноды для экспорта (1080px). */}
      <div
        style={{
          position: "fixed",
          left: -99999,
          top: 0,
          pointerEvents: "none",
          opacity: 0,
        }}
        aria-hidden
      >
        {slides.map((s, i) => (
          <div
            key={s.id}
            ref={(el) => {
              exportRefs.current[i] = el;
            }}
            style={{ width: dims.w }}
          >
            <SlideCanvas
              slide={s}
              index={i}
              total={slides.length}
              theme={theme}
              handle={handle}
              showPages={showPages}
              showHandle={showHandle}
              width={dims.w}
              ratio={ratio}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   SlideCanvas — рендерит один слайд. Все размеры выражены через
   `width`, поэтому превью (420px) и экспорт (1080px) выглядят
   идентично — пропорциональное масштабирование.
   ============================================================ */
function SlideCanvas({
  slide,
  index,
  total,
  theme,
  handle,
  showPages,
  showHandle,
  width,
  ratio,
}: {
  slide: Slide;
  index: number;
  total: number;
  theme: Theme;
  handle: string;
  showPages: boolean;
  showHandle: boolean;
  width: number;
  ratio: Ratio;
}) {
  const dims = RATIO_DIMS[ratio];
  const height = (width * dims.h) / dims.w;
  const u = width / 1080; // unit scale relative to full size
  const pad = 92 * u;
  const isCover = slide.kind === "cover";
  const isCta = slide.kind === "cta";

  const headSize = (isCover ? 92 : 64) * u;
  const bodySize = (isCover ? 34 : 30) * u;
  const kickerSize = 22 * u;

  const overlayAlpha = slide.imageUrl ? (slide.overlay ?? 0.4) : 0;

  return (
    <div
      style={{
        width,
        height,
        background: theme.bg,
        color: theme.text,
        borderRadius: 14 * u,
        overflow: "hidden",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        justifyContent: isCover ? "center" : "flex-start",
        padding: pad,
        boxSizing: "border-box",
        fontFamily: theme.fontBody,
      }}
    >
      {/* Фоновое фото + затемнение под текст. crossOrigin="anonymous"
          + decoding="sync" — на dataURL не влияет, но не вредит, если
          вдруг пришёл внешний URL. */}
      {slide.imageUrl && (
        <>
          <img
            src={slide.imageUrl}
            alt=""
            crossOrigin="anonymous"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              zIndex: 0,
            }}
          />
          {overlayAlpha > 0 && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `linear-gradient(180deg, rgba(0,0,0,${overlayAlpha * 0.7}) 0%, rgba(0,0,0,${overlayAlpha}) 100%)`,
                zIndex: 1,
              }}
            />
          )}
          {/* Поверх — невидимый слой, чтобы контент рендерился над фото. */}
        </>
      )}

      {/* Верхний kicker */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: isCover ? "absolute" : "relative",
          top: isCover ? pad : undefined,
          left: isCover ? pad : undefined,
          right: isCover ? pad : undefined,
          marginBottom: isCover ? 0 : 40 * u,
          zIndex: 2,
        }}
      >
        <span
          style={{
            fontFamily: theme.fontHead,
            fontSize: kickerSize,
            fontWeight: 700,
            letterSpacing: 2 * u,
            textTransform: "uppercase",
            color: theme.accent,
          }}
        >
          {isCover ? "Карусель" : isCta ? "Действие" : "Разбор"}
        </span>
        {showPages && (
          <span
            style={{
              fontFamily: theme.fontHead,
              fontSize: kickerSize,
              fontWeight: 700,
              color: theme.body,
            }}
          >
            {String(index + 1).padStart(2, "0")}/
            {String(total).padStart(2, "0")}
          </span>
        )}
      </div>

      {/* Контент */}
      <div
        style={{
          flex: isCover ? "none" : 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: isCover ? "center" : "flex-start",
          position: "relative",
          zIndex: 2,
        }}
      >
        {/* Акцентная полоса у обложки */}
        {isCover && (
          <div
            style={{
              width: 80 * u,
              height: 8 * u,
              background: theme.accent,
              borderRadius: 9999,
              marginBottom: 36 * u,
            }}
          />
        )}
        <div
          style={{
            fontFamily: theme.fontHead,
            fontSize: headSize,
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: -0.5 * u,
            whiteSpace: "pre-wrap",
          }}
        >
          {slide.headline}
        </div>
        {slide.body && (
          <div
            style={{
              fontSize: bodySize,
              lineHeight: 1.4,
              color: theme.body,
              marginTop: 28 * u,
              whiteSpace: "pre-wrap",
            }}
          >
            {slide.body}
          </div>
        )}

        {/* CTA-кнопка */}
        {isCta && (
          <div
            style={{
              marginTop: 44 * u,
              alignSelf: "flex-start",
              background: theme.accent,
              color: theme.accentText,
              fontFamily: theme.fontHead,
              fontWeight: 700,
              fontSize: 30 * u,
              padding: `${20 * u}px ${40 * u}px`,
              borderRadius: 9999,
            }}
          >
            {handle || "@serbolin"} →
          </div>
        )}
      </div>

      {/* Футер с @автора */}
      {showHandle && !isCta && (
        <div
          style={{
            position: "absolute",
            bottom: pad,
            left: pad,
            fontFamily: theme.fontHead,
            fontSize: kickerSize,
            fontWeight: 600,
            color: theme.body,
            zIndex: 2,
          }}
        >
          {handle}
        </div>
      )}
    </div>
  );
}

/* ---------- мелкие UI-хелперы ---------- */
/* Поле «Фоновое фото» в правой панели слайда. Принимает либо URL
   картинки (jpg/png/webp), либо файл с диска. Оба варианта конвертим
   в dataURL — это нужно, чтобы экспорт PNG через html-to-image не
   падал из-за tainted canvas. Снизу — выбор затемнения для
   читаемости текста на ярких фото. */
function PhotoField({
  slide,
  onChange,
}: {
  slide: Slide;
  onChange: (patch: Partial<Slide>) => void;
}) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const applyUrl = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      const dataUrl = await urlToDataUrl(trimmed);
      onChange({ imageUrl: dataUrl });
      setUrl("");
      if (dataUrl === trimmed) {
        toast.warning(
          "Не смог проксировать URL — превью покажет, но при экспорте PNG может ругнуться (CORS). Если так — скачай фото и загрузи файлом.",
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось загрузить");
    } finally {
      setBusy(false);
    }
  };

  const applyFile = async (file: File) => {
    if (!ALLOWED_MIME.test(file.type)) {
      toast.error("Только JPG, PNG или WebP");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      toast.error("Файл больше 4 МБ — сожми и попробуй ещё раз");
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      onChange({ imageUrl: dataUrl });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось прочитать");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const overlay = slide.overlay ?? 0.4;
  const overlayPresets = [
    { v: 0, label: "Без" },
    { v: 0.3, label: "Лёгкое" },
    { v: 0.55, label: "Среднее" },
    { v: 0.75, label: "Сильное" },
  ];

  return (
    <Field label="Фоновое фото">
      {slide.imageUrl ? (
        <div style={{ display: "grid", gap: 10 }}>
          {/* Превью + кнопка убрать */}
          <div
            style={{
              position: "relative",
              borderRadius: 12,
              overflow: "hidden",
              background: "var(--ink-3)",
              aspectRatio: "4 / 3",
            }}
          >
            <img
              src={slide.imageUrl}
              alt="Фото слайда"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />
            <button
              onClick={() => onChange({ imageUrl: undefined })}
              title="Убрать фото"
              style={{
                position: "absolute",
                top: 8,
                right: 8,
                background: "rgba(0,0,0,0.7)",
                border: 0,
                color: "#fff",
                borderRadius: 9999,
                width: 28,
                height: 28,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <div>
            <div
              className="eyebrow"
              style={{ marginBottom: 6, fontSize: 10 }}
            >
              Затемнение для текста
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {overlayPresets.map((p) => (
                <Chip
                  key={p.v}
                  active={Math.abs(overlay - p.v) < 0.01}
                  onClick={() => onChange({ overlay: p.v })}
                >
                  {p.label}
                </Chip>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyUrl()}
              placeholder="https://… (URL картинки)"
              style={{ ...editInputStyle, flex: 1 }}
            />
            <button
              onClick={applyUrl}
              disabled={busy || !url.trim()}
              className="btn-gold"
              style={{ padding: "8px 14px", fontSize: 12 }}
            >
              {busy ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                "Добавить"
              )}
            </button>
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="btn-gold"
            style={{
              background: "var(--ink-2)",
              color: "#fff",
              justifyContent: "center",
              padding: "10px 14px",
              fontSize: 13,
            }}
          >
            {busy ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Читаю…
              </>
            ) : (
              <>
                <ImageIcon className="w-4 h-4" /> Загрузить файл (JPG/PNG/WebP)
              </>
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) applyFile(f);
            }}
          />
        </div>
      )}
    </Field>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "7px 14px",
        borderRadius: 9999,
        border: 0,
        fontFamily: "var(--font-body)",
        fontSize: 12,
        fontWeight: 600,
        background: active ? "var(--brand-gold)" : "var(--ink-2)",
        color: active ? "var(--ink)" : "#fff",
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

function Inline({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 8, fontSize: 10 }}>
        {label}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{children}</div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 8, fontSize: 10 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function PanelTab({
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
        flex: 1,
        padding: "14px 0",
        border: 0,
        background: active ? "var(--ink-2)" : "transparent",
        color: active ? "var(--brand-gold)" : "var(--muted-foreground)",
        fontFamily: "var(--font-body)",
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function IconBtn({
  onClick,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        width: 30,
        height: 30,
        borderRadius: 8,
        border: "1px solid rgba(255,255,255,0.1)",
        background: "var(--ink-2)",
        color: disabled ? "rgba(255,255,255,0.25)" : "#fff",
        cursor: disabled ? "default" : "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </button>
  );
}

function Toggle({
  label,
  on,
  onClick,
}: {
  label: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        background: "transparent",
        border: 0,
        color: "#fff",
        cursor: "pointer",
        fontSize: 12,
        fontFamily: "var(--font-body)",
      }}
    >
      <span
        style={{
          width: 36,
          height: 20,
          borderRadius: 9999,
          background: on ? "var(--brand-gold)" : "var(--ink-4)",
          position: "relative",
          transition: "background 0.15s",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: on ? 18 : 2,
            width: 16,
            height: 16,
            borderRadius: 9999,
            background: "#fff",
            transition: "left 0.15s",
          }}
        />
      </span>
      {label}
    </button>
  );
}

const editAreaStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--ink-3)",
  color: "#fff",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 12,
  padding: "10px 12px",
  fontSize: 14,
  fontFamily: "var(--font-body)",
  lineHeight: 1.4,
  resize: "vertical",
};

const editInputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--ink-3)",
  color: "#fff",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 12,
  padding: "10px 12px",
  fontSize: 14,
  fontFamily: "var(--font-body)",
};
