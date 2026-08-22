import { useState } from "react";
import type { Folder, GeneratedIdea, SegmentCode } from "@shared/types";
import { segments } from "@shared/seed";
import { api, ApiError } from "../lib/api";
import { triggerHaptic } from "../lib/haptics";
import { Button, Toast } from "../components/ui";
import { IconSparkles } from "../components/icons";

type Channel = "telegram" | "reels" | "both";

const CHANNELS: Array<{ value: Channel; label: string }> = [
  { value: "telegram", label: "Telegram" },
  { value: "reels", label: "Reels" },
  { value: "both", label: "Оба" },
];

const COUNTS = [3, 6, 8] as const;

export function Generator({
  folders,
  usage,
  onDraft,
}: {
  folders: Folder[];
  usage: { used: number; limit: number };
  onDraft: (draftId: number, ideas: GeneratedIdea[], folderId: number | null) => void;
}) {
  const [segmentCode, setSegmentCode] = useState<SegmentCode>("S3");
  const [channel, setChannel] = useState<Channel>("reels");
  const [count, setCount] = useState<(typeof COUNTS)[number]>(6);
  const [focus, setFocus] = useState("");
  const [folderId, setFolderId] = useState<number | null>(folders[0]?.id ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exhausted = usage.used >= usage.limit;

  const run = async () => {
    if (busy || exhausted) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.generate({ segmentCode, channel, count, focus, folderId });
      triggerHaptic("success");
      onDraft(result.draftId, result.ideas, folderId);
    } catch (cause) {
      triggerHaptic("warning");
      setError(cause instanceof ApiError ? cause.message : "Генератор не ответил.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="field-g">
        <span className="label">Сегмент аудитории</span>
        <div className="seg-grid">
          {segments.map((segment) => (
            <button
              key={segment.code}
              className="seg-opt"
              aria-pressed={segmentCode === segment.code}
              onClick={() => setSegmentCode(segment.code)}
            >
              <b>
                {segment.code} · {segment.name}
              </b>
              <small>{segment.title}</small>
            </button>
          ))}
        </div>
      </div>

      <div className="field-g">
        <span className="label">Канал</span>
        <div className="pillrow">
          {CHANNELS.map((option) => (
            <button
              key={option.value}
              className="pill"
              aria-pressed={channel === option.value}
              onClick={() => setChannel(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="field-g">
        <span className="label">Сколько идей</span>
        <div className="pillrow">
          {COUNTS.map((value) => (
            <button
              key={value}
              className="pill"
              aria-pressed={count === value}
              onClick={() => setCount(value)}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      <div className="field-g">
        <label className="label" htmlFor="focus">
          Про что именно · необязательно
        </label>
        <input
          id="focus"
          className="input"
          placeholder="Например: питание в командировке"
          maxLength={240}
          value={focus}
          onChange={(event) => setFocus(event.target.value)}
        />
      </div>

      {/*
        The destination folder is chosen before generating — this is what stops
        saved ideas from landing unfiled and needing manual sorting afterwards.
      */}
      <div className="field-g">
        <label className="label" htmlFor="folder">
          Сохранить в папку
        </label>
        <select
          id="folder"
          className="input"
          value={folderId === null ? "" : String(folderId)}
          onChange={(event) => setFolderId(event.target.value ? Number(event.target.value) : null)}
        >
          {folders.map((folder) => (
            <option key={folder.id} value={folder.id}>
              {folder.name}
            </option>
          ))}
          <option value="">Без папки</option>
        </select>
      </div>

      {error ? <Toast kind="error">{error}</Toast> : null}
      {exhausted ? (
        <Toast kind="error">
          Дневной лимит генераций исчерпан ({usage.limit}). Идеи в банке никуда не денутся —
          продолжим завтра.
        </Toast>
      ) : null}

      <div className="dock">
        <Button full onClick={run} loading={busy} disabled={exhausted}>
          {busy ? "Придумываю…" : <><IconSparkles />{`Сгенерировать ${count}`}</>}
        </Button>
      </div>
    </>
  );
}
