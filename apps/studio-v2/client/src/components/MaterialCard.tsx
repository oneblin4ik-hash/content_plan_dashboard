import type { Material } from "@shared/types";
import { useTilt } from "../lib/motion";
import { triggerHaptic } from "../lib/haptics";
import { IconCopy, IconFilm, IconHeart, IconMessage, IconPencil, IconTrash } from "./icons";

const STATUS_LABEL: Record<Material["status"], string> = {
  draft: "Черновик",
  ready: "Готов",
  published: "Опубликован",
};

function formatDate(seconds: number): string {
  const date = new Date(seconds * 1000);
  const sameDay = date.toDateString() === new Date().toDateString();
  if (sameDay) {
    return `Сегодня, ${date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`;
  }
  return date.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" });
}

/**
 * The whole material as plain text, laid out the way it gets filmed or posted:
 * a Reel reads shot by shot, a post reads as the finished body.
 */
export function materialToText(material: Material): string {
  const head = [material.title, material.hook ? `Хук: ${material.hook}` : ""].filter(Boolean);

  const scenes = (material.scenes ?? []).map((scene) =>
    [
      `${scene.time} · ${scene.shot}`,
      scene.speech ? `Реплика: ${scene.speech}` : "",
      scene.caption ? `Титр: ${scene.caption}` : "",
      scene.edit ? `Монтаж: ${scene.edit}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  );

  return [
    ...head,
    material.body ?? "",
    ...scenes,
    material.visual ? `Визуал: ${material.visual}` : "",
    material.cta ? `CTA: ${material.cta}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function MaterialCard({
  material,
  onFavorite,
  onOpen,
  onDelete,
  onCopy,
}: {
  material: Material;
  onFavorite: (material: Material) => void;
  onOpen: (material: Material) => void;
  onDelete: (material: Material) => void;
  onCopy: (material: Material) => void;
}) {
  const ref = useTilt<HTMLElement>();
  const isReel = material.kind === "reel";
  const accent = isReel ? "#FF525A" : "#9E1319";
  const preview = isReel
    ? `${material.scenes?.length ?? 0} ${plural(material.scenes?.length ?? 0)}`
    : `${(material.body ?? "").length} знаков`;

  return (
    <article ref={ref} className="idea" style={{ ["--fc" as string]: accent }}>
      <div className="idea-top">
        <span className="tag tag-seg">{material.segmentCode}</span>
        <span className="tag tag-ch" style={{ background: `${accent}2b`, color: accent }}>
          {isReel ? <IconFilm size={12} /> : <IconMessage size={12} />}
          {isReel ? "Сценарий" : "Пост"}
        </span>
        <span className={`tag tag-status is-${material.status}`}>
          {STATUS_LABEL[material.status]}
        </span>
      </div>

      <h2>{material.title}</h2>
      {material.hook ? <p className="body">{material.hook}</p> : null}

      <div className="idea-foot">
        <span>
          {formatDate(material.updatedAt)} · {preview}
        </span>
        <span className="idea-acts">
          <button
            className={material.isFavorite ? "icon-btn on" : "icon-btn"}
            aria-label={material.isFavorite ? "Убрать из избранного" : "В избранное"}
            aria-pressed={material.isFavorite}
            onClick={() => {
              triggerHaptic("success");
              onFavorite(material);
            }}
          >
            <IconHeart filled={material.isFavorite} />
          </button>
          <button className="icon-btn" aria-label="Скопировать" onClick={() => onCopy(material)}>
            <IconCopy />
          </button>
          <button className="icon-btn" aria-label="Открыть" onClick={() => onOpen(material)}>
            <IconPencil />
          </button>
          <button className="icon-btn" aria-label="В корзину" onClick={() => onDelete(material)}>
            <IconTrash />
          </button>
        </span>
      </div>
    </article>
  );
}

function plural(count: number): string {
  const tens = count % 100;
  const ones = count % 10;
  if (tens >= 11 && tens <= 14) return "кадров";
  if (ones === 1) return "кадр";
  if (ones >= 2 && ones <= 4) return "кадра";
  return "кадров";
}
