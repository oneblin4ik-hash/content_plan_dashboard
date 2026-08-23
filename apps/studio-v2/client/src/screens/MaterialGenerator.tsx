import { useState } from "react";
import type { Idea, Material, MaterialKind, MaterialLength, SegmentCode } from "@shared/types";
import { segments } from "@shared/seed";
import { api, ApiError } from "../lib/api";
import { triggerHaptic } from "../lib/haptics";
import { Button, Toast } from "../components/ui";
import { IconFilm, IconMessage, IconWand } from "../components/icons";

const LENGTHS: Array<{ value: MaterialLength; label: string; hint: string }> = [
  { value: "short", label: "Коротко", hint: "до 20 сек · до 800 знаков" },
  { value: "medium", label: "Рабочий", hint: "30–45 сек · 1200–1800 знаков" },
  { value: "long", label: "Развёрнуто", hint: "до 60 сек · 2500–3500 знаков" },
];

const GOALS = ["охват", "сохранения", "пересылки", "комментарии", "заявки"];

export function MaterialGenerator({
  idea,
  usage,
  onDone,
  onCancel,
}: {
  /** Set when the material grows out of a saved idea; null for a bare topic. */
  idea: Idea | null;
  usage: { used: number; limit: number };
  onDone: (material: Material) => void;
  onCancel: () => void;
}) {
  const [kind, setKind] = useState<MaterialKind>(
    idea?.channel === "telegram" ? "post" : "reel",
  );
  const [topic, setTopic] = useState(idea?.title ?? "");
  const [segmentCode, setSegmentCode] = useState<SegmentCode>(idea?.segmentCode ?? "S3");
  const [length, setLength] = useState<MaterialLength>("medium");
  const [goal, setGoal] = useState(idea?.objective ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exhausted = usage.used >= usage.limit;
  const ready = topic.trim().length > 0;

  const run = async () => {
    if (busy || exhausted || !ready) return;
    setBusy(true);
    setError(null);
    try {
      const material = await api.generateMaterial({
        kind,
        ideaId: idea?.id ?? null,
        topic: topic.trim(),
        segmentCode,
        length,
        goal: goal.trim(),
      });
      triggerHaptic("success");
      onDone(material);
    } catch (cause) {
      triggerHaptic("warning");
      setError(cause instanceof ApiError ? cause.message : "Генератор не ответил.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {idea ? (
        <Toast kind="ok">Материал вырастет из идеи «{idea.title}» и сохранит её угол подачи</Toast>
      ) : null}

      <div className="field-g">
        <span className="label">Что делаем</span>
        <div className="seg-grid">
          <button className="seg-opt" aria-pressed={kind === "reel"} onClick={() => setKind("reel")}>
            <b>
              <IconFilm size={14} /> Сценарий Reels
            </b>
            <small>Покадрово: кадр, реплика, титр, монтаж</small>
          </button>
          <button className="seg-opt" aria-pressed={kind === "post"} onClick={() => setKind("post")}>
            <b>
              <IconMessage size={14} /> Пост в Telegram
            </b>
            <small>Готовый текст с абзацами</small>
          </button>
        </div>
      </div>

      <div className="field-g">
        <label className="label" htmlFor="topic">
          Тема
        </label>
        <textarea
          id="topic"
          className="input"
          rows={2}
          maxLength={220}
          placeholder="О чём материал"
          value={topic}
          onChange={(event) => setTopic(event.target.value)}
        />
      </div>

      <div className="field-g">
        <label className="label" htmlFor="segment">
          Сегмент аудитории
        </label>
        <select
          id="segment"
          className="input"
          value={segmentCode}
          onChange={(event) => setSegmentCode(event.target.value as SegmentCode)}
        >
          {segments.map((segment) => (
            <option key={segment.code} value={segment.code}>
              {segment.code} · {segment.name}
            </option>
          ))}
        </select>
      </div>

      <div className="field-g">
        <span className="label">Объём</span>
        <div className="pillrow">
          {LENGTHS.map((option) => (
            <button
              key={option.value}
              className="pill"
              aria-pressed={length === option.value}
              onClick={() => setLength(option.value)}
              title={option.hint}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="field-g">
        <span className="label">Что должен принести · необязательно</span>
        <div className="pillrow">
          {GOALS.map((option) => (
            <button
              key={option}
              className="pill"
              aria-pressed={goal === option}
              onClick={() => setGoal(goal === option ? "" : option)}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {error ? <Toast kind="error">{error}</Toast> : null}
      {exhausted ? (
        <Toast kind="error">
          Дневной лимит генераций исчерпан ({usage.limit}). Материалы в библиотеке никуда не денутся
          — продолжим завтра.
        </Toast>
      ) : null}

      <div className="dock">
        <Button variant="ghost" onClick={onCancel} style={{ flex: "none", minHeight: 46 }}>
          Отмена
        </Button>
        <Button
          onClick={run}
          loading={busy}
          disabled={exhausted || !ready}
          style={{ flex: 1, minHeight: 46 }}
        >
          {busy ? "Пишу…" : <><IconWand />Написать</>}
        </Button>
      </div>
    </>
  );
}
