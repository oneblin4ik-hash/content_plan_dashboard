import { trpc } from "@/lib/trpc";
import { FavoritesView, IdeaModal, IdeasView, LibraryView, StudioView, type ViralIdea } from "@/components/content-studio/StudioViews";
import { priorityLabels, statusLabels } from "@shared/contentStudio";
import {
  BarChart3, BookOpenText, CalendarDays, Check, ChevronRight, ClipboardCopy, FilePlus2, FolderPlus, Heart,
  LayoutGrid, Library, Lightbulb, LoaderCircle, MessageCircle, MoreHorizontal, PenLine, Plus,
  Search, Sparkles, Target, Trash2, Users, Video, X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState, type TouchEvent } from "react";

type View = "ideas" | "studio" | "favorites" | "plan" | "library" | "voice" | "analytics";
type Modal = "idea" | "folder" | "metric" | null;

export type StudioData = {
  folders: Array<{ id: number; name: string; color: string }>;
  items: Array<{ id: number; folderId: number | null; kind: "idea" | "post" | "reel"; channel: "telegram" | "reels" | "both"; status: "draft" | "planned" | "ready" | "published"; priority: "low" | "medium" | "high" | "viral"; segmentId: string; title: string; hook: string | null; body: string | null; format: string | null; visual: string | null; cta: string | null; notes: string | null; scheduledFor: Date | null; isFavorite: boolean; updatedAt: Date }>;
  templates: Array<{ id: number; kind: "post" | "reel"; name: string; description: string | null; structure: string; isActive: boolean }>;
  voice: { id: number; name: string; tone: string; address: string; energy: string; structure: string; proof: string; cta: string; avoid: string; notes: string | null } | null;
  segments: Array<{ id: number; code: string; name: string; title: string; subtitle: string; goal: string; pain: string; fear: string; trigger: string; offer: string; color: string }>;
  metrics: Array<{ id: number; itemId: number; views: number; reactions: number; comments: number; saves: number; shares: number; linkClicks: number; leads: number; capturedAt: Date }>;
  settings: { activeSegmentId: string; strategyGoal: string | null } | null;
};

const navigation: Array<{ id: View; label: string; mobileLabel: string; helper: string; icon: typeof Lightbulb }> = [
  { id: "ideas", label: "Идеи", mobileLabel: "Идеи", helper: "Банк тем", icon: Lightbulb },
  { id: "studio", label: "Студия", mobileLabel: "Studio", helper: "Шаблоны", icon: Sparkles },
  { id: "favorites", label: "Избранное", mobileLabel: "Отбор", helper: "Отбор", icon: Heart },
  { id: "plan", label: "План / календарь", mobileLabel: "План", helper: "Расписание", icon: CalendarDays },
  { id: "library", label: "Библиотека", mobileLabel: "Библио", helper: "Материалы", icon: Library },
  { id: "voice", label: "Голос и ЦА", mobileLabel: "ЦА", helper: "Контекст", icon: Users },
  { id: "analytics", label: "Аналитика", mobileLabel: "Метрики", helper: "Результаты", icon: BarChart3 },
];

const initialIdea = { title: "", hook: "", format: "", visual: "", cta: "", segmentId: "S3", channel: "reels" as "reels" | "telegram", priority: "high" as "low" | "medium" | "high" | "viral", folderId: null as number | null };
const initialDraft = { title: "", hook: "", body: "", visual: "", cta: "", segmentId: "S3", format: "" };

function dateValue(date: Date | null) {
  return date ? new Date(date).toISOString().slice(0, 10) : "";
}
function copyText(value: string) { navigator.clipboard?.writeText(value); }
function itemText(item: StudioData["items"][number]) { return [item.title, item.hook, item.body, item.visual ? `Визуал: ${item.visual}` : "", item.cta ? `CTA: ${item.cta}` : ""].filter(Boolean).join("\n\n"); }
function shortDate(date: Date | null) { return date ? new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short" }).format(new Date(date)) : "Без даты"; }

export default function ContentStudioApp({ userName }: { userName: string }) {
  const [view, setView] = useState<View>("ideas");
  const [modal, setModal] = useState<Modal>(null);
  const [ideaDraft, setIdeaDraft] = useState(initialIdea);
  const [editingIdeaId, setEditingIdeaId] = useState<number | null>(null);
  const [studioMode, setStudioMode] = useState<"post" | "reel">("post");
  const [studioDraft, setStudioDraft] = useState(initialDraft);
  const [studioGoal, setStudioGoal] = useState("");
  const [editingMaterialId, setEditingMaterialId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [folderFilter, setFolderFilter] = useState<number | "all">("all");
  const [segmentCode, setSegmentCode] = useState("S3");
  const [metricItemId, setMetricItemId] = useState<number | null>(null);
  const navRef = useRef<HTMLElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const viewSwipeStart = useRef<{ x: number; y: number } | null>(null);
  const utils = trpc.useUtils();
  const boot = trpc.contentStudio.bootstrap.useQuery(undefined, { refetchOnWindowFocus: false });
  const data = boot.data as StudioData | undefined;
  const refresh = () => utils.contentStudio.bootstrap.invalidate();
  const createItem = trpc.contentStudio.item.create.useMutation({ onSuccess: refresh });
  const updateItem = trpc.contentStudio.item.update.useMutation({ onSuccess: refresh });
  const deleteItem = trpc.contentStudio.item.delete.useMutation({ onSuccess: refresh });
  const createFolder = trpc.contentStudio.folder.create.useMutation({ onSuccess: refresh });
  const createMetric = trpc.contentStudio.metric.create.useMutation({ onSuccess: refresh });
  const updateVoice = trpc.contentStudio.voice.update.useMutation({ onSuccess: refresh });
  const updateSegment = trpc.contentStudio.segment.update.useMutation({ onSuccess: refresh });
  const updateSettings = trpc.contentStudio.settings.update.useMutation({ onSuccess: refresh });

  useEffect(() => { if (data?.settings?.activeSegmentId) setSegmentCode(data.settings.activeSegmentId); }, [data?.settings?.activeSegmentId]);
  useEffect(() => {
    if (window.innerWidth > 780) return;
    navRef.current?.querySelector<HTMLElement>(`[data-view="${view}"]`)?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [view]);
  useEffect(() => {
    const root = rootRef.current;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!root || reduceMotion.matches) return;
    let frame = 0;
    const applyScroll = () => {
      frame = 0;
      root.style.setProperty("--parallax-y", `${Math.min(window.scrollY * .075, 54).toFixed(1)}px`);
    };
    const onScroll = () => { if (!frame) frame = window.requestAnimationFrame(applyScroll); };
    const onPointerMove = (event: PointerEvent) => {
      const shift = ((event.clientX / window.innerWidth) - .5) * 18;
      root.style.setProperty("--parallax-x", `${shift.toFixed(1)}px`);
    };
    const resetPointer = () => root.style.setProperty("--parallax-x", "0px");
    window.addEventListener("scroll", onScroll, { passive: true });
    root.addEventListener("pointermove", onPointerMove, { passive: true });
    root.addEventListener("pointerleave", resetPointer, { passive: true });
    applyScroll();
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      root.removeEventListener("pointermove", onPointerMove);
      root.removeEventListener("pointerleave", resetPointer);
    };
  }, [data]);

  const items = data?.items ?? [];
  const activeSegment = data?.segments.find(segment => segment.code === segmentCode) ?? data?.segments[0];
  const filteredIdeas = useMemo(() => items.filter(item => item.kind === "idea" && (folderFilter === "all" || item.folderId === folderFilter) && [item.title, item.hook, item.format].join(" ").toLowerCase().includes(query.toLowerCase())), [items, folderFilter, query]);
  const favoriteIdeas = useMemo(() => items.filter(item => item.kind === "idea" && item.isFavorite), [items]);
  const upcoming = useMemo(() => items.filter(item => item.scheduledFor).sort((a, b) => Number(new Date(a.scheduledFor!)) - Number(new Date(b.scheduledFor!))), [items]);
  const totals = useMemo(() => (data?.metrics ?? []).reduce((result, metric) => ({ views: result.views + metric.views, saves: result.saves + metric.saves, shares: result.shares + metric.shares, leads: result.leads + metric.leads }), { views: 0, saves: 0, shares: 0, leads: 0 }), [data?.metrics]);

  const startIdea = (item?: StudioData["items"][number]) => {
    setEditingIdeaId(item?.id ?? null);
    setIdeaDraft(item ? { title: item.title, hook: item.hook ?? "", format: item.format ?? "", visual: item.visual ?? "", cta: item.cta ?? "", segmentId: item.segmentId, channel: item.channel === "telegram" ? "telegram" : "reels", priority: item.priority, folderId: item.folderId } : { ...initialIdea, segmentId: activeSegment?.code ?? "S3" });
    setModal("idea");
  };
  const saveGeneratedIdea = async (idea: ViralIdea, segmentId: string) => {
    await createItem.mutateAsync({ kind: "idea", status: "draft", title: idea.title, hook: idea.hook, body: idea.angle, format: idea.format, visual: idea.visual, cta: idea.cta, notes: `Цель: ${idea.objective}\nИсточник: Viral Ideas`, segmentId, channel: idea.channel, priority: "viral", folderId: null, scheduledFor: null, isFavorite: false });
    await refresh();
  };
  const toggleFavoriteIdea = (item: StudioData["items"][number]) => updateItem.mutate({ id: item.id, data: { isFavorite: !item.isFavorite } });
  const changeView = (nextView: View) => { setView(nextView); if (window.innerWidth <= 780) window.scrollTo({ top: 0, behavior: "smooth" }); };
  const saveIdea = async (event: FormEvent) => {
    event.preventDefault();
    if (!ideaDraft.title.trim()) return;
    const values = { title: ideaDraft.title.trim(), hook: ideaDraft.hook || null, format: ideaDraft.format || null, visual: ideaDraft.visual || null, cta: ideaDraft.cta || null, segmentId: ideaDraft.segmentId, channel: ideaDraft.channel, priority: ideaDraft.priority, folderId: ideaDraft.folderId };
    if (editingIdeaId) await updateItem.mutateAsync({ id: editingIdeaId, data: values });
    else await createItem.mutateAsync({ kind: "idea", status: "draft", ...values, body: null, notes: null, scheduledFor: null, isFavorite: false });
    setModal(null); setIdeaDraft(initialIdea); setEditingIdeaId(null);
  };
  const saveStudio = async () => {
    if (!studioDraft.title.trim()) return;
    const values = { channel: studioMode === "post" ? "telegram" as const : "reels" as const, title: studioDraft.title.trim(), hook: studioDraft.hook || null, body: studioDraft.body || null, visual: studioDraft.visual || null, cta: studioDraft.cta || null, format: studioDraft.format || null, notes: `Цель материала: ${studioGoal || "не указана"}\nГолос автора: ${data?.voice?.name || "Serbolin — прямой тренер"}`, segmentId: studioDraft.segmentId };
    if (editingMaterialId) await updateItem.mutateAsync({ id: editingMaterialId, data: values });
    else await createItem.mutateAsync({ kind: studioMode, status: "draft", priority: "high", folderId: null, ...values, scheduledFor: null, isFavorite: false });
    setStudioDraft({ ...initialDraft, segmentId: activeSegment?.code ?? "S3" }); setStudioGoal(""); setEditingMaterialId(null); setView("library");
  };
  const openMaterial = (item: StudioData["items"][number]) => {
    setEditingMaterialId(item.id);
    setStudioMode(item.kind === "post" ? "post" : "reel");
    setStudioDraft({ title: item.title, hook: item.hook ?? "", body: item.body ?? "", visual: item.visual ?? "", cta: item.cta ?? "", segmentId: item.segmentId, format: item.format ?? "" });
    setStudioGoal(item.notes?.match(/Цель материала: (.*)/)?.[1] || "");
    setView("studio");
  };
  const addMetric = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const number = (key: string) => Number(form.get(key) || 0);
    if (!metricItemId) return;
    await createMetric.mutateAsync({ itemId: metricItemId, views: number("views"), reactions: number("reactions"), comments: number("comments"), saves: number("saves"), shares: number("shares"), linkClicks: number("linkClicks"), leads: number("leads"), notes: null });
    setModal(null); setMetricItemId(null);
  };
  const isInteractiveTouchTarget = (target: EventTarget | null) => target instanceof Element && Boolean(target.closest("button, input, textarea, select, a, [data-no-view-swipe]"));
  const handleViewTouchStart = (event: TouchEvent<HTMLElement>) => {
    if (window.innerWidth > 780 || modal || isInteractiveTouchTarget(event.target)) return;
    const touch = event.touches[0];
    viewSwipeStart.current = { x: touch.clientX, y: touch.clientY };
  };
  const handleViewTouchEnd = (event: TouchEvent<HTMLElement>) => {
    const start = viewSwipeStart.current;
    viewSwipeStart.current = null;
    if (!start || window.innerWidth > 780 || modal || isInteractiveTouchTarget(event.target)) return;
    const touch = event.changedTouches[0];
    const x = touch.clientX - start.x;
    const y = touch.clientY - start.y;
    if (Math.abs(x) < 70 || Math.abs(x) <= Math.abs(y) * 1.35) return;
    const currentIndex = navigation.findIndex(entry => entry.id === view);
    const nextIndex = Math.max(0, Math.min(navigation.length - 1, currentIndex + (x < 0 ? 1 : -1)));
    if (nextIndex !== currentIndex) changeView(navigation[nextIndex].id);
  };

  if (boot.isLoading) return <div className="workspace-loading"><LoaderCircle className="spin" size={26} />Загружаю рабочую базу…</div>;
  if (boot.error || !data) return <div className="workspace-loading"><X size={25} />Не удалось загрузить данные. Обновите страницу.</div>;

  return <div className="studio-root" ref={rootRef}>
    <aside className="studio-nav">
      <div className="brand-block"><div className="brand-mark"><Sparkles size={17} /></div><div><strong>CONTENT</strong><span>STUDIO / SERBOLIN</span></div></div>
      <div className="nav-caption">Личный кабинет<br />контент-системы</div>
      <nav ref={navRef}>{navigation.map(entry => { const Icon = entry.icon; return <button key={entry.id} data-view={entry.id} aria-current={view === entry.id ? "page" : undefined} onClick={() => changeView(entry.id)} className={view === entry.id ? "nav-entry active" : "nav-entry"}><Icon size={17} /><div><b>{entry.label}</b><small>{entry.helper}</small></div><ChevronRight size={15} /></button>; })}</nav>
      <div className="nav-footer"><div className="avatar">ЭС</div><div><b>{userName}</b><span>owner · private</span></div></div>
    </aside>
    <main className="studio-main" onTouchStart={handleViewTouchStart} onTouchEnd={handleViewTouchEnd}>
      <header className="studio-topbar"><div><span className="eyebrow">CONTENT STUDIO</span><h1>{navigation.find(entry => entry.id === view)?.label}</h1></div><div className="top-status"><span className="online-dot" />Данные синхронизированы</div></header>
      {view === "ideas" && <IdeasView ideas={filteredIdeas} folders={data.folders} segments={data.segments} activeFolder={folderFilter} onFolder={setFolderFilter} query={query} onQuery={setQuery} onCreate={() => startIdea()} onFolderCreate={() => setModal("folder")} onUse={item => { setEditingMaterialId(null); setStudioDraft({ title: item.title, hook: item.hook ?? "", body: item.body ?? "", visual: item.visual ?? "", cta: item.cta ?? "", segmentId: item.segmentId, format: item.format ?? "" }); setStudioMode(item.channel === "telegram" ? "post" : "reel"); changeView("studio"); }} onEdit={startIdea} onDelete={id => deleteItem.mutate({ id })} onFavorite={toggleFavoriteIdea} onSaveGenerated={saveGeneratedIdea} />}
      {view === "studio" && <StudioView mode={studioMode} onMode={setStudioMode} draft={studioDraft} onDraft={setStudioDraft} goal={studioGoal} onGoal={setStudioGoal} voice={data.voice} templates={data.templates.filter(template => template.kind === studioMode && template.isActive)} segments={data.segments} activeSegment={activeSegment?.code ?? "S3"} onTemplate={template => setStudioDraft(draft => ({ ...draft, body: draft.body || `${data?.voice ? `Контекст голоса: ${data.voice.name} · ${data.voice.tone}\n\n` : ""}${template.structure}`, format: template.name }))} onSave={saveStudio} isSaving={createItem.isPending || updateItem.isPending} />}
      {view === "favorites" && <FavoritesView ideas={favoriteIdeas} onUse={item => { setEditingMaterialId(null); setStudioDraft({ title: item.title, hook: item.hook ?? "", body: item.body ?? "", visual: item.visual ?? "", cta: item.cta ?? "", segmentId: item.segmentId, format: item.format ?? "" }); setStudioMode(item.channel === "telegram" ? "post" : "reel"); changeView("studio"); }} onEdit={startIdea} onDelete={id => deleteItem.mutate({ id })} onFavorite={toggleFavoriteIdea} onCreate={() => startIdea()} />}
      {view === "plan" && <PlanView items={upcoming} onSchedule={(item, value) => updateItem.mutate({ id: item.id, data: { scheduledFor: value ? new Date(`${value}T12:00:00`) : null, status: value ? "planned" : "draft" } })} onReady={item => updateItem.mutate({ id: item.id, data: { status: item.status === "published" ? "ready" : "published" } })} onLibrary={() => changeView("library")} />}
      {view === "library" && <LibraryView items={items.filter(item => item.kind !== "idea")} onCopy={item => copyText(itemText(item))} onFavorite={item => updateItem.mutate({ id: item.id, data: { isFavorite: !item.isFavorite } })} onPlan={item => { updateItem.mutate({ id: item.id, data: { status: "planned", scheduledFor: item.scheduledFor ?? new Date() } }); changeView("plan"); }} onEdit={openMaterial} onDelete={id => deleteItem.mutate({ id })} />}
      {view === "voice" && <VoiceView voice={data.voice} segments={data.segments} selected={segmentCode} onSelect={code => { setSegmentCode(code); updateSettings.mutate({ activeSegmentId: code }); }} onVoice={input => updateVoice.mutate(input)} onSegment={(id, input) => updateSegment.mutate({ id, data: input })} />}
      {view === "analytics" && <AnalyticsView metrics={data.metrics} items={items.filter(item => item.status === "published")} totals={totals} onAdd={id => { setMetricItemId(id); setModal("metric"); }} />}
    </main>
    <nav className="mobile-bottom-nav" aria-label="Основная навигация">{navigation.map(entry => { const Icon = entry.icon; return <button key={entry.id} aria-label={entry.label} aria-current={view === entry.id ? "page" : undefined} onClick={() => changeView(entry.id)} className={view === entry.id ? "mobile-nav-entry active" : "mobile-nav-entry"}><Icon size={19} /><span>{entry.mobileLabel}</span></button>; })}</nav>
    {modal === "idea" && <IdeaModal title={editingIdeaId ? "Изменить идею" : "Новая идея"} draft={ideaDraft} folders={data.folders} segments={data.segments} onChange={setIdeaDraft} onClose={() => { setModal(null); setEditingIdeaId(null); }} onSave={saveIdea} loading={createItem.isPending || updateItem.isPending} />}
    {modal === "folder" && <FolderModal onClose={() => setModal(null)} onSave={async (name, color) => { await createFolder.mutateAsync({ name, color }); setModal(null); }} loading={createFolder.isPending} />}
    {modal === "metric" && <MetricModal items={items.filter(item => item.status === "published")} selected={metricItemId} onSelect={setMetricItemId} onClose={() => setModal(null)} onSave={addMetric} loading={createMetric.isPending} />}
  </div>;
}

function LegacyIdeasView({ ideas, folders, activeFolder, onFolder, query, onQuery, onCreate, onFolderCreate, onUse, onDelete }: { ideas: StudioData["items"]; folders: StudioData["folders"]; activeFolder: number | "all"; onFolder: (value: number | "all") => void; query: string; onQuery: (value: string) => void; onCreate: () => void; onFolderCreate: () => void; onUse: (item: StudioData["items"][number]) => void; onDelete: (id: number) => void }) {
  return <section className="page-stack"><div className="page-lead"><div><span className="eyebrow">01 / БАНК ТЕМ</span><h2>Идеи, которые не теряются<br /><em>между заметками.</em></h2><p>Собирай темы, помечай формат и отправляй их в Studio, когда готов работать с материалом.</p></div><button className="button-primary" onClick={onCreate}><Plus size={16} />Новая идея</button></div><div className="toolbar-card"><div className="folder-tabs"><button className={activeFolder === "all" ? "selected" : ""} onClick={() => onFolder("all")}>Все <span>{ideas.length}</span></button>{folders.map(folder => <button key={folder.id} className={activeFolder === folder.id ? "selected" : ""} onClick={() => onFolder(folder.id)}><i style={{ background: folder.color }} />{folder.name}</button>)}<button className="new-folder" onClick={onFolderCreate}><FolderPlus size={14} />Папка</button></div><label className="search-input"><Search size={16} /><input value={query} onChange={event => onQuery(event.target.value)} placeholder="Найти тему или хук…" /></label></div><div className="idea-list">{ideas.length ? ideas.map(item => <article className="idea-row" key={item.id}><div className="row-chip">{item.channel === "telegram" ? <MessageCircle size={14} /> : <Video size={14} />}</div><div className="idea-body"><div className="row-meta"><span>{item.channel === "telegram" ? "TELEGRAM" : "REELS"}</span><span>{item.format || "Без формата"}</span><b className={`priority ${item.priority}`}>{priorityLabels[item.priority]}</b></div><h3>{item.title}</h3><p>{item.hook || "Добавь хук, чтобы идея быстрее превращалась в материал."}</p></div><div className="row-actions"><button title="Открыть в Studio" onClick={() => onUse(item)}><Sparkles size={15} /></button><button title="Удалить" onClick={() => onDelete(item.id)}><Trash2 size={15} /></button></div></article>) : <EmptyState icon={<Lightbulb size={22} />} title="Здесь появятся твои темы" text="Добавь первую идею, чтобы сформировать собственный банк контента." action="Создать идею" onAction={onCreate} />}</div></section>;
}

function LegacyStudioView({ mode, onMode, draft, onDraft, templates, segments, activeSegment, onTemplate, onSave, isSaving }: { mode: "post" | "reel"; onMode: (value: "post" | "reel") => void; draft: typeof initialDraft; onDraft: (value: typeof initialDraft) => void; templates: StudioData["templates"]; segments: StudioData["segments"]; activeSegment: string; onTemplate: (template: StudioData["templates"][number]) => void; onSave: () => void; isSaving: boolean }) {
  return <section className="page-stack"><div className="page-lead compact"><div><span className="eyebrow">02 / РАБОЧАЯ СТАНЦИЯ</span><h2>Собери материал<br /><em>по собственной системе.</em></h2><p>Без ИИ на первом этапе: структура, контекст ЦА и голос автора остаются под твоим контролем.</p></div></div><div className="studio-composer"><aside className="composer-side"><span className="eyebrow">ФОРМАТ</span><button className={mode === "post" ? "mode active" : "mode"} onClick={() => onMode("post")}><MessageCircle size={17} /><b>Telegram-пост</b><small>текст и логика</small></button><button className={mode === "reel" ? "mode active" : "mode"} onClick={() => onMode("reel")}><Video size={17} /><b>Сценарий Reels</b><small>кадры и речь</small></button><div className="composer-signal"><Target size={16} /><span>Контекст: {segments.find(segment => segment.code === draft.segmentId)?.name || "выбери сегмент"}</span></div></aside><div className="composer-work"><div className="template-strip"><span>Быстрые шаблоны</span>{templates.map(template => <button key={template.id} onClick={() => onTemplate(template)}>{template.name}</button>)}</div><div className="form-grid"><label className="wide"><span>ТЕМА ИЛИ ЗАГОЛОВОК</span><input value={draft.title} onChange={event => onDraft({ ...draft, title: event.target.value })} placeholder={mode === "post" ? "Например: Почему идеальный понедельник не приходит" : "Например: Как вернуться к тренировкам после пропуска"} /></label><label><span>ДЛЯ КОГО</span><select value={draft.segmentId} onChange={event => onDraft({ ...draft, segmentId: event.target.value })}>{segments.map(segment => <option key={segment.code} value={segment.code}>{segment.code} · {segment.name}</option>)}</select></label><label><span>СТРУКТУРА</span><input value={draft.format} onChange={event => onDraft({ ...draft, format: event.target.value })} placeholder="Выбери шаблон выше" /></label><label className="wide"><span>ХУК</span><textarea rows={2} value={draft.hook} onChange={event => onDraft({ ...draft, hook: event.target.value })} placeholder="Первая фраза, которая останавливает скролл" /></label><label className="wide"><span>{mode === "post" ? "ТЕКСТ ЧЕРНОВИКА" : "СЦЕНАРИЙ И КАДРЫ"}</span><textarea rows={10} value={draft.body} onChange={event => onDraft({ ...draft, body: event.target.value })} placeholder={mode === "post" ? "Собери мысли, факты и примеры. Шаблон поможет не потерять структуру." : "0–2 сек: хук\n3–8 сек: ситуация\n…"} /></label><label><span>ВИЗУАЛ / КАДР</span><textarea rows={3} value={draft.visual} onChange={event => onDraft({ ...draft, visual: event.target.value })} placeholder="Что показать в кадре" /></label><label><span>CTA</span><textarea rows={3} value={draft.cta} onChange={event => onDraft({ ...draft, cta: event.target.value })} placeholder="Сохрани, напиши кодовое слово…" /></label></div><button className="button-primary full" disabled={!draft.title.trim() || isSaving} onClick={onSave}>{isSaving ? <LoaderCircle className="spin" size={16} /> : <FilePlus2 size={16} />}{isSaving ? "Сохраняю…" : "Сохранить в библиотеку"}</button></div></div></section>;
}

function PlanView({ items, onSchedule, onReady, onLibrary }: { items: StudioData["items"]; onSchedule: (item: StudioData["items"][number], value: string) => void; onReady: (item: StudioData["items"][number]) => void; onLibrary: () => void }) {
  return <section className="page-stack"><div className="page-lead compact"><div><span className="eyebrow">03 / ПЛАНИРОВАНИЕ</span><h2>План держит <em>темп,</em><br />а не давит.</h2><p>Разложи посты и Reels по датам. Отметь, что готово и что уже опубликовано.</p></div><button className="button-secondary" onClick={onLibrary}><Library size={15} />Открыть библиотеку</button></div><div className="plan-grid">{items.length ? items.map(item => <article className="calendar-card" key={item.id}><div className="calendar-date"><span>{shortDate(item.scheduledFor)}</span><i className={`status-dot ${item.status}`} /></div><div><div className="row-meta"><span>{item.kind === "post" ? "TELEGRAM" : "REELS"}</span><b>{statusLabels[item.status]}</b></div><h3>{item.title}</h3><p>{item.hook || item.format || "Без дополнительного описания"}</p></div><div className="calendar-controls"><label><span>ДАТА</span><input type="date" value={dateValue(item.scheduledFor)} onChange={event => onSchedule(item, event.target.value)} /></label><button onClick={() => onReady(item)}>{item.status === "published" ? "Вернуть в готово" : "Опубликовано"}<Check size={15} /></button></div></article>) : <EmptyState icon={<CalendarDays size={22} />} title="План пока пуст" text="Открой библиотеку и назначь дату готовому материалу." action="К библиотеке" onAction={onLibrary} />}</div></section>;
}

function LegacyLibraryView({ items, onCopy, onFavorite, onPlan, onDelete }: { items: StudioData["items"]; onCopy: (item: StudioData["items"][number]) => void; onFavorite: (item: StudioData["items"][number]) => void; onPlan: (item: StudioData["items"][number]) => void; onDelete: (id: number) => void }) {
  return <section className="page-stack"><div className="page-lead compact"><div><span className="eyebrow">04 / ЕДИНАЯ БАЗА</span><h2>Материалы на своём<br /><em>месте.</em></h2><p>Здесь хранятся черновики Telegram-постов и сценариев Reels, готовые к доработке и публикации.</p></div><div className="library-count">{items.length}<span>материалов</span></div></div><div className="library-grid">{items.length ? items.map(item => <article className="material-card" key={item.id}><div className="material-top"><span>{item.kind === "post" ? "Telegram-пост" : "Сценарий Reels"}</span><button className={item.isFavorite ? "favorite active" : "favorite"} onClick={() => onFavorite(item)}>★</button></div><h3>{item.title}</h3><p>{item.hook || item.body || "Пока без текста"}</p><div className="material-footer"><span>{statusLabels[item.status]}</span><div><button title="Копировать" onClick={() => onCopy(item)}><ClipboardCopy size={14} /></button><button title="В план" onClick={() => onPlan(item)}><CalendarDays size={14} /></button><button title="Удалить" onClick={() => onDelete(item.id)}><Trash2 size={14} /></button></div></div></article>) : <EmptyState icon={<BookOpenText size={22} />} title="Библиотека пока пуста" text="Сохрани первый материал из Studio — он появится здесь." />}</div></section>;
}

function VoiceView({ voice, segments, selected, onSelect, onVoice, onSegment }: { voice: StudioData["voice"]; segments: StudioData["segments"]; selected: string; onSelect: (code: string) => void; onVoice: (input: { name?: string; tone?: string; address?: string; energy?: string; structure?: string; proof?: string; cta?: string; avoid?: string; notes?: string | null }) => void; onSegment: (id: number, input: { name?: string; title?: string; subtitle?: string; goal?: string; pain?: string; fear?: string; trigger?: string; offer?: string; color?: string }) => void }) {
  const segment = segments.find(item => item.code === selected) ?? segments[0];
  return <section className="page-stack"><div className="page-lead compact"><div><span className="eyebrow">05 / КОНТЕКСТ</span><h2>Голос автора<br /><em>и ЦА.</em></h2><p>Это правила, по которым ты собираешь контент. Редактируй их, когда стратегия меняется.</p></div></div><div className="voice-layout"><form className="editor-card" onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); onVoice({ name: String(form.get("name")), tone: String(form.get("tone")), address: String(form.get("address")), energy: String(form.get("energy")), structure: String(form.get("structure")), proof: String(form.get("proof")), cta: String(form.get("cta")), avoid: String(form.get("avoid")), notes: String(form.get("notes")) || null }); }}><div className="card-heading"><PenLine size={17} /><div><span className="eyebrow">ГОЛОС</span><h3>{voice?.name || "Профиль автора"}</h3></div></div><div className="form-grid"><label><span>НАЗВАНИЕ</span><input name="name" defaultValue={voice?.name} /></label><label><span>ОБРАЩЕНИЕ</span><input name="address" defaultValue={voice?.address} /></label><label className="wide"><span>ТОН</span><input name="tone" defaultValue={voice?.tone} /></label><label className="wide"><span>ЭНЕРГИЯ</span><input name="energy" defaultValue={voice?.energy} /></label><label className="wide"><span>СТРУКТУРА</span><textarea name="structure" defaultValue={voice?.structure} rows={3} /></label><label><span>ДОКАЗАТЕЛЬСТВА</span><textarea name="proof" defaultValue={voice?.proof} rows={3} /></label><label><span>CTA</span><textarea name="cta" defaultValue={voice?.cta} rows={3} /></label><label className="wide"><span>ИЗБЕГАТЬ</span><textarea name="avoid" defaultValue={voice?.avoid} rows={2} /></label></div><button className="button-secondary" type="submit">Сохранить голос</button></form><div className="audience-column"><div className="segment-tabs">{segments.map(item => <button key={item.code} className={item.code === segment?.code ? "selected" : ""} onClick={() => onSelect(item.code)}><span>{item.code}</span><b>{item.name}</b></button>)}</div>{segment && <form className="editor-card segment-editor" onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); onSegment(segment.id, { name: String(form.get("name")), title: String(form.get("title")), subtitle: String(form.get("subtitle")), goal: String(form.get("goal")), pain: String(form.get("pain")), fear: String(form.get("fear")), trigger: String(form.get("trigger")), offer: String(form.get("offer")), color: String(form.get("color")) }); }}><div className="segment-label" style={{ background: segment.color }}>{segment.code}</div><label><span>СЕГМЕНТ</span><input name="name" defaultValue={segment.name} /></label><label><span>ГЛАВНАЯ ФРАЗА</span><input name="title" defaultValue={segment.title} /></label><label><span>КОНТЕКСТ</span><textarea name="subtitle" rows={2} defaultValue={segment.subtitle} /></label><div className="segment-facts"><label><span>ХОЧЕТ</span><textarea name="goal" rows={2} defaultValue={segment.goal} /></label><label><span>БОИТСЯ</span><textarea name="fear" rows={2} defaultValue={segment.fear} /></label><label><span>БОЛЬ</span><textarea name="pain" rows={2} defaultValue={segment.pain} /></label><label><span>ОТКЛИКАЕТСЯ</span><textarea name="trigger" rows={2} defaultValue={segment.trigger} /></label></div><label><span>ОФФЕР</span><input name="offer" defaultValue={segment.offer} /></label><label><span>ЦВЕТ</span><input name="color" defaultValue={segment.color} /></label><button className="button-secondary" type="submit">Сохранить сегмент</button></form>}</div></div></section>;
}

function AnalyticsView({ metrics, items, totals, onAdd }: { metrics: StudioData["metrics"]; items: StudioData["items"]; totals: { views: number; saves: number; shares: number; leads: number }; onAdd: (id: number) => void }) {
  return <section className="page-stack"><div className="page-lead compact"><div><span className="eyebrow">06 / ОБРАТНАЯ СВЯЗЬ</span><h2>Смотри на то,<br /><em>что работает.</em></h2><p>На старте показатели вносятся вручную: этого достаточно, чтобы видеть повторяющиеся сигналы.</p></div>{items[0] && <button className="button-primary" onClick={() => onAdd(items[0].id)}><Plus size={16} />Внести результат</button>}</div><div className="metric-grid"><Metric value={totals.views} label="просмотров" /><Metric value={totals.saves} label="сохранений" /><Metric value={totals.shares} label="пересылок" /><Metric value={totals.leads} label="заявок" /></div><div className="analytics-table"><div className="table-header"><span>Материал</span><span>Просмотры</span><span>Сохранения</span><span>Заявки</span><span /></div>{metrics.length ? metrics.map(metric => { const item = items.find(entry => entry.id === metric.itemId); return <div className="metric-row" key={metric.id}><b>{item?.title || "Удалённый материал"}</b><span>{metric.views.toLocaleString("ru-RU")}</span><span>{metric.saves.toLocaleString("ru-RU")}</span><span>{metric.leads.toLocaleString("ru-RU")}</span><small>{shortDate(metric.capturedAt)}</small></div>; }) : <EmptyState icon={<BarChart3 size={22} />} title="Пока нет результатов" text="Отметь опубликованный материал в плане и внеси его показатели." />}</div></section>;
}

function Metric({ value, label }: { value: number; label: string }) { return <article className="metric-card"><b>{value.toLocaleString("ru-RU")}</b><span>{label}</span></article>; }
function EmptyState({ icon, title, text, action, onAction }: { icon: React.ReactNode; title: string; text: string; action?: string; onAction?: () => void }) { return <div className="empty-state"><div>{icon}</div><h3>{title}</h3><p>{text}</p>{action && <button className="button-secondary" onClick={onAction}>{action}</button>}</div>; }

function LegacyIdeaModal({ draft, folders, segments, onChange, onClose, onSave, loading }: { draft: typeof initialIdea; folders: StudioData["folders"]; segments: StudioData["segments"]; onChange: (value: typeof initialIdea) => void; onClose: () => void; onSave: (event: FormEvent) => void; loading: boolean }) { return <Dialog title="Новая идея" onClose={onClose}><form onSubmit={onSave} className="form-grid"><label className="wide"><span>ТЕМА</span><input autoFocus value={draft.title} onChange={event => onChange({ ...draft, title: event.target.value })} placeholder="О чём стоит поговорить с аудиторией?" /></label><label className="wide"><span>ХУК</span><textarea rows={3} value={draft.hook} onChange={event => onChange({ ...draft, hook: event.target.value })} placeholder="Фраза, которая цепляет внимание" /></label><label><span>КАНАЛ</span><select value={draft.channel} onChange={event => onChange({ ...draft, channel: event.target.value as "telegram" | "reels" })}><option value="reels">Reels</option><option value="telegram">Telegram</option></select></label><label><span>СЕГМЕНТ</span><select value={draft.segmentId} onChange={event => onChange({ ...draft, segmentId: event.target.value })}>{segments.map(segment => <option key={segment.code} value={segment.code}>{segment.code} · {segment.name}</option>)}</select></label><label><span>ПРИОРИТЕТ</span><select value={draft.priority} onChange={event => onChange({ ...draft, priority: event.target.value as typeof draft.priority })}>{Object.entries(priorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span>ПАПКА</span><select value={draft.folderId ?? ""} onChange={event => onChange({ ...draft, folderId: event.target.value ? Number(event.target.value) : null })}><option value="">Без папки</option>{folders.map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></label><label><span>ФОРМАТ</span><input value={draft.format} onChange={event => onChange({ ...draft, format: event.target.value })} placeholder="Миф / кейс / POV" /></label><label><span>CTA</span><input value={draft.cta} onChange={event => onChange({ ...draft, cta: event.target.value })} placeholder="Сохрани…" /></label><label className="wide"><span>ВИЗУАЛ</span><textarea rows={2} value={draft.visual} onChange={event => onChange({ ...draft, visual: event.target.value })} placeholder="Кадр, фон или визуальный приём" /></label><div className="modal-footer wide"><button type="button" className="button-ghost" onClick={onClose}>Отмена</button><button className="button-primary" disabled={loading}>{loading ? "Сохраняю…" : "Сохранить идею"}</button></div></form></Dialog>; }
function FolderModal({ onClose, onSave, loading }: { onClose: () => void; onSave: (name: string, color: string) => void; loading: boolean }) { const [name, setName] = useState(""); const [color, setColor] = useState("#D84444"); return <Dialog title="Новая папка" onClose={onClose}><form onSubmit={event => { event.preventDefault(); if (name.trim()) onSave(name.trim(), color); }} className="form-grid"><label className="wide"><span>НАЗВАНИЕ</span><input autoFocus value={name} onChange={event => setName(event.target.value)} placeholder="Например: Личный опыт" /></label><label><span>ЦВЕТ</span><input type="color" value={color} onChange={event => setColor(event.target.value)} /></label><div className="modal-footer wide"><button type="button" className="button-ghost" onClick={onClose}>Отмена</button><button className="button-primary" disabled={loading}>{loading ? "Сохраняю…" : "Создать папку"}</button></div></form></Dialog>; }
function MetricModal({ items, selected, onSelect, onClose, onSave, loading }: { items: StudioData["items"]; selected: number | null; onSelect: (id: number) => void; onClose: () => void; onSave: (event: FormEvent<HTMLFormElement>) => void; loading: boolean }) { return <Dialog title="Результат публикации" onClose={onClose}><form onSubmit={onSave} className="form-grid"><label className="wide"><span>МАТЕРИАЛ</span><select value={selected ?? ""} onChange={event => onSelect(Number(event.target.value))}>{items.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>{["views", "reactions", "comments", "saves", "shares", "linkClicks", "leads"].map(field => <label key={field}><span>{({ views: "ПРОСМОТРЫ", reactions: "РЕАКЦИИ", comments: "КОММЕНТАРИИ", saves: "СОХРАНЕНИЯ", shares: "ПЕРЕСЫЛКИ", linkClicks: "ПЕРЕХОДЫ", leads: "ЗАЯВКИ" } as Record<string, string>)[field]}</span><input name={field} type="number" min="0" defaultValue="0" /></label>)}<div className="modal-footer wide"><button type="button" className="button-ghost" onClick={onClose}>Отмена</button><button className="button-primary" disabled={loading}>{loading ? "Сохраняю…" : "Добавить результат"}</button></div></form></Dialog>; }
function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { return <div className="dialog-backdrop" role="presentation"><div className="dialog-card" role="dialog" aria-modal="true" aria-label={title}><header><div><span className="eyebrow">CONTENT STUDIO</span><h2>{title}</h2></div><button className="icon-button" onClick={onClose}><X size={18} /></button></header>{children}</div></div>; }
