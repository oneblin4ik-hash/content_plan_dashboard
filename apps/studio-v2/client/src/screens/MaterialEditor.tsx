import { useState } from "react";
import type { Material, MaterialScene, MaterialStatus } from "@shared/types";
import { api, ApiError } from "../lib/api";
import { triggerHaptic } from "../lib/haptics";
import { materialToText } from "../components/MaterialCard";
import { Button, Toast } from "../components/ui";
import { IconCopy, IconPlus, IconTrash } from "../components/icons";

const STATUSES: Array<{ value: MaterialStatus; label: string }> = [
  { value: "draft", label: "Черновик" },
  { value: "ready", label: "Готов" },
  { value: "published", label: "Опубликован" },
];

const EMPTY_SCENE: MaterialScene = { time: "", shot: "", speech: "", caption: "", edit: "" };

export function MaterialEditor({
  material,
  onSaved,
  onBack,
}: {
  material: Material;
  onSaved: () => void;
  onBack: () => void;
}) {
  const [draft, setDraft] = useState(material);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const isReel = draft.kind === "reel";
  const scenes = draft.scenes ?? [];

  const patchScene = (index: number, patch: Partial<MaterialScene>) => {
    setDraft((current) => ({
      ...current,
      scenes: (current.scenes ?? []).map((scene, position) =>
        position === index ? { ...scene, ...patch } : scene,
      ),
    }));
  };

  const save = async () => {
    if (busy || !draft.title.trim()) return;
    setBusy(true);
    setNotice(null);
    try {
      await api.updateMaterial(material.id, {
        title: draft.title.trim(),
        hook: draft.hook,
        body: draft.body,
        // An empty list means "no shots", which is null in the column.
        scenes: (draft.scenes ?? []).length > 0 ? draft.scenes : null,
        visual: draft.visual,
        cta: draft.cta,
        status: draft.status,
      });
      triggerHaptic("success");
      setNotice({ kind: "ok", text: "Сохранено." });
      onSaved();
    } catch (cause) {
      triggerHaptic("warning");
      setNotice({
        kind: "error",
        text: cause instanceof ApiError ? cause.message : "Не удалось сохранить.",
      });
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(materialToText(draft));
      triggerHaptic("success");
      setNotice({ kind: "ok", text: "Скопировано целиком." });
    } catch {
      setNotice({ kind: "error", text: "Браузер не дал доступ к буферу обмена." });
    }
  };

  return (
    <>
      <div className="field-g">
        <span className="label">Статус</span>
        <div className="pillrow">
          {STATUSES.map((option) => (
            <button
              key={option.value}
              className="pill"
              aria-pressed={draft.status === option.value}
              onClick={() => setDraft({ ...draft, status: option.value })}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="field-g">
        <label className="label" htmlFor="m-title">
          Название
        </label>
        <textarea
          id="m-title"
          className="input"
          rows={2}
          maxLength={220}
          value={draft.title}
          onChange={(event) => setDraft({ ...draft, title: event.target.value })}
        />
      </div>

      <div className="field-g">
        <label className="label" htmlFor="m-hook">
          Хук
        </label>
        <textarea
          id="m-hook"
          className="input"
          rows={2}
          maxLength={420}
          value={draft.hook ?? ""}
          onChange={(event) => setDraft({ ...draft, hook: event.target.value || null })}
        />
      </div>

      <div className="field-g">
        <label className="label" htmlFor="m-body">
          {isReel ? "Сквозная мысль" : "Текст поста"}
        </label>
        <textarea
          id="m-body"
          className="input"
          rows={isReel ? 3 : 14}
          maxLength={6000}
          value={draft.body ?? ""}
          onChange={(event) => setDraft({ ...draft, body: event.target.value || null })}
        />
        {!isReel ? (
          <span className="hint-inline">{(draft.body ?? "").length} знаков</span>
        ) : null}
      </div>

      {isReel ? (
        <div className="field-g">
          <span className="label">Кадры</span>
          {scenes.map((scene, index) => (
            <div className="scene" key={index}>
              <div className="scene-head">
                <span className="scene-no">Кадр {index + 1}</span>
                <input
                  className="input scene-time"
                  placeholder="0–3 сек"
                  maxLength={40}
                  value={scene.time}
                  onChange={(event) => patchScene(index, { time: event.target.value })}
                  aria-label={`Тайминг кадра ${index + 1}`}
                />
                <button
                  className="icon-btn"
                  aria-label={`Удалить кадр ${index + 1}`}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      scenes: scenes.filter((_, position) => position !== index),
                    })
                  }
                >
                  <IconTrash />
                </button>
              </div>
              {/*
                Each box is labelled, not just placeholdered: once a shot is
                filled in, four identical rectangles give no clue which one is
                the spoken line and which is the caption.
              */}
              <label className="scene-f">
                <span>В кадре</span>
                <textarea
                  className="input"
                  rows={2}
                  placeholder="Что видит зритель"
                  maxLength={400}
                  value={scene.shot}
                  onChange={(event) => patchScene(index, { shot: event.target.value })}
                />
              </label>
              <label className="scene-f">
                <span>Реплика</span>
                <textarea
                  className="input"
                  rows={2}
                  placeholder="Что говоришь"
                  maxLength={700}
                  value={scene.speech}
                  onChange={(event) => patchScene(index, { speech: event.target.value })}
                />
              </label>
              <label className="scene-f">
                <span>Титр</span>
                <input
                  className="input"
                  placeholder="Текст на экране"
                  maxLength={200}
                  value={scene.caption}
                  onChange={(event) => patchScene(index, { caption: event.target.value })}
                />
              </label>
              <label className="scene-f">
                <span>Монтаж</span>
                <input
                  className="input"
                  placeholder="Как склеить"
                  maxLength={300}
                  value={scene.edit}
                  onChange={(event) => patchScene(index, { edit: event.target.value })}
                />
              </label>
            </div>
          ))}
          {scenes.length < 12 ? (
            <Button
              variant="quiet"
              full
              onClick={() => setDraft({ ...draft, scenes: [...scenes, { ...EMPTY_SCENE }] })}
            >
              <IconPlus />
              Добавить кадр
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="field-g">
        <label className="label" htmlFor="m-visual">
          Визуал
        </label>
        <textarea
          id="m-visual"
          className="input"
          rows={2}
          maxLength={520}
          value={draft.visual ?? ""}
          onChange={(event) => setDraft({ ...draft, visual: event.target.value || null })}
        />
      </div>

      <div className="field-g">
        <label className="label" htmlFor="m-cta">
          Призыв
        </label>
        <input
          id="m-cta"
          className="input"
          maxLength={320}
          value={draft.cta ?? ""}
          onChange={(event) => setDraft({ ...draft, cta: event.target.value || null })}
        />
      </div>

      {notice ? <Toast kind={notice.kind}>{notice.text}</Toast> : null}

      <div className="dock">
        <Button variant="ghost" onClick={copy} style={{ flex: "none", minHeight: 46 }}>
          <IconCopy />
        </Button>
        <Button variant="ghost" onClick={onBack} style={{ flex: "none", minHeight: 46 }}>
          Назад
        </Button>
        <Button
          onClick={save}
          loading={busy}
          disabled={!draft.title.trim()}
          style={{ flex: 1, minHeight: 46 }}
        >
          Сохранить
        </Button>
      </div>
    </>
  );
}
