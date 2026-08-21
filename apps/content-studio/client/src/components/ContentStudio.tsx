import { useMemo, useState } from "react";
import { CalendarPlus, Check, ChevronDown, Copy, Heart, History, LoaderCircle, Sparkles, Target, Trash2, WandSparkles } from "lucide-react";
import { getStudioCalendarMeta, reelsFormulas, StudioLength, StudioMode, StudioResult, studioCtas, studioGoals, studioLengths, studioModes, studioPresets, telegramStructures } from "@/data/contentStudioData";
import { GeneratedAsset, Segment, SegmentId, segments, VoiceProfile } from "@/data/strategyData";

type Props = {
  segment: Segment;
  voice: VoiceProfile;
  strategyGoal: string;
  onToast: (message: string) => void;
  onSaveAsset: (asset: GeneratedAsset) => void;
};

async function copy(value: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await Promise.race([
        navigator.clipboard.writeText(value),
        new Promise((_, reject) => window.setTimeout(() => reject(new Error("Clipboard timeout")), 900)),
      ]);
      return;
    }
  } catch {
    // Continue with the browser fallback when Clipboard API is unavailable or blocked.
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.cssText = "position:fixed;opacity:0;pointer-events:none";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("Copy failed");
}

function serializeResult(result: StudioResult) {
  const scenes = result.scenes?.map((scene) => `${scene.time} · ${scene.shot}\nРеплика: ${scene.speech}\nТитр: ${scene.caption}\nМонтаж: ${scene.edit}`).join("\n\n") || "";
  return [result.headline, result.content, scenes, ...result.items, result.cta ? `CTA: ${result.cta}` : "", result.nextStep].filter(Boolean).join("\n\n");
}

export default function ContentStudio({ segment, voice, strategyGoal, onToast, onSaveAsset }: Props) {
  const [mode, setMode] = useState<StudioMode>("reels_topics");
  const [topic, setTopic] = useState("Как начать худеть, если нет времени на идеальный режим");
  const [goal, setGoal] = useState(studioGoals[0]);
  const [length, setLength] = useState<StudioLength>("medium");
  const [segmentId, setSegmentId] = useState<SegmentId>(segment.id);
  const [formulaId, setFormulaId] = useState<typeof reelsFormulas[number]["id"]>("contrast");
  const [postStructure, setPostStructure] = useState(telegramStructures[0]);
  const [postCta, setPostCta] = useState(studioCtas[0]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<StudioResult[]>(() => { try { return JSON.parse(localStorage.getItem("fitness-content-studio-results") || "[]"); } catch { return []; } });
  const [showHistory, setShowHistory] = useState(false);
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const selectedMode = studioModes.find((item) => item.id === mode)!;
  const selectedSegment = segments.find((item) => item.id === segmentId) || segment;
  const isReelsMode = mode === "reels_topics" || mode === "reels_script";
  const isTelegramPost = mode === "telegram_post";
  const activeResult = results[0];

  const persist = (next: StudioResult[]) => { setResults(next); localStorage.setItem("fitness-content-studio-results", JSON.stringify(next)); };
  const generate = async () => {
    if (!topic.trim()) { onToast("Сначала добавьте тему или бриф"); return; }
    setLoading(true);
    try {
      const formula = reelsFormulas.find((item) => item.id === formulaId)?.pattern || reelsFormulas[0].pattern;
      const response = await fetch("/api/content-generator", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode, topic, goal, strategyGoal, length, segment: selectedSegment, voice, formula, structure: postStructure, cta: postCta }) });
      const output = await response.json();
      if (!response.ok) throw new Error(output.error || "Ошибка генерации");
      const entry: StudioResult = { ...output, id: `${Date.now()}-${mode}`, segmentId, topic, createdAt: new Date().toISOString(), favorite: false };
      persist([entry, ...results].slice(0, 30));
      setShowHistory(false); onToast("Новый материал готов");
    } catch (error) { onToast(error instanceof Error ? error.message : "Не удалось подготовить материал"); }
    finally { setLoading(false); }
  };
  const applyPreset = (preset: typeof studioPresets[number]) => { setTopic(preset.topic); onToast("Пресет добавлен в бриф — тип материала, сегмент и цель не изменены"); };
  const toggleFavorite = (id: string) => persist(results.map((item) => item.id === id ? { ...item, favorite: !item.favorite } : item));
  const remove = (id: string) => persist(results.filter((item) => item.id !== id));
  const addToCalendar = (result: StudioResult) => { const asset: GeneratedAsset = { id: result.id, sourceDay: 1, segmentId: result.segmentId, ...getStudioCalendarMeta(result.mode), title: result.headline, content: result.content || result.scenes?.map((scene) => `${scene.time} · ${scene.shot}\n${scene.speech}`).join("\n\n") || result.items.join("\n"), createdAt: result.createdAt }; onSaveAsset(asset); onToast("Материал добавлен в день 01 календаря"); };
  const copyResult = async (result: StudioResult) => {
    setCopyingId(result.id); setCopiedId(null);
    let finished = false;
    let timedOut = false;
    const releaseCopyState = window.setTimeout(() => {
      if (finished) return;
      timedOut = true;
      setCopyingId((current) => current === result.id ? null : current);
      onToast("Копирование заняло слишком много времени. Попробуйте ещё раз.");
    }, 2000);
    try {
      await copy(serializeResult(result));
      if (timedOut) return;
      setCopiedId(result.id);
      onToast("Готово — материал в буфере обмена");
      window.setTimeout(() => setCopiedId((current) => current === result.id ? null : current), 1800);
    } catch {
      if (!timedOut) onToast("Не удалось скопировать материал. Повторите действие.");
    } finally {
      finished = true;
      window.clearTimeout(releaseCopyState);
      setCopyingId((current) => current === result.id ? null : current);
    }
  };
  const favoriteCount = useMemo(() => results.filter((item) => item.favorite).length, [results]);

  return <section id="studio" className="section-anchor section-block studio-section">
    <div className="studio-title-row"><div><span className="section-index">07</span><span className="eyebrow">студия контента</span><h2>Собери тему, сценарий или пост за несколько шагов.</h2></div><p>Studio учитывает твою текущую цель, аудиторию и голос автора.</p></div>
    <div className="studio-shell glass-card">
      <aside className="studio-sidebar"><div className="studio-side-top"><span className="eyebrow">шаг 1 · формат</span><h3>Что сделать?</h3><p>Выбери один формат. Потом задай тему и нужный результат.</p></div><div className="studio-mode-list">{studioModes.map((item, index) => <button key={item.id} className={mode === item.id ? "active" : ""} onClick={() => setMode(item.id)} aria-pressed={mode === item.id} data-tooltip={item.description}><span>0{index + 1}</span><div><b>{item.label}</b><small>{item.eyebrow}</small></div></button>)}</div><div className="studio-side-bottom"><Sparkles size={16} /><span>Цель стратегии +<br />голос автора</span></div></aside>
      <div className="studio-workspace"><div className="studio-workspace-head"><div><span className="eyebrow">{selectedMode.eyebrow}</span><h3>{selectedMode.label}</h3><p>{selectedMode.description}</p></div><button className="studio-history-button" onClick={() => setShowHistory(!showHistory)}><History size={16} /> История <span>{results.length}</span></button></div>
        <div className="studio-presets"><div><span>Быстрый старт</span><small>Меняет только бриф — не формат, сегмент или цель.</small></div>{studioPresets.map((preset) => <button key={preset.label} onClick={() => applyPreset(preset)} data-tooltip={`Подставить в бриф: ${preset.topic}`}>{preset.label}</button>)}</div>
        <div className="studio-form"><div className="studio-context-head"><span>шаг 2 · контекст</span><p>Выбери аудиторию и нужный результат. Главная цель из раздела «Контент-стратегия» уже подключена.</p></div><div className="studio-strategy-goal"><Target size={15} /><span><b>Главная цель:</b> {strategyGoal || "Сначала задай цель в разделе «Контент-стратегия»."}</span></div><label className="studio-topic-field"><span>ТЕМА / КОРОТКИЙ БРИФ</span><textarea value={topic} onChange={(event) => setTopic(event.target.value)} placeholder={selectedMode.placeholder} rows={3} /></label><div className="studio-controls"><label><span>ДЛЯ КОГО</span><select value={segmentId} onChange={(event) => setSegmentId(event.target.value as SegmentId)}>{segments.map((item) => <option key={item.id} value={item.id}>{item.id} · {item.name}</option>)}</select></label><label><span>ЗАЧЕМ ЭТОТ МАТЕРИАЛ</span><select value={goal} onChange={(event) => setGoal(event.target.value)}>{studioGoals.map((item) => <option key={item}>{item}</option>)}</select></label><div className="studio-length"><span>ДЛИНА</span><div>{studioLengths.map((item) => <button key={item.id} className={length === item.id ? "active" : ""} onClick={() => setLength(item.id)}>{item.label}</button>)}</div></div></div>{isReelsMode && <div className="studio-secondary-controls"><div className="studio-formula-explainer"><span>шаг 3 · схема ролика</span><p><b>Это порядок частей ролика.</b> Она помогает не потерять мысль и удержать зрителя до конца.</p></div><label><span>ВЫБЕРИ СХЕМУ</span><select value={formulaId} onChange={(event) => setFormulaId(event.target.value as typeof formulaId)}>{reelsFormulas.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><p className="studio-formula-pattern"><b>Порядок:</b> {reelsFormulas.find((item) => item.id === formulaId)?.pattern}</p></div>}{isTelegramPost && <div className="studio-secondary-controls post"><label><span>СТРУКТУРА</span><select value={postStructure} onChange={(event) => setPostStructure(event.target.value)}>{telegramStructures.map((item) => <option key={item}>{item}</option>)}</select></label><label><span>ПРИЗЫВ К ДЕЙСТВИЮ</span><select value={postCta} onChange={(event) => setPostCta(event.target.value)}>{studioCtas.map((item) => <option key={item}>{item}</option>)}</select></label></div>}<div className="studio-voice-chip"><Check size={15} /><span>Голос автора: <b>{voice.name}</b> · {voice.tone}</span><ChevronDown size={15} /></div><button className="studio-generate" onClick={generate} disabled={loading}>{loading ? <LoaderCircle className="spin" size={18} /> : <WandSparkles size={18} />}<span>{loading ? "Собираю материал…" : "Создать материал"}</span></button></div>
        {activeResult && !showHistory && <ResultCard result={activeResult} copying={copyingId === activeResult.id} copied={copiedId === activeResult.id} onCopy={() => copyResult(activeResult)} onFavorite={() => toggleFavorite(activeResult.id)} onAdd={() => addToCalendar(activeResult)} onRemove={() => remove(activeResult.id)} />}
        {showHistory && <div className="studio-history"><div className="studio-history-head"><span className="eyebrow">история · избранное {favoriteCount}</span><button onClick={() => persist([])} data-tooltip="Удалить все материалы из истории"><Trash2 size={14} /> Очистить</button></div>{results.length ? <div className="studio-history-grid">{results.map((result) => <ResultCard key={result.id} compact result={result} copying={copyingId === result.id} copied={copiedId === result.id} onCopy={() => copyResult(result)} onFavorite={() => toggleFavorite(result.id)} onAdd={() => addToCalendar(result)} onRemove={() => remove(result.id)} />)}</div> : <div className="studio-empty"><Sparkles size={20} />Здесь появятся ваши материалы.</div>}</div>}
      </div>
    </div>
  </section>;
}

function ResultCard({ result, compact = false, copying, copied, onCopy, onFavorite, onAdd, onRemove }: { result: StudioResult; compact?: boolean; copying: boolean; copied: boolean; onCopy: () => void; onFavorite: () => void; onAdd: () => void; onRemove: () => void }) {
  return <article className={`studio-result ${compact ? "compact" : ""}`}><div className="studio-result-top"><span>{studioModes.find((item) => item.id === result.mode)?.label}</span><div><button className={result.favorite ? "favorite active" : "favorite"} onClick={onFavorite} aria-label={result.favorite ? "Убрать из избранного" : "Добавить в избранное"} data-tooltip={result.favorite ? "Убрать из избранного" : "Добавить в избранное"}><Heart size={15} fill={result.favorite ? "currentColor" : "none"} /></button><button className="icon-action" onClick={onRemove} aria-label="Удалить материал" data-tooltip="Удалить материал"><Trash2 size={15} /></button></div></div><h3>{result.headline}</h3><p className="studio-summary">{result.summary}</p><button className={`studio-quick-copy ${copied ? "is-copied" : ""}`} onClick={onCopy} disabled={copying} data-tooltip="Скопировать полный материал: заголовок, текст, сцены, CTA и следующий шаг">{copying ? <LoaderCircle className="button-spinner" size={16} /> : copied ? <Check size={16} /> : <Copy size={16} />}<span>{copying ? "Копирую материал…" : copied ? "Скопировано в буфер" : "Быстро скопировать весь материал"}</span></button>{result.items.length > 0 && <div className="studio-items">{result.items.map((item, index) => <div key={`${item}-${index}`}><b>{String(index + 1).padStart(2, "0")}</b><span>{item}</span></div>)}</div>}{result.scenes?.length ? <div className="studio-scenes">{result.scenes.map((scene) => <div key={`${scene.time}-${scene.shot}`}><span>{scene.time}</span><div><b>{scene.shot}</b><p><em>Реплика:</em> {scene.speech}</p><p><em>Титр:</em> {scene.caption}</p><p><em>Монтаж:</em> {scene.edit}</p></div></div>)}</div> : result.content && <pre>{result.content}</pre>}{result.cta && <div className="studio-result-cta"><span>CTA</span>{result.cta}</div>}<div className="studio-result-footer"><span>{result.nextStep}</span><div><button onClick={onAdd} data-tooltip="Добавить материал в день 01 календаря"><CalendarPlus size={14} /> В календарь</button></div></div></article>;
}
