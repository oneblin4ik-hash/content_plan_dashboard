/* Crimson Studio Notes: light #F5F6F9 strategy cabinet with glossy coral actions, graphite information hierarchy and 220ms motion. */
import { useEffect, useMemo, useRef, useState, type TouchEvent } from "react";
import {
  ArrowUpRight, CalendarDays, Check, CheckCircle2, ChevronDown, PanelLeftClose, PanelLeftOpen,
  Copy, Download, Flame, Instagram, LayoutDashboard, LoaderCircle, Menu, MessageCircle, Monitor, Moon,
  Pencil, Plus, Printer, Save, Search, Sparkles, Sun, Target, Trash2, TrendingUp, Users, WandSparkles, X
} from "lucide-react";
import { actionChecklist, defaultVoiceProfile, generateHooks, generatePost, generateReel, GeneratedAsset, makePlan, segments, SegmentId, VoiceProfile } from "@/data/strategyData";
import { CalendarEntry, hydrateCalendarEntries, moveCalendarEntry, sortCalendarEntries } from "@/data/calendarModel";
import { productionChecklist, ReelsSegment, reelsExamples, reelsMetrics, reelStructure, viralMechanics } from "@/data/reelsLabData";
import ContentStudio from "@/components/ContentStudio";
import ContentStrategy from "@/components/ContentStrategy";

const nav = [
  ["overview", "Главная", "Главная", LayoutDashboard], ["strategy", "Стратегия", "Контент-стратегия", Target], ["audience", "ЦА", "Целевая аудитория", Users], ["plan", "45 дней", "45-дневный план", CalendarIcon],
  ["calendar", "Календарь", "Календарь", CalendarDays], ["reelslab", "Советы Reels", "Советы по Reels", Sparkles], ["studio", "Studio", "Студия контента", WandSparkles],
] as const;

function CalendarIcon({ size = 18 }: { size?: number }) { return <span style={{ fontSize: size, lineHeight: 1 }}>45</span>; }
type CustomIdea = {
  id: string;
  segmentId: SegmentId;
  channel: "reels" | "telegram";
  title: string;
  hook: string;
  format: string;
  visual: string;
  cta: string;
  createdAt: string;
};

type IdeaDraft = Omit<CustomIdea, "id" | "createdAt">;
type WeeklyContentResult = {
  headline: string;
  summary: string;
  cta: string;
  nextStep: string;
  reelsTopic: string;
  reelsHook: string;
  reelsScenes: Array<{ time: string; shot: string; speech: string; caption: string; edit: string }>;
  telegramTopic: string;
  telegramPost: string;
};
type ThemeMode = "auto" | "light" | "dark";

const emptyDraft: IdeaDraft = {
  segmentId: "S3",
  channel: "reels",
  title: "",
  hook: "",
  format: "Direct-to-camera",
  visual: "",
  cta: "Сохрани и напиши «ПЛАН»",
};

function copyText(value: string, setToast: (value: string) => void) {
  navigator.clipboard?.writeText(value).then(() => setToast("Текст скопирован в буфер"));
}
function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const escape = (value: string) => `"${String(value).replaceAll('"', '""')}"`;
  const csv = [headers, ...rows].map((row) => row.map(escape).join(",")).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url);
}
function printPdf() { window.print(); }

export default function Home() {
  const [segmentId, setSegmentId] = useState<SegmentId>("S3");
  const [channel, setChannel] = useState<"reels" | "telegram">("reels");
  const [phase, setPhase] = useState<"Все" | "База" | "Углубление" | "Доверие и решение">("Все");
  const [query, setQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(() => localStorage.getItem("fitness-strategy-sidebar-collapsed") === "1");
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => (localStorage.getItem("fitness-strategy-theme") as ThemeMode) || "auto");
  const [systemDark, setSystemDark] = useState(false);
  const sidebarTouchStart = useRef<{ x: number; y: number } | null>(null);
  const [sidebarDragX, setSidebarDragX] = useState(0);
  const [sidebarDragging, setSidebarDragging] = useState(false);
  const [processingAction, setProcessingAction] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [customIdeas, setCustomIdeas] = useState<CustomIdea[]>(() => {
    try { return JSON.parse(localStorage.getItem("fitness-strategy-custom-ideas") || "[]"); } catch { return []; }
  });
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<IdeaDraft>(emptyDraft);
  const [voiceProfile, setVoiceProfile] = useState<VoiceProfile>(() => { try { return JSON.parse(localStorage.getItem("fitness-strategy-voice-profile") || "null") || defaultVoiceProfile; } catch { return defaultVoiceProfile; } });
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [generatedAssets, setGeneratedAssets] = useState<GeneratedAsset[]>(() => { try { return JSON.parse(localStorage.getItem("fitness-strategy-generated-assets") || "[]"); } catch { return []; } });
  const [calendarEntries, setCalendarEntries] = useState<CalendarEntry[]>(() => { try { return JSON.parse(localStorage.getItem("fitness-strategy-calendar") || "[]"); } catch { return []; } });
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [generatorType, setGeneratorType] = useState<"post" | "reel" | "hook">("post");
  const [generatorDay, setGeneratorDay] = useState(1);
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [generatedDraft, setGeneratedDraft] = useState("");
  const [calendarStart, setCalendarStart] = useState(1);
  const [draggedAssetId, setDraggedAssetId] = useState<string | null>(null);
  const [reelsSegment, setReelsSegment] = useState<ReelsSegment>("Все");
  const [reelsTab, setReelsTab] = useState<"metrics" | "structure" | "production" | "examples">("metrics");
  const [libraryFilter, setLibraryFilter] = useState<"all" | "ideas" | "generated">("all");
  const [strategyGoal, setStrategyGoal] = useState(() => localStorage.getItem("fitness-strategy-current-goal") || "Получить больше заявок на бесплатный разбор через Reels и Telegram.");
  const [strategyChecklist, setStrategyChecklist] = useState<string[]>(() => { try { const saved = JSON.parse(localStorage.getItem("fitness-strategy-goal-checklist") || "null"); return Array.isArray(saved) && saved.every((item) => typeof item === "string") ? saved : actionChecklist; } catch { return actionChecklist; } });
  const [strategyCompleted, setStrategyCompleted] = useState<boolean[]>(() => { try { const saved = JSON.parse(localStorage.getItem("fitness-strategy-goal-checklist-completed") || "null"); return Array.isArray(saved) ? saved.map(Boolean) : Array(actionChecklist.length).fill(false); } catch { return Array(actionChecklist.length).fill(false); } });
  const [strategyLoading, setStrategyLoading] = useState(false);
  const [weeklySegmentId, setWeeklySegmentId] = useState<SegmentId>(() => (localStorage.getItem("fitness-strategy-weekly-segment") as SegmentId) || "S3");
  const [weeklyGoal, setWeeklyGoal] = useState(() => localStorage.getItem("fitness-strategy-weekly-goal") || "Получить больше заявок на бесплатный разбор");
  const [weeklyContent, setWeeklyContent] = useState<WeeklyContentResult | null>(() => { try { const saved = JSON.parse(localStorage.getItem("fitness-strategy-weekly-content") || "null"); return saved && typeof saved === "object" && typeof saved.reelsTopic === "string" && typeof saved.telegramPost === "string" ? saved as WeeklyContentResult : null; } catch { return null; } });
  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const current = segments.find((item) => item.id === segmentId)!;
  const plan = useMemo(() => makePlan(segmentId), [segmentId]);
  const filtered = plan.filter((item) => (phase === "Все" || item.phase === phase) && item.keyword.includes(query.toLowerCase()));
  const libraryIdeas = customIdeas.filter((item) => item.segmentId === segmentId);
  const libraryGenerated = generatedAssets.filter((asset) => asset.segmentId === segmentId);
  const libraryCount = libraryIdeas.length + libraryGenerated.length;
  const calendarDays = Array.from({ length: 14 }, (_, index) => calendarStart + index).filter((day) => day <= 45);
  const calendarAssets = sortCalendarEntries(calendarEntries.filter((asset) => asset.segmentId === segmentId));
  const visibleReelsExamples = reelsExamples.filter((example) => reelsSegment === "Все" || example.segment === reelsSegment);
  const resolvedTheme = themeMode === "auto" ? (systemDark ? "dark" : "light") : themeMode;
  const themeLabel = themeMode === "auto" ? "Авто" : resolvedTheme === "dark" ? "Ночь" : "День";
  const ThemeIcon = themeMode === "auto" ? Monitor : resolvedTheme === "dark" ? Moon : Sun;

  useEffect(() => { localStorage.setItem("fitness-strategy-sidebar-collapsed", desktopCollapsed ? "1" : "0"); }, [desktopCollapsed]);
  useEffect(() => { localStorage.setItem("fitness-strategy-theme", themeMode); }, [themeMode]);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const syncSystemTheme = () => setSystemDark(media.matches);
    syncSystemTheme();
    media.addEventListener("change", syncSystemTheme);
    return () => media.removeEventListener("change", syncSystemTheme);
  }, []);
  useEffect(() => { document.documentElement.dataset.theme = resolvedTheme; document.documentElement.style.colorScheme = resolvedTheme; }, [resolvedTheme]);
  useEffect(() => { localStorage.setItem("fitness-strategy-custom-ideas", JSON.stringify(customIdeas)); }, [customIdeas]);
  useEffect(() => { localStorage.setItem("fitness-strategy-voice-profile", JSON.stringify(voiceProfile)); }, [voiceProfile]);
  useEffect(() => { localStorage.setItem("fitness-strategy-generated-assets", JSON.stringify(generatedAssets)); }, [generatedAssets]);
  useEffect(() => { setCalendarEntries((previous) => hydrateCalendarEntries(generatedAssets, previous)); }, [generatedAssets]);
  useEffect(() => { localStorage.setItem("fitness-strategy-calendar", JSON.stringify(calendarEntries)); }, [calendarEntries]);
  useEffect(() => { localStorage.setItem("fitness-strategy-current-goal", strategyGoal); }, [strategyGoal]);
  useEffect(() => { localStorage.setItem("fitness-strategy-goal-checklist", JSON.stringify(strategyChecklist)); }, [strategyChecklist]);
  useEffect(() => { localStorage.setItem("fitness-strategy-goal-checklist-completed", JSON.stringify(strategyCompleted)); }, [strategyCompleted]);
  useEffect(() => { localStorage.setItem("fitness-strategy-weekly-segment", weeklySegmentId); }, [weeklySegmentId]);
  useEffect(() => { localStorage.setItem("fitness-strategy-weekly-goal", weeklyGoal); }, [weeklyGoal]);
  useEffect(() => { if (weeklyContent) localStorage.setItem("fitness-strategy-weekly-content", JSON.stringify(weeklyContent)); }, [weeklyContent]);
  useEffect(() => { if (!toast) return; const id = window.setTimeout(() => setToast(""), 2800); return () => clearTimeout(id); }, [toast]);
  useEffect(() => { const demo = new URLSearchParams(window.location.search).get("demo"); if (demo === "voice") setVoiceOpen(true); if (demo === "generator") setGeneratorOpen(true); if (demo === "menu" || demo === "dark-menu") setMobileOpen(true); if (demo === "collapsed") setDesktopCollapsed(true); if (demo === "dark" || demo === "dark-menu") setThemeMode("dark"); if (demo === "light") setThemeMode("light"); }, []);
  useEffect(() => {
    const targetId = window.location.hash.slice(1);
    if (!targetId) return;
    const timeout = window.setTimeout(() => document.getElementById(targetId)?.scrollIntoView({ block: "start" }), 120);
    return () => window.clearTimeout(timeout);
  }, []);

  const openCreateEditor = () => { setEditingId(null); setDraft({ ...emptyDraft, segmentId, channel }); setEditorOpen(true); };
  const openEditEditor = (idea: CustomIdea) => { setEditingId(idea.id); setDraft({ segmentId: idea.segmentId, channel: idea.channel, title: idea.title, hook: idea.hook, format: idea.format, visual: idea.visual, cta: idea.cta }); setEditorOpen(true); };
  const saveIdea = () => {
    if (!draft.title.trim() || !draft.hook.trim()) { setToast("Добавь тему и хук — без них запись не сохранится"); return; }
    if (editingId) {
      setCustomIdeas((prev) => prev.map((idea) => idea.id === editingId ? { ...idea, ...draft, title: draft.title.trim(), hook: draft.hook.trim() } : idea));
      setToast("Материал обновлён");
    } else {
      const id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`;
      setCustomIdeas((prev) => [{ ...draft, id, createdAt: new Date().toISOString() }, ...prev]);
      setToast("Материал добавлен в твою библиотеку");
    }
    setEditorOpen(false); setEditingId(null); setDraft(emptyDraft);
  };
  const deleteIdea = (id: string) => { if (window.confirm("Удалить этот материал?")) { setCustomIdeas((prev) => prev.filter((idea) => idea.id !== id)); setToast("Материал удалён"); } };
  const exportIdeas = () => downloadCsv("fitness-my-ideas.csv", ["Сегмент", "Канал", "Тема", "Хук", "Формат", "Визуал", "CTA"], customIdeas.map((idea) => [idea.segmentId, idea.channel, idea.title, idea.hook, idea.format, idea.visual, idea.cta]));
  const openGenerator = (day: number, type: "post" | "reel" | "hook") => { setGeneratorDay(day); setGeneratorType(type); setEditingAssetId(null); setGeneratedDraft(""); setGeneratorOpen(true); };
  const openGeneratedEdit = (asset: GeneratedAsset) => { setGeneratorDay(asset.sourceDay); setGeneratorType(asset.type); setEditingAssetId(asset.id); setGeneratedDraft(asset.content); setGeneratorOpen(true); };
  const saveGeneratedEdit = () => { if (!editingAssetId || !generatedDraft.trim()) return; setGeneratedAssets((prev) => prev.map((asset) => asset.id === editingAssetId ? { ...asset, content: generatedDraft.trim() } : asset)); setGeneratorOpen(false); setEditingAssetId(null); setGeneratedDraft(""); setToast("Генерация обновлена"); };
  const moveAssetToDay = (assetId: string, day: number) => {
    setGeneratedAssets((prev) => prev.map((asset) => asset.id === assetId ? { ...asset, sourceDay: day } : asset));
    setCalendarEntries((prev) => moveCalendarEntry(prev, assetId, day));
    setToast(`Материал перенесён на день ${day}`);
  };
  const cycleAssetStatus = (assetId: string) => {
    const order: CalendarEntry["status"][] = ["planned", "ready", "published"];
    setCalendarEntries((prev) => prev.map((entry) => { if (entry.id !== assetId) return entry; const next = order[(order.indexOf(entry.status) + 1) % order.length]; return { ...entry, status: next }; }));
  };
  const createGeneratedAsset = (day: number, type: "post" | "reel" | "hook") => {
    setProcessingAction("generator-result");
    window.setTimeout(() => {
      const item = plan.find((entry) => entry.day === day) || plan[0];
      const content = type === "post" ? generatePost(item.title, current.name, voiceProfile) : type === "reel" ? generateReel(item.title, current.name, voiceProfile) : generateHooks(item.title, voiceProfile).join("\n\n");
      const asset: GeneratedAsset = { id: `${Date.now()}-${type}`, sourceDay: item.day, segmentId, channel: type === "reel" ? "reels" : "telegram", type, title: item.title, content, createdAt: new Date().toISOString() };
      setGeneratedAssets((prev) => [asset, ...prev.filter((saved) => !(saved.sourceDay === day && saved.segmentId === segmentId && saved.type === type))]);
      setGeneratorOpen(false); setProcessingAction(null); setToast(type === "post" ? "Пост сгенерирован в стиле Serbolin" : type === "reel" ? "Сценарий Reels готов" : "Варианты хуков готовы");
    }, 420);
  };
  const addStudioAsset = (asset: GeneratedAsset) => {
    setGeneratedAssets((prev) => [asset, ...prev.filter((saved) => saved.id !== asset.id)]);
  };
  const generateStrategyChecklist = async () => {
    if (!strategyGoal.trim()) { setToast("Сначала напиши цель, к которой хочешь прийти"); return; }
    setStrategyLoading(true);
    try {
      const response = await fetch("/api/content-generator", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "strategy_checklist", topic: strategyGoal, goal: "план действий для роста контента", strategyGoal, length: "medium", segment: current, voice: voiceProfile }) });
      const output = await response.json();
      if (!response.ok) throw new Error(output.error || "Не получилось собрать чек-лист");
      const nextChecklist = Array.isArray(output.items) ? output.items.filter((item: unknown) => typeof item === "string" && item.trim()).slice(0, 8) : [];
      if (nextChecklist.length < 3) throw new Error("Чек-лист получился слишком коротким. Попробуй ещё раз.");
      setStrategyChecklist(nextChecklist);
      setStrategyCompleted(Array(nextChecklist.length).fill(false));
      setToast("Чек-лист обновлён под твою цель");
    } catch (error) { setToast(error instanceof Error ? error.message : "Не получилось собрать чек-лист"); }
    finally { setStrategyLoading(false); }
  };
  const generateWeeklyContent = async () => {
    const weeklySegment = segments.find((item) => item.id === weeklySegmentId) || current;
    if (!weeklyGoal.trim()) { setToast("Сначала выбери цель контента на эту неделю"); return; }
    setWeeklyLoading(true);
    try {
      const response = await fetch("/api/content-generator", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "weekly_content_pack", topic: `Контент на неделю для ${weeklySegment.name}: ${weeklyGoal}`, goal: weeklyGoal, strategyGoal, length: "long", segment: weeklySegment, voice: voiceProfile, formula: "Ситуация → конфликт → ответ → доказательство → действие", structure: "Заголовок → ситуация → конфликт → разворот → следующий шаг → CTA", cta: voiceProfile.cta }) });
      const output = await response.json();
      if (!response.ok) throw new Error(output.error || "Не получилось собрать контент на неделю");
      const pack = output.weekly;
      const scenes = Array.isArray(pack?.reelsScenes) ? pack.reelsScenes.filter((scene: unknown) => scene && typeof scene === "object" && typeof (scene as { time?: unknown }).time === "string") : [];
      if (!pack || typeof pack.reelsTopic !== "string" || !pack.reelsTopic.trim() || typeof pack.telegramPost !== "string" || !pack.telegramPost.trim() || scenes.length < 3) throw new Error("Пакет получился неполным. Попробуй собрать его ещё раз.");
      setWeeklyContent({ headline: typeof output.headline === "string" ? output.headline : "Контент на неделю", summary: typeof output.summary === "string" ? output.summary : "Instagram и Telegram раскрывают одну идею для выбранной цели.", cta: typeof output.cta === "string" ? output.cta : voiceProfile.cta, nextStep: typeof output.nextStep === "string" ? output.nextStep : "Сначала сними Reels, затем опубликуй пост в Telegram.", reelsTopic: pack.reelsTopic, reelsHook: typeof pack.reelsHook === "string" ? pack.reelsHook : "", reelsScenes: scenes, telegramTopic: typeof pack.telegramTopic === "string" ? pack.telegramTopic : "Тема поста", telegramPost: pack.telegramPost });
      setToast("Контент на неделю готов: Reels и Telegram-пост собраны");
    } catch (error) { setToast(error instanceof Error ? error.message : "Не получилось собрать контент на неделю"); }
    finally { setWeeklyLoading(false); }
  };
  const exportPlan = () => downloadCsv(`fitness-plan-${segmentId}.csv`, ["День", "Сегмент", "Канал Reels/Telegram", "Фаза", "Тема", "Хук / пост", "Формат", "Визуал", "CTA"], plan.map((item) => [String(item.day), segmentId, channel, item.phase, item.title, channel === "reels" ? item.hook : item.telegram, item.format, item.visual, item.cta]));
  const handleSidebarTouchStart = (event: TouchEvent<HTMLElement>) => {
    if (!mobileOpen || window.innerWidth > 920) return;
    const touch = event.touches[0];
    sidebarTouchStart.current = { x: touch.clientX, y: touch.clientY };
    setSidebarDragX(0);
    setSidebarDragging(false);
  };
  const handleSidebarTouchMove = (event: TouchEvent<HTMLElement>) => {
    const start = sidebarTouchStart.current;
    if (!start || !mobileOpen || window.innerWidth > 920) return;
    const touch = event.touches[0];
    const horizontalDistance = touch.clientX - start.x;
    const verticalDistance = touch.clientY - start.y;
    if (Math.abs(horizontalDistance) > 10 && Math.abs(horizontalDistance) > Math.abs(verticalDistance) * 1.2) {
      setSidebarDragging(true);
      setSidebarDragX(Math.max(-118, Math.min(118, horizontalDistance * 0.72)));
    }
  };
  const handleSidebarTouchEnd = (event: TouchEvent<HTMLElement>) => {
    const start = sidebarTouchStart.current;
    sidebarTouchStart.current = null;
    if (!start || !mobileOpen || window.innerWidth > 920) return;
    const touch = event.changedTouches[0];
    const horizontalDistance = touch.clientX - start.x;
    const verticalDistance = touch.clientY - start.y;
    const closeBySwipe = Math.abs(horizontalDistance) >= 56 && Math.abs(horizontalDistance) > Math.abs(verticalDistance) * 1.35;
    setSidebarDragging(false);
    setSidebarDragX(0);
    if (closeBySwipe) setMobileOpen(false);
  };
  const cycleTheme = () => setThemeMode((currentTheme) => currentTheme === "auto" ? "light" : currentTheme === "light" ? "dark" : "auto");
  const scrollTo = (id: string) => { setMobileOpen(false); document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }); };
  const runWithProcessing = (actionId: string, task: () => void) => {
    if (processingAction) return;
    setProcessingAction(actionId);
    window.setTimeout(() => { task(); window.setTimeout(() => setProcessingAction(null), 420); }, 90);
  };
  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const target = event.target;
      if (target instanceof Element && target.matches("input, textarea, select, [contenteditable='true']")) return;
      const key = event.key.toLowerCase();
      const navIndex = Number(key);
      if (navIndex >= 1 && navIndex <= nav.length) { event.preventDefault(); scrollTo(nav[navIndex - 1][0]); return; }
      if (key === "n") { event.preventDefault(); openCreateEditor(); return; }
      if (key === "e") { event.preventDefault(); runWithProcessing("plan-export", exportPlan); return; }
      if (key === "t") { event.preventDefault(); cycleTheme(); }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [channel, current, processingAction, segmentId, voiceProfile]);

  return (
    <div className="app-shell">
      <aside className={`side-rail ${mobileOpen ? "is-open" : ""} ${desktopCollapsed ? "is-collapsed" : ""} ${sidebarDragging ? "is-dragging" : ""}`} aria-label="Навигация" style={mobileOpen && sidebarDragX ? { transform: `translate3d(${sidebarDragX}px, 0, 0)` } : undefined} onTouchStart={handleSidebarTouchStart} onTouchMove={handleSidebarTouchMove} onTouchEnd={handleSidebarTouchEnd} onTouchCancel={() => { sidebarTouchStart.current = null; setSidebarDragging(false); setSidebarDragX(0); }}>
        <button className="rail-collapse-toggle" onClick={() => setDesktopCollapsed((value) => !value)} aria-label={desktopCollapsed ? "Развернуть панель" : "Свернуть панель"} aria-expanded={!desktopCollapsed} data-tooltip={desktopCollapsed ? "Развернуть панель" : "Свернуть панель"}>
          {desktopCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
        </button>
        <div className="spine-brand" aria-hidden="true">
          <img src="/manus-storage/fitness-strategy-crimson-mark_fb98f79c.png" alt="" />
          <span>FITNESS<br />STRATEGY</span>
          <b>45D</b>
        </div>
        <div className="brand-lockup">
          <img src="/manus-storage/fitness-strategy-crimson-mark_fb98f79c.png" alt="Fitness Strategy Hub" className="brand-mark" />
          <div><strong>FITNESS</strong><span>STRATEGY HUB</span></div>
        </div>
        <div className="rail-caption">Личный кабинет<br />контент-стратегии</div>
        <nav className="nav-list">
          {nav.map(([id, label, fullLabel, Icon], index) => {
            const shortcut = index === 9 ? "0" : String(index + 1);
            return <button key={id} className={index === 0 ? "nav-link active" : "nav-link"} onClick={() => scrollTo(id)} title={`${fullLabel} · Alt + ${shortcut}`} aria-label={fullLabel} aria-keyshortcuts={`Alt+${shortcut}`}>
              <Icon size={18} /><span>{label}</span><small>⌥{shortcut}</small>
            </button>
          })}
        </nav>
        <div className="rail-bottom">
          <div className="mini-profile"><div className="profile-dot">ЭС</div><div><b>Эдуард Серболин</b><span>online trainer</span></div></div>
          <p>Версия стратегии<br /><b>14.08.2026</b></p>
        </div>
      </aside>
      {mobileOpen && <button aria-label="Закрыть меню" className="scrim" data-tooltip="Закрыть меню" onClick={() => setMobileOpen(false)} />}

      <main className={`main-canvas ${desktopCollapsed ? "has-collapsed-rail" : ""}`}>
        <header className="topbar">
          <button className="menu-button" onClick={() => setMobileOpen(true)} aria-label="Открыть меню" data-tooltip="Открыть меню"><Menu size={20} /></button>
          <div className="breadcrumb"><span>Стратегия</span><b> / </b><strong>Актуальная версия</strong></div>
          <div className="top-actions"><span className="status-dot">Рабочая база</span><button className="theme-button" onClick={cycleTheme} aria-label={`Тема: ${themeLabel}. Нажмите, чтобы переключить режим`} data-tooltip="Тема: Авто → День → Ночь · ⌥T" aria-keyshortcuts="Alt+T"><ThemeIcon size={15} /><span>{themeLabel}</span><kbd>⌥T</kbd></button><button className="secondary-circle" onClick={() => setToast("Версия сохранена локально")} aria-label="Сохранить" data-tooltip="Сохранить локальную версию"><Check size={18} /></button></div>
        </header>

        <section id="overview" className="hero-section section-anchor">
          <img className="hero-art" src="/manus-storage/fitness-strategy-hero-paper_59af752a.png" alt="" />
          <div className="hero-kicker"><span className="eyebrow">/ 01 · твой кабинет</span><span className="mono">8 489 · Instagram</span></div>
          <div className="hero-grid">
            <div className="hero-copy">
              <h1>Контент<br />без <em>лишнего шума.</em></h1>
              <p>Задай цель, выбери аудиторию и собери Reels или пост. Всё нужное для регулярной работы — в одном месте.</p>
              <div className="hero-buttons"><button className="primary-button" onClick={() => scrollTo("strategy")} data-tooltip="Открыть контент-стратегию · ⌥2" aria-keyshortcuts="Alt+2"><span>Поставить цель</span><kbd>⌥2</kbd><ArrowUpRight size={17} /></button><button className="text-button" onClick={() => scrollTo("audience")} data-tooltip="Открыть целевую аудиторию · ⌥3" aria-keyshortcuts="Alt+3">Посмотреть ЦА <kbd>⌥3</kbd><ChevronDown size={16} /></button></div>
            </div>
            <div className="hero-signal glass-card">
              <span className="eyebrow">главный сигнал</span>
              <div className="signal-index">S3</div>
              <h2>Форма<br />в реальном графике</h2>
              <p>Основной сегмент: занятая женщина, которой нужен план А / Б / В — а не идеальная неделя.</p>
              <div className="signal-footer"><span>Приоритет</span><b>01 / 04</b></div>
            </div>
          </div>
          <div className="metric-strip">
            <Metric value="12+" label="лет опыта" /> <Metric value="25K" label="флагман" suffix=" ₽" /> <Metric value="45" label="дней плана" /> <Metric value="4" label="сегмента" />
          </div>
        </section>

        <ContentStrategy goal={strategyGoal} onGoalChange={setStrategyGoal} checklist={strategyChecklist} completed={strategyCompleted} onToggle={(index) => setStrategyCompleted((previous) => previous.map((value, itemIndex) => itemIndex === index ? !value : value))} onGenerate={generateStrategyChecklist} isGenerating={strategyLoading} segment={current} onOpenStudio={() => scrollTo("studio")} weeklySegmentId={weeklySegmentId} onWeeklySegmentChange={(value) => setWeeklySegmentId(value as SegmentId)} weeklyGoal={weeklyGoal} onWeeklyGoalChange={setWeeklyGoal} weeklyResult={weeklyContent} onBuildWeeklyContent={generateWeeklyContent} isBuildingWeeklyContent={weeklyLoading} onToast={setToast} />

        <section id="audience" className="section-anchor section-block">
          <SectionTitle index="03" eyebrow="целевая аудитория" title="ЦА: четыре ситуации, в которых женщина узнаёт себя." text="Здесь собраны сегменты, боли, страхи, триггеры и офферы. Выбери один сегмент, и он станет основой плана и Studio." />
          <div className="segment-selector">
            {segments.map((item) => <button key={item.id} onClick={() => setSegmentId(item.id)} className={`segment-tab ${item.id === segmentId ? "selected" : ""}`}><span>{item.id}</span><b>{item.name}</b><i>{item.title}</i></button>)}
          </div>
          <div className="segment-detail glass-card">
            <div className="segment-number" style={{ color: current.color }}>{current.id}</div>
            <div className="segment-main"><span className="eyebrow">{current.name}</span><h2>{current.title}</h2><p>{current.subtitle}</p></div>
            <InfoUnit label="Хочет" text={current.goal} />
            <InfoUnit label="Боится" text={current.fear} />
            <InfoUnit label="Откликается" text={current.trigger} />
            <div className="detail-offer"><span>Оффер</span><b>{current.offer}</b><ArrowUpRight size={17} /></div>
          </div>
          <div className="pain-grid">
            <PainCard number="01" title="Функционально" text="Нет последовательности: что делать сегодня, что менять через неделю и как понять, что пора двигаться дальше." action="Карты этапов, разборы недели и мини-чек-листы." />
            <PainCard number="02" title="Эмоционально" text="Прошлые попытки закрепили ожидание провала. Срыв воспринимается как отмена всего процесса." action="Сценарии возврата и истории без идеальности." />
            <PainCard number="03" title="Контроль" text="Онлайн воспринимается как программа без человека рядом — пока не показан реальный процесс сопровождения." action="Отчёт → обратная связь → корректировка → следующий шаг." />
          </div>
        </section>

        <section id="plan" className="section-anchor section-block planner-section">
          <SectionTitle index="04" eyebrow="контент-план" title="45 дней: темы, визуал и следующий шаг." text="Выбери сегмент и формат. Потом бери готовую тему, хук и идею для кадра." />
          <div className="planner-toolbar glass-card">
            <div className="channel-toggle"><button className={channel === "reels" ? "active" : ""} onClick={() => setChannel("reels")}><Instagram size={17} /> Reels</button><button className={channel === "telegram" ? "active" : ""} onClick={() => setChannel("telegram")}><MessageCircle size={17} /> Telegram</button></div>
            <div className="phase-filter">{(["Все", "База", "Углубление", "Доверие и решение"] as const).map((item) => <button key={item} className={phase === item ? "selected" : ""} onClick={() => setPhase(item)}>{item}</button>)}</div>
            <label className="search-box"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск по теме" /></label>
          </div>
          <div className="voice-toolbar glass-card"><div><span className="eyebrow">голос автора</span><b>{voiceProfile.name}</b><p>{voiceProfile.tone} · {voiceProfile.address} · {voiceProfile.energy}</p></div><button className="secondary-button compact-secondary" onClick={() => setVoiceOpen(true)}><Pencil size={14} /> Настроить тон</button></div>
          <div className="material-library glass-card">
            <div className="custom-library-head"><div><span className="eyebrow">единая библиотека</span><h2>Материалы <span>{libraryCount}</span></h2><p>Собственные идеи и готовые генерации — в одном месте, с быстрым доступом к копированию и редактированию.</p></div><div className="library-actions"><button className="secondary-button compact-secondary" onClick={() => runWithProcessing("ideas-export", exportIdeas)} disabled={processingAction === "ideas-export"} data-tooltip="Скачать собственные идеи в CSV">{processingAction === "ideas-export" ? <LoaderCircle className="button-spinner" size={14} /> : <Download size={14} />}{processingAction === "ideas-export" ? "Готовлю…" : "CSV идей"}</button><button className="primary-button compact-button" onClick={openCreateEditor} data-tooltip="Создать свою тему или хук · ⌥N" aria-keyshortcuts="Alt+N"><Plus size={17} /><span>Новая идея</span><kbd>⌥N</kbd></button></div></div>
            <div className="library-filter" aria-label="Фильтр библиотеки"><button className={libraryFilter === "all" ? "active" : ""} onClick={() => setLibraryFilter("all")}>Все <span>{libraryCount}</span></button><button className={libraryFilter === "ideas" ? "active" : ""} onClick={() => setLibraryFilter("ideas")}>Идеи <span>{libraryIdeas.length}</span></button><button className={libraryFilter === "generated" ? "active" : ""} onClick={() => setLibraryFilter("generated")}>Генерации <span>{libraryGenerated.length}</span></button>{libraryGenerated.length > 0 && <button className="library-clear" onClick={() => setGeneratedAssets((previous) => previous.filter((asset) => asset.segmentId !== segmentId))}><Trash2 size={14} /> Очистить генерации</button>}</div>
            {libraryCount > 0 ? <div className="library-material-grid">
              {libraryFilter !== "generated" && libraryIdeas.map((idea) => <article className="custom-idea" key={`idea-${idea.id}`}><div className="custom-idea-top"><span>ИДЕЯ · {idea.channel === "reels" ? "REELS" : "TELEGRAM"}</span><small>{idea.format}</small></div><h3>{idea.title}</h3><p>{idea.hook}</p><div className="custom-idea-meta"><span>{idea.visual || "Визуал добавь при подготовке"}</span><b>{idea.cta}</b></div><div className="custom-idea-actions"><button onClick={() => copyText(idea.hook, setToast)}><Copy size={15} /> Копировать хук</button><button onClick={() => openEditEditor(idea)}><Pencil size={15} /> Изменить</button><button className="danger-action" onClick={() => deleteIdea(idea.id)}><Trash2 size={15} /> Удалить</button></div></article>)}
              {libraryFilter !== "ideas" && libraryGenerated.map((asset) => <article className="generated-card" key={`generated-${asset.id}`}><div className="generated-card-top"><span>ГЕНЕРАЦИЯ · {asset.type === "post" ? "ПОСТ" : asset.type === "reel" ? "REELS" : "ХУКИ"}</span><small>ДЕНЬ {asset.sourceDay}</small></div><h3>{asset.title}</h3><p>{asset.content}</p><div className="generated-card-actions"><button className="secondary-button compact-secondary" onClick={() => copyText(asset.content, setToast)}><Copy size={14} /> Копировать</button><button className="secondary-button compact-secondary" onClick={() => openGeneratedEdit(asset)}><Pencil size={14} /> Изменить</button></div></article>)}
            </div> : <div className="custom-empty"><Sparkles size={19} /><span>Для {current.name.toLowerCase()} пока нет материалов. Добавьте идею или сохраните генерацию из плана либо Studio.</span><button className="text-button" onClick={openCreateEditor}>Создать первую идею <ArrowUpRight size={15} /></button></div>}
          </div>
          <div className="plan-meta"><div><span className="eyebrow">маршрут для {current.id}</span><h2>{current.name}: {current.title}</h2></div><div className="plan-meta-actions"><button className="secondary-button compact-secondary" onClick={() => runWithProcessing("plan-export", exportPlan)} disabled={processingAction === "plan-export"} data-tooltip="Скачать 45-дневный план в CSV · ⌥E" aria-keyshortcuts="Alt+E">{processingAction === "plan-export" ? <LoaderCircle className="button-spinner" size={14} /> : <Download size={14} />}{processingAction === "plan-export" ? "Готовлю план…" : "CSV плана"}<kbd>⌥E</kbd></button><button className="secondary-button compact-secondary" onClick={printPdf} data-tooltip="Открыть 45-дневный план для печати"><Printer size={14} /> PDF / печать</button><span className="plan-count">{filtered.length} материалов</span></div></div>
          <div className="plan-list">{(["База", "Углубление", "Доверие и решение"] as const).filter((group) => phase === "Все" || phase === group).map((group, groupIndex) => {
            const groupItems = filtered.filter((item) => item.phase === group);
            if (!groupItems.length) return null;
            const phaseDays = groupIndex === 0 ? "01–15" : groupIndex === 1 ? "16–30" : "31–45";
            const phaseText = groupIndex === 0 ? "Познакомь с системой и помоги увидеть себя в ситуации." : groupIndex === 1 ? "Дай рабочие инструменты и покажи жизнь между тренировками." : "Докажи процесс сопровождения и мягко веди к диагностике.";
            return <div className="plan-phase-group" key={group}>
              <div className="phase-divider"><div className="phase-step"><span>ФАЗА 0{groupIndex + 1}</span><b>{group}</b><p>{phaseText}</p></div><div className="phase-route"><span>{phaseDays}</span><div><i /><i /><i /><i /><i /></div><b>{groupItems.length} материалов</b></div></div>
              {groupItems.map((item) => <article className="plan-card" key={item.day}><div className="day-block"><span>ДЕНЬ</span><b>{String(item.day).padStart(2, "0")}</b></div><div className="plan-info"><div className="plan-tags"><span className={`tag ${item.accent.toLowerCase().replaceAll(" ", "-")}`}>{item.accent}</span><span>{item.phase}</span><span>{item.format}</span></div><h3>{channel === "reels" ? item.title : item.telegram}</h3><p>{channel === "reels" ? item.hook : `Раскрой тему из Reels: добавь пример, чек-лист или опрос. ${item.telegram}`}</p></div><div className="plan-visual"><span>{channel === "reels" ? "ВИЗУАЛ" : "МЕХАНИКА"}</span><p>{channel === "reels" ? item.visual : "Развёрнутый разбор + опрос / реакции + мягкий переход к диагностике"}</p></div><div className="plan-actions"><button onClick={() => copyText(channel === "reels" ? item.hook : item.telegram, setToast)} aria-label="Копировать"><Copy size={17} /></button><div className="generate-mini-actions"><button onClick={() => openGenerator(item.day, "post")}>Пост</button><button onClick={() => openGenerator(item.day, "reel")}>Reels</button><button onClick={() => openGenerator(item.day, "hook")}>Хуки</button></div><span>{item.cta}</span></div></article>)}</div>;
          })}</div>
        </section>

        <section id="calendar" className="section-anchor section-block calendar-section">
          <SectionTitle index="05" eyebrow="календарь" title="Разложи материалы по дням." text="Перетаскивай сохранённые Reels, посты и хуки. Расписание останется в браузере." />
          <div className="calendar-toolbar glass-card">
            <div><span className="eyebrow">маршрут {segmentId}</span><h2>{calendarAssets.length} материалов в расписании</h2></div>
            <div className="calendar-nav"><button disabled={calendarStart === 1} onClick={() => setCalendarStart((value) => Math.max(1, value - 14))}>← Предыдущие</button><span>Дни {calendarStart}–{Math.min(calendarStart + 13, 45)}</span><button disabled={calendarStart >= 29} onClick={() => setCalendarStart((value) => Math.min(29, value + 14))}>Следующие →</button></div>
          </div>
          <div className="calendar-grid">
            {calendarDays.map((day) => {
              const dayAssets = calendarAssets.filter((asset) => asset.sourceDay === day);
              const planItem = plan.find((item) => item.day === day);
              return <div className={`calendar-day ${draggedAssetId ? "drop-ready" : ""}`} key={day} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (draggedAssetId) { moveAssetToDay(draggedAssetId, day); setDraggedAssetId(null); } }}>
                <div className="calendar-day-head"><div><span>ДЕНЬ</span><b>{String(day).padStart(2, "0")}</b></div><small>{planItem?.phase || "Свободный слот"}</small></div>
                <div className="calendar-day-topic">{planItem?.title || "Перетащи материал сюда"}</div>
                <div className="calendar-assets">{dayAssets.length === 0 ? <div className="calendar-empty">Пустой слот<br /><span>Перетащи сюда генерацию</span></div> : dayAssets.map((asset) => <article className={`calendar-asset asset-${asset.type}`} draggable key={asset.id} onDragStart={() => setDraggedAssetId(asset.id)} onDragEnd={() => setDraggedAssetId(null)}><div className="calendar-asset-meta"><span>{asset.type === "post" ? "ПОСТ" : asset.type === "reel" ? "REELS" : "ХУКИ"}</span><small>{asset.channel === "telegram" ? "Telegram" : "Instagram"}</small></div><h3>{asset.title}</h3><p>{asset.content.slice(0, 108)}{asset.content.length > 108 ? "…" : ""}</p><div className="calendar-asset-actions"><button className={`status-pill status-${asset.status}`} onClick={() => cycleAssetStatus(asset.id)} title="Сменить статус">{asset.status === "planned" ? "План" : asset.status === "ready" ? "Готово" : "Опубликовано"}</button><button onClick={() => openGeneratedEdit(asset)}><Pencil size={13} /> Изменить</button><button onClick={() => copyText(asset.content, setToast)}><Copy size={13} /> Копировать</button></div></article>)}</div>
              </div>;
            })}
          </div>
          <div className="calendar-hint"><CalendarDays size={17} /><span>Зажми карточку и перетащи её в другой день. Расписание сохраняется автоматически.</span><button className="secondary-button" onClick={() => scrollTo("plan")}>Добавить генерацию <ArrowUpRight size={16} /></button></div>
        </section>

        <section id="reelslab" className="section-anchor section-block reels-lab-section">
          <SectionTitle index="06" eyebrow="советы по reels" title="Как снять ролик, который хочется досмотреть." text="Понятные подсказки по сценарию, кадрам, монтажу и примерам для каждой аудитории." />
          <div className="reels-lab-toolbar glass-card"><div className="reels-tabs">{([['metrics','Метрики'],['structure','Сценарий'],['production','Съёмка и монтаж'],['examples','Примеры']] as const).map(([id,label]) => <button key={id} className={reelsTab === id ? "active" : ""} onClick={() => setReelsTab(id)}>{label}</button>)}</div><div className="reels-segment-filter">{(['Все','S1','S2','S3','S4'] as const).map((id) => <button key={id} className={reelsSegment === id ? "selected" : ""} onClick={() => setReelsSegment(id)}>{id}</button>)}</div></div>
          {reelsTab === "metrics" && <div className="reels-metrics-grid">{reelsMetrics.map((metric) => <article className="reels-metric-card" key={metric.label}><span className="eyebrow">{metric.label}</span><strong>{metric.target}</strong><p>{metric.why}</p><div><TrendingUp size={14} />{metric.action}</div></article>)}</div>}
          {reelsTab === "structure" && <div className="reels-structure"><div className="reels-structure-track">{reelStructure.map((step, index) => <article key={step.time}><span className="structure-time">{step.time}</span><b>0{index + 1}</b><h3>{step.title}</h3><p>{step.text}</p><div>{step.examples.map((example) => <span key={example}>“{example}”</span>)}</div></article>)}</div><div className="reels-formula-card"><span className="eyebrow">формула удержания</span><h2>Ситуация → конфликт → ответ → доказательство → действие</h2><p>Каждые 3–5 секунд зритель должен понимать, зачем смотреть дальше. Один ролик — одна проблема и один следующий шаг.</p></div></div>}
          {reelsTab === "production" && <div className="production-grid">{productionChecklist.map((group) => <article className="production-card" key={group.title}><span className="eyebrow">{group.title}</span><div>{group.items.map((item) => <p key={item}><CheckCircle2 size={15} />{item}</p>)}</div></article>)}</div>}
          {reelsTab === "examples" && <div className="reels-examples-grid">{visibleReelsExamples.map((example) => <article className="reels-example-card" key={example.segment}><div className="reels-example-head"><span>{example.segment} · {example.label}</span><b>{example.objective}</b></div><h2>{example.title}</h2><div className="example-hook">{example.hook}</div><div className="example-row"><span>Кадр</span><p>{example.shot}</p></div><div className="example-row"><span>Текст</span><p>{example.script}</p></div><div className="example-row"><span>Монтаж</span><p>{example.edit}</p></div><button className="secondary-button" onClick={() => copyText(`${example.hook}\n\n${example.script}\n\nCTA: ${example.cta}`, setToast)}><Copy size={15} /> Скопировать сценарий</button></article>)}</div>}
          <div className="viral-mechanics"><div><span className="eyebrow">что даёт пересылку и возвращение</span><h2>Виральность — это узнаваемая ситуация, не случайный звук.</h2></div><div className="viral-mechanics-list">{viralMechanics.map((item, index) => <div key={item.title}><span>0{index + 1}</span><p><b>{item.title}</b>{item.text}</p></div>)}</div></div>
        </section>

        <ContentStudio segment={current} voice={voiceProfile} strategyGoal={strategyGoal} onToast={setToast} onSaveAsset={addStudioAsset} />

        <footer><span>Fitness Strategy Hub · личное использование</span><span>Crimson light system · 2026</span></footer>
      </main>
      {voiceOpen && <div className="editor-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setVoiceOpen(false); }}><section className="editor-modal voice-modal" role="dialog" aria-modal="true" aria-labelledby="voice-title"><div className="editor-modal-head"><div><span className="eyebrow">профиль стиля · Telegram</span><h2 id="voice-title">Голос автора</h2></div><button className="modal-close" onClick={() => setVoiceOpen(false)} aria-label="Закрыть"><X size={18} /></button></div><p className="voice-intro">Профиль собран по публичной выборке @Serbolin: прямой разговорный тон, обращение на «ты», контраст, кейсы, цифры, самоирония и CTA через вопрос, кодовое слово или гайд. Поля можно изменить под текущую задачу.</p><div className="editor-fields voice-fields">{([['name','Название профиля'],['tone','Тон'],['address','Обращение'],['energy','Энергия'],['humor','Юмор и самоирония'],['structure','Структура'],['proof','Доказательства'],['cta','CTA'],['avoid','Избегать'],['notes','Заметки']] as const).map(([key,label]) => <label className={key === 'structure' || key === 'proof' || key === 'cta' || key === 'avoid' || key === 'notes' ? 'field-wide' : ''} key={key}><span>{label}</span><textarea rows={key === 'notes' ? 3 : 2} value={voiceProfile[key]} onChange={(event) => setVoiceProfile((prev) => ({ ...prev, [key]: event.target.value }))} /></label>)}</div><div className="editor-modal-foot"><span>Профиль сохраняется в этом браузере</span><div><button className="secondary-button" onClick={() => { setVoiceProfile(defaultVoiceProfile); setToast("Профиль сброшен к анализу Serbolin"); }}>Сбросить анализ</button><button className="primary-button" onClick={() => { setVoiceOpen(false); setToast("Голос автора сохранён"); }}><Save size={16} /> Сохранить профиль</button></div></div></section></div>}
        {generatorOpen && <div className="editor-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setGeneratorOpen(false); }}><section className="editor-modal generator-modal" role="dialog" aria-modal="true" aria-labelledby="generator-title"><div className="editor-modal-head"><div><span className="eyebrow">авторская генерация · день {generatorDay}</span><h2 id="generator-title">{generatorType === 'post' ? 'Пост в Telegram' : generatorType === 'reel' ? 'Сценарий Reels' : 'Варианты хуков'}</h2></div><button className="modal-close" onClick={() => setGeneratorOpen(false)} aria-label="Закрыть" data-tooltip="Закрыть окно"><X size={18} /></button></div><div className="generator-choice"><button className={generatorType === 'post' ? 'selected' : ''} onClick={() => setGeneratorType('post')}>Пост</button><button className={generatorType === 'reel' ? 'selected' : ''} onClick={() => setGeneratorType('reel')}>Reels</button><button className={generatorType === 'hook' ? 'selected' : ''} onClick={() => setGeneratorType('hook')}>Хуки</button></div><div className="generator-preview"><span className="eyebrow">{editingAssetId ? "редактирование сохраненной генерации" : `${voiceProfile.name} · ${current.name}`}</span>{editingAssetId ? <textarea className="generated-edit-area" value={generatedDraft} onChange={(event) => setGeneratedDraft(event.target.value)} rows={15} /> : <p>{generatorType === 'post' ? generatePost(plan.find((item) => item.day === generatorDay)?.title || '', current.name, voiceProfile) : generatorType === 'reel' ? generateReel(plan.find((item) => item.day === generatorDay)?.title || '', current.name, voiceProfile) : generateHooks(plan.find((item) => item.day === generatorDay)?.title || '', voiceProfile).join('\n\n')}</p>}</div><div className="editor-modal-foot"><span>{editingAssetId ? "Изменения сохраняются в браузере" : "Генерация основана на профиле твоего голоса"}</span><div><button className="secondary-button" onClick={() => copyText(editingAssetId ? generatedDraft : generatorType === 'post' ? generatePost(plan.find((item) => item.day === generatorDay)?.title || '', current.name, voiceProfile) : generatorType === 'reel' ? generateReel(plan.find((item) => item.day === generatorDay)?.title || '', current.name, voiceProfile) : generateHooks(plan.find((item) => item.day === generatorDay)?.title || '', voiceProfile).join('\n\n'), setToast)} data-tooltip="Скопировать готовый материал"><Copy size={15} /> Копировать</button><button className={`primary-button ${processingAction === "generator-result" ? "is-processing" : ""}`} disabled={processingAction === "generator-result"} onClick={() => editingAssetId ? saveGeneratedEdit() : createGeneratedAsset(generatorDay, generatorType)} data-tooltip={editingAssetId ? "Сохранить изменения" : "Собрать и сохранить материал"}>{processingAction === "generator-result" ? <LoaderCircle className="button-spinner" size={15} /> : <Sparkles size={15} />}{processingAction === "generator-result" ? "Собираю материал…" : editingAssetId ? "Сохранить изменения" : "Сохранить результат"}</button></div></div></section></div>}
      {editorOpen && <div className="editor-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditorOpen(false); }}><section className="editor-modal" role="dialog" aria-modal="true" aria-labelledby="editor-title"><div className="editor-modal-head"><div><span className="eyebrow">личный редактор</span><h2 id="editor-title">{editingId ? "Изменить материал" : "Новая идея"}</h2></div><button className="modal-close" onClick={() => setEditorOpen(false)} aria-label="Закрыть"><X size={18} /></button></div><div className="editor-fields"><label><span>Сегмент</span><select value={draft.segmentId} onChange={(event) => setDraft((prev) => ({ ...prev, segmentId: event.target.value as SegmentId }))}>{segments.map((item) => <option key={item.id} value={item.id}>{item.id} · {item.name}</option>)}</select></label><label><span>Канал</span><select value={draft.channel} onChange={(event) => setDraft((prev) => ({ ...prev, channel: event.target.value as "reels" | "telegram" }))}><option value="reels">Instagram Reels</option><option value="telegram">Telegram</option></select></label><label className="field-wide"><span>Тема *</span><input autoFocus value={draft.title} onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))} placeholder="Например: Питание в офисный день" /></label><label className="field-wide"><span>Цепляющий хук *</span><textarea value={draft.hook} onChange={(event) => setDraft((prev) => ({ ...prev, hook: event.target.value }))} placeholder="Например: Твой обед не должен быть идеальным, чтобы работать на форму." rows={3} /></label><label><span>Формат</span><select value={draft.format} onChange={(event) => setDraft((prev) => ({ ...prev, format: event.target.value }))}><option>Direct-to-camera</option><option>POV</option><option>Saveable how-to</option><option>Миф / реальность</option><option>Кейс</option><option>Разбор питания</option><option>Storytime</option></select></label><label><span>CTA</span><input value={draft.cta} onChange={(event) => setDraft((prev) => ({ ...prev, cta: event.target.value }))} placeholder="Сохрани и напиши «ПЛАН»" /></label><label className="field-wide"><span>Визуал / механика</span><textarea value={draft.visual} onChange={(event) => setDraft((prev) => ({ ...prev, visual: event.target.value }))} placeholder="Что будет в кадре, какая обложка или механика вовлечения" rows={2} /></label></div><div className="editor-modal-foot"><span>Сохраняется в этом браузере</span><div><button className="secondary-button" onClick={() => setEditorOpen(false)}>Отмена</button><button className="primary-button" onClick={saveIdea}><Save size={16} /> {editingId ? "Сохранить изменения" : "Добавить идею"}</button></div></div></section></div>}
      {toast && <div className="toast"><CheckCircle2 size={18} />{toast}</div>}
    </div>
  );
}

function Metric({ value, label, suffix = "" }: { value: string; label: string; suffix?: string }) { return <div><b>{value}<small>{suffix}</small></b><span>{label}</span></div>; }
function SectionTitle({ index, eyebrow, title, text }: { index: string; eyebrow: string; title: string; text: string }) { return <div className="section-title"><div><span className="section-index">{index}</span><img className="section-stamp" src="/manus-storage/fitness-strategy-crimson-mark_fb98f79c.png" alt="" /><span className="eyebrow">{eyebrow}</span></div><h2>{title}</h2><p>{text}</p></div>; }
function InfoUnit({ label, text }: { label: string; text: string }) { return <div className="info-unit"><span>{label}</span><p>{text}</p></div>; }
function PainCard({ number, title, text, action }: { number: string; title: string; text: string; action: string }) { return <article className="pain-card"><span>{number}</span><h3>{title}</h3><p>{text}</p><div><Flame size={16} />{action}</div></article>; }
