import { useState } from "react";
import type { Folder, Overview } from "@shared/types";
import { api, ApiError } from "../lib/api";
import { triggerHaptic } from "../lib/haptics";
import { Button, FOLDER_COLORS, Sheet, Toast } from "../components/ui";
import { IconPencil, IconPlus, IconTrash } from "../components/icons";

type Editing = { id: number | null; name: string; color: string };

export function Folders({
  folders,
  totals,
  onChanged,
}: {
  folders: Folder[];
  totals: Overview["totals"];
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState<Editing | null>(null);
  const [confirming, setConfirming] = useState<Folder | null>(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!editing || !editing.name.trim() || busy) return;
    setBusy(true);
    try {
      if (editing.id === null) {
        await api.createFolder(editing.name.trim(), editing.color);
        setNotice({ kind: "ok", text: "Папка создана." });
      } else {
        await api.updateFolder(editing.id, { name: editing.name.trim(), color: editing.color });
        setNotice({ kind: "ok", text: "Папка обновлена." });
      }
      triggerHaptic("success");
      setEditing(null);
      onChanged();
    } catch (cause) {
      triggerHaptic("warning");
      setNotice({
        kind: "error",
        text: cause instanceof ApiError ? cause.message : "Не удалось сохранить папку.",
      });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirming || busy) return;
    setBusy(true);
    try {
      await api.deleteFolder(confirming.id);
      triggerHaptic("warning");
      setNotice({
        kind: "ok",
        text:
          confirming.count > 0
            ? `Папка удалена. ${confirming.count} идей переехали в «Без папки».`
            : "Папка удалена.",
      });
      setConfirming(null);
      onChanged();
    } catch (cause) {
      setNotice({
        kind: "error",
        text: cause instanceof ApiError ? cause.message : "Не удалось удалить папку.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="stats">
        <div className="stat">
          <b>{totals.all}</b>
          <span>Всего</span>
        </div>
        <div className="stat">
          <b>{folders.length}</b>
          <span>Папки</span>
        </div>
        <div className="stat">
          <b>{totals.unfiled}</b>
          <span>Без папки</span>
        </div>
      </div>

      {notice ? <Toast kind={notice.kind}>{notice.text}</Toast> : null}

      {folders.map((folder) => (
        <div key={folder.id} className="frow">
          <span className="swatch" style={{ background: folder.color }} />
          <span className="nm">{folder.name}</span>
          <span className="ct">{folder.count}</span>
          <button
            className="icon-btn"
            aria-label={`Изменить папку ${folder.name}`}
            onClick={() => setEditing({ id: folder.id, name: folder.name, color: folder.color })}
          >
            <IconPencil />
          </button>
          <button
            className="icon-btn"
            aria-label={`Удалить папку ${folder.name}`}
            onClick={() => setConfirming(folder)}
          >
            <IconTrash />
          </button>
        </div>
      ))}

      <div className="frow dashed">
        <span className="swatch" style={{ background: "#4E4E56" }} />
        <span className="nm">Без папки</span>
        <span className="ct">{totals.unfiled}</span>
      </div>

      <div className="dock">
        <Button full onClick={() => setEditing({ id: null, name: "", color: FOLDER_COLORS[0] })}>
          <IconPlus />
          Новая папка
        </Button>
      </div>

      {editing ? (
        <Sheet
          title={editing.id === null ? "Новая папка" : "Изменить папку"}
          onClose={() => setEditing(null)}
        >
          <div className="field-g">
            <label className="label" htmlFor="folder-name">
              Название
            </label>
            <input
              id="folder-name"
              className="input"
              value={editing.name}
              maxLength={60}
              autoFocus
              placeholder="Например: Личный опыт"
              onChange={(event) => setEditing({ ...editing, name: event.target.value })}
            />
          </div>

          <div className="field-g">
            <span className="label">Цвет</span>
            <div className="swatch-row">
              {FOLDER_COLORS.map((color) => (
                <button
                  key={color}
                  className="swatch-pick"
                  style={{ background: color }}
                  aria-label={`Цвет ${color}`}
                  aria-pressed={editing.color === color}
                  onClick={() => setEditing({ ...editing, color })}
                />
              ))}
            </div>
          </div>

          <Button full onClick={save} loading={busy} disabled={!editing.name.trim()}>
            Сохранить
          </Button>
          <Button variant="quiet" full onClick={() => setEditing(null)}>
            Отмена
          </Button>
        </Sheet>
      ) : null}

      {confirming ? (
        <Sheet title={`Удалить «${confirming.name}»?`} onClose={() => setConfirming(null)}>
          <p style={{ color: "var(--g-1)", fontSize: 13, lineHeight: 1.6 }}>
            {confirming.count > 0
              ? `Идеи не пропадут: ${confirming.count} шт. переедут в «Без папки», и их можно будет разложить заново.`
              : "Папка пустая — удаление ничего не затронет."}
          </p>
          <Button variant="danger" full onClick={remove} loading={busy}>
            Удалить папку
          </Button>
          <Button variant="quiet" full onClick={() => setConfirming(null)}>
            Отмена
          </Button>
        </Sheet>
      ) : null}
    </>
  );
}
