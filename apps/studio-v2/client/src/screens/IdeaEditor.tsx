import { useState } from "react";
import type { Channel, Folder, Idea, Priority, SegmentCode } from "@shared/types";
import { priorityLabels, segments } from "@shared/seed";
import { api, ApiError } from "../lib/api";
import { triggerHaptic } from "../lib/haptics";
import { Button, Sheet, Toast } from "../components/ui";

export function IdeaEditor({
  idea,
  folders,
  onClose,
  onSaved,
}: {
  idea: Idea;
  folders: Folder[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState(idea);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!draft.title.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.updateIdea(idea.id, {
        title: draft.title.trim(),
        hook: draft.hook,
        format: draft.format,
        angle: draft.angle,
        visual: draft.visual,
        cta: draft.cta,
        folderId: draft.folderId,
        segmentCode: draft.segmentCode,
        channel: draft.channel,
        priority: draft.priority,
      });
      triggerHaptic("success");
      onSaved();
    } catch (cause) {
      triggerHaptic("warning");
      setError(cause instanceof ApiError ? cause.message : "Не удалось сохранить.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title="Изменить идею" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: "58dvh", overflowY: "auto" }}>
        <Field label="Тема">
          <textarea
            className="input"
            rows={2}
            value={draft.title}
            maxLength={220}
            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
          />
        </Field>

        <Field label="Хук">
          <textarea
            className="input"
            rows={2}
            value={draft.hook ?? ""}
            maxLength={420}
            placeholder="Фраза, которая цепляет внимание"
            onChange={(event) => setDraft({ ...draft, hook: event.target.value || null })}
          />
        </Field>

        <Field label="Папка">
          <select
            className="input"
            value={draft.folderId === null ? "" : String(draft.folderId)}
            onChange={(event) =>
              setDraft({ ...draft, folderId: event.target.value ? Number(event.target.value) : null })
            }
          >
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
            <option value="">Без папки</option>
          </select>
        </Field>

        <Field label="Сегмент">
          <select
            className="input"
            value={draft.segmentCode}
            onChange={(event) =>
              setDraft({ ...draft, segmentCode: event.target.value as SegmentCode })
            }
          >
            {segments.map((segment) => (
              <option key={segment.code} value={segment.code}>
                {segment.code} · {segment.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Канал">
          <select
            className="input"
            value={draft.channel}
            onChange={(event) => setDraft({ ...draft, channel: event.target.value as Channel })}
          >
            <option value="reels">Reels</option>
            <option value="telegram">Telegram</option>
          </select>
        </Field>

        <Field label="Приоритет">
          <select
            className="input"
            value={draft.priority}
            onChange={(event) => setDraft({ ...draft, priority: event.target.value as Priority })}
          >
            {Object.entries(priorityLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Визуал">
          <textarea
            className="input"
            rows={2}
            value={draft.visual ?? ""}
            maxLength={520}
            placeholder="Кадр, фон или визуальный приём"
            onChange={(event) => setDraft({ ...draft, visual: event.target.value || null })}
          />
        </Field>

        <Field label="Призыв">
          <input
            className="input"
            value={draft.cta ?? ""}
            maxLength={320}
            placeholder="Сохрани, если…"
            onChange={(event) => setDraft({ ...draft, cta: event.target.value || null })}
          />
        </Field>
      </div>

      {error ? <Toast kind="error">{error}</Toast> : null}

      <Button full onClick={save} loading={busy} disabled={!draft.title.trim()}>
        Сохранить
      </Button>
      <Button variant="quiet" full onClick={onClose}>
        Отмена
      </Button>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="field-g">
      <span className="label">{label}</span>
      {children}
    </div>
  );
}
