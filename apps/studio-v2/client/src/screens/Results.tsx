import { useState } from "react";
import type { Folder, GeneratedIdea } from "@shared/types";
import { api, ApiError } from "../lib/api";
import { triggerHaptic } from "../lib/haptics";
import { Button, Toast } from "../components/ui";
import { IconCheck } from "../components/icons";

export function Results({
  draftId,
  ideas,
  folders,
  folderId,
  onSaved,
  onDiscard,
}: {
  draftId: number;
  ideas: GeneratedIdea[];
  folders: Folder[];
  folderId: number | null;
  onSaved: (saved: number, folderName: string) => void;
  onDiscard: () => void;
}) {
  // Everything starts selected: the common case is keeping the batch.
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(ideas.map((_, index) => index)),
  );
  const [target, setTarget] = useState<number | null>(folderId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const folderName = folders.find((folder) => folder.id === target)?.name ?? "Без папки";

  const toggle = (index: number) => {
    triggerHaptic("tap");
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const save = async () => {
    if (busy || selected.size === 0) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.saveDraft(draftId, [...selected].sort((a, b) => a - b), target);
      triggerHaptic("success");
      onSaved(result.saved, folderName);
    } catch (cause) {
      triggerHaptic("warning");
      setError(cause instanceof ApiError ? cause.message : "Не удалось сохранить.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Toast kind="ok">Черновик сохранён — можно закрыть приложение и вернуться</Toast>

      <div className="field-g">
        <label className="label" htmlFor="target">
          Папка назначения
        </label>
        <select
          id="target"
          className="input"
          value={target === null ? "" : String(target)}
          onChange={(event) => setTarget(event.target.value ? Number(event.target.value) : null)}
        >
          {folders.map((folder) => (
            <option key={folder.id} value={folder.id}>
              {folder.name}
            </option>
          ))}
          <option value="">Без папки</option>
        </select>
      </div>

      {ideas.map((idea, index) => (
        <button
          key={`${idea.title}-${index}`}
          className="res"
          aria-pressed={selected.has(index)}
          onClick={() => toggle(index)}
        >
          <span className="box">
            <IconCheck size={13} />
          </span>
          <span className="res-body">
            <h2>{idea.title}</h2>
            <p>
              Хук: {idea.hook} · {idea.format}
            </p>
          </span>
        </button>
      ))}

      {error ? <Toast kind="error">{error}</Toast> : null}

      <div className="dock">
        <div className="meta">
          <b>{selected.size} отмечено</b>в «{folderName}»
        </div>
        <Button variant="ghost" onClick={onDiscard} style={{ flex: "none", minHeight: 46 }}>
          Отбросить
        </Button>
        <Button
          onClick={save}
          loading={busy}
          disabled={selected.size === 0}
          style={{ flex: 1, minHeight: 46 }}
        >
          Сохранить
        </Button>
      </div>
    </>
  );
}
