import { Check, CheckCircle2, ClipboardCheck, Copy, Instagram, MessageCircle, Sparkles, Target } from "lucide-react";
import type { CSSProperties } from "react";
import { segments, type Segment } from "@/data/strategyData";
import "./weekly-builder.css";

type WeeklyContent = {
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

type Props = {
  goal: string;
  onGoalChange: (value: string) => void;
  checklist: string[];
  completed: boolean[];
  onToggle: (index: number) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  segment: Segment;
  onOpenStudio: () => void;
  weeklySegmentId: string;
  onWeeklySegmentChange: (value: string) => void;
  weeklyGoal: string;
  onWeeklyGoalChange: (value: string) => void;
  weeklyResult: WeeklyContent | null;
  onBuildWeeklyContent: () => void;
  isBuildingWeeklyContent: boolean;
  onToast: (value: string) => void;
};

const weeklyGoalOptions = [
  "Получить больше охвата и сохранений",
  "Получить больше заявок на бесплатный разбор",
  "Перевести больше подписчиков в Telegram",
  "Вернуться к регулярному контенту без перегруза",
];

export default function ContentStrategy({ goal, onGoalChange, checklist, completed, onToggle, onGenerate, isGenerating, segment, onOpenStudio, weeklySegmentId, onWeeklySegmentChange, weeklyGoal, onWeeklyGoalChange, weeklyResult, onBuildWeeklyContent, isBuildingWeeklyContent, onToast }: Props) {
  const completedCount = completed.filter(Boolean).length;
  const progress = checklist.length ? Math.round((completedCount / checklist.length) * 100) : 0;
  const copyText = (text: string, label: string) => {
    const fallback = () => {
      const field = document.createElement("textarea");
      field.value = text;
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      document.execCommand("copy");
      field.remove();
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => onToast(`${label} скопирован`)).catch(() => { fallback(); onToast(`${label} скопирован`); });
    } else { fallback(); onToast(`${label} скопирован`); }
  };

  return (
    <section id="strategy" className="section-anchor section-block strategy-section">
      <div className="strategy-title-row">
        <div>
          <span className="section-index">02</span>
          <span className="eyebrow">контент-стратегия</span>
          <h2>Поставь одну цель. Дальше сервис подстроит контент под неё.</h2>
        </div>
        <p>Цель попадёт в Studio и будет учитываться при создании Reels и Telegram-постов.</p>
      </div>

      <div className="strategy-layout">
        <div className="strategy-goal-card glass-card">
          <div className="strategy-card-head">
            <div><span className="eyebrow">цель на ближайшие 2–4 недели</span><h3>Что хочешь получить от контента?</h3></div>
            <Target size={21} />
          </div>
          <label className="strategy-goal-field">
            <span>НАПИШИ ПРОСТО</span>
            <textarea value={goal} onChange={(event) => onGoalChange(event.target.value)} rows={4} placeholder="Например: получить 10 заявок на бесплатный разбор от занятых женщин через Reels и Telegram." />
          </label>
          <div className="strategy-goal-foot">
            <span>Сохраняется в этом браузере.</span>
            <button className="primary-button" onClick={onGenerate} disabled={isGenerating}>{isGenerating ? <Sparkles size={16} className="spin" /> : <ClipboardCheck size={16} />} {isGenerating ? "Собираю чек-лист…" : "Обновить чек-лист"}</button>
          </div>
        </div>

        <div className="strategy-focus-card">
          <div className="strategy-focus-head"><span className="eyebrow">сейчас в фокусе</span><span>{segment.id}</span></div>
          <h3>{segment.name}</h3>
          <p>{segment.title}</p>
          <div className="strategy-focus-line" />
          <div className="strategy-focus-point"><CheckCircle2 size={16} /><span>Studio учтёт цель и эту аудиторию в каждом новом сценарии и посте.</span></div>
          <button className="secondary-button" onClick={onOpenStudio}>Открыть Studio</button>
        </div>
      </div>

      <div className="weekly-builder-card glass-card">
        <div className="weekly-builder-head">
          <div><span className="eyebrow">контент на неделю</span><h2>Собери Reels и Telegram-пост под одну задачу.</h2><p>Сначала выбери, для кого делаешь контент и к чему хочешь прийти на этой неделе.</p></div>
          <span className="weekly-builder-mark"><Sparkles size={20} /></span>
        </div>
        <div className="weekly-brief-grid">
          <label><span>1 · КОМУ ПОКАЗЫВАЕМ</span><select value={weeklySegmentId} onChange={(event) => onWeeklySegmentChange(event.target.value)}>{segments.map((item) => <option key={item.id} value={item.id}>{item.id} · {item.name}</option>)}</select></label>
          <label><span>2 · ЦЕЛЬ ЭТОЙ НЕДЕЛИ</span><select value={weeklyGoal} onChange={(event) => onWeeklyGoalChange(event.target.value)}>{weeklyGoalOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        </div>
        <div className="weekly-builder-foot"><p>Будут готовы: тема и сценарий Reels для Instagram, а также тема и текст поста для Telegram.</p><button className="primary-button" onClick={onBuildWeeklyContent} disabled={isBuildingWeeklyContent}>{isBuildingWeeklyContent ? <Sparkles size={16} className="spin" /> : <Sparkles size={16} />}{isBuildingWeeklyContent ? "Собираю неделю…" : "Собрать контент на неделю"}</button></div>
      </div>

      {weeklyResult && <div className="weekly-result-card glass-card">
        <div className="weekly-result-head"><div><span className="eyebrow">недельный пакет готов</span><h2>{weeklyResult.headline || "Контент на неделю"}</h2><p>{weeklyResult.summary}</p></div><span>{weeklyResult.nextStep}</span></div>
        <div className="weekly-channel-grid">
          <article className="weekly-channel weekly-instagram"><div className="weekly-channel-head"><span><Instagram size={16} /> Instagram</span><b>Reels</b></div><div className="weekly-material"><small>ТЕМА REELS</small><h3>{weeklyResult.reelsTopic}</h3><p className="weekly-hook">«{weeklyResult.reelsHook}»</p></div><div className="weekly-scenes">{weeklyResult.reelsScenes.map((scene, index) => <div className="weekly-scene" key={`${scene.time}-${index}`}><span>{scene.time}</span><p><b>{scene.shot}</b>{scene.speech}<i>Титр: {scene.caption} · Монтаж: {scene.edit}</i></p></div>)}</div><button className="secondary-button compact-secondary" onClick={() => copyText(`INSTAGRAM · REELS\n\nТема: ${weeklyResult.reelsTopic}\nХук: ${weeklyResult.reelsHook}\n\n${weeklyResult.reelsScenes.map((scene) => `${scene.time} — ${scene.shot}\nРечь: ${scene.speech}\nТитр: ${scene.caption}\nМонтаж: ${scene.edit}`).join("\n\n")}\n\nCTA: ${weeklyResult.cta}`, "Сценарий Reels")}><Copy size={14} /> Копировать сценарий</button></article>
          <article className="weekly-channel weekly-telegram"><div className="weekly-channel-head"><span><MessageCircle size={16} /> Telegram</span><b>Пост</b></div><div className="weekly-material"><small>ТЕМА ПОСТА</small><h3>{weeklyResult.telegramTopic}</h3></div><div className="weekly-post-text">{weeklyResult.telegramPost}</div><button className="secondary-button compact-secondary" onClick={() => copyText(`TELEGRAM · ПОСТ\n\nТема: ${weeklyResult.telegramTopic}\n\n${weeklyResult.telegramPost}\n\nCTA: ${weeklyResult.cta}`, "Пост для Telegram")}><Copy size={14} /> Копировать пост</button></article>
        </div>
      </div>}

      <div className="strategy-check-card glass-card" style={{ "--progress": `${progress}%` } as CSSProperties}>
        <div className="check-card-head">
          <div><span className="eyebrow">твой план действий</span><h2>Чек-лист на эту цель</h2></div>
          <div className="progress-ring"><span>{progress}%</span></div>
        </div>
        <div className="strategy-check-list">
          {checklist.map((item, index) => <button key={`${item}-${index}`} className={`strategy-check-item ${completed[index] ? "done" : ""}`} onClick={() => onToggle(index)} aria-pressed={Boolean(completed[index])}>
            <span className="checkbox">{completed[index] && <Check size={13} />}</span>
            <span>{item}</span>
          </button>)}
        </div>
        <div className="strategy-check-footer"><span>{completedCount} из {checklist.length} пунктов сделано</span><span>Нажми на пункт, когда он готов.</span></div>
      </div>
    </section>
  );
}
