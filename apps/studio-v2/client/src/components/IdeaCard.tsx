import type { Folder, Idea } from "@shared/types";
import { useTilt } from "../lib/motion";
import { triggerHaptic } from "../lib/haptics";
import { IconCopy, IconHeart, IconPencil, IconTrash, IconWand } from "./icons";

const CHANNEL_LABEL: Record<string, string> = { telegram: "Telegram", reels: "Reels" };

function formatDate(seconds: number): string {
  const date = new Date(seconds * 1000);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  if (sameDay) {
    return `Сегодня, ${date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`;
  }
  return date.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" });
}

/** Everything worth pasting into a post, in the order it gets written. */
export function ideaToText(idea: Idea): string {
  return [
    idea.title,
    idea.hook ? `Хук: ${idea.hook}` : "",
    idea.angle,
    idea.format ? `Формат: ${idea.format}` : "",
    idea.visual ? `Визуал: ${idea.visual}` : "",
    idea.cta ? `CTA: ${idea.cta}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function IdeaCard({
  idea,
  folder,
  onFavorite,
  onEdit,
  onMakeMaterial,
  onDelete,
  onCopy,
}: {
  idea: Idea;
  folder: Folder | undefined;
  onFavorite: (idea: Idea) => void;
  onEdit: (idea: Idea) => void;
  onMakeMaterial: (idea: Idea) => void;
  onDelete: (idea: Idea) => void;
  onCopy: (idea: Idea) => void;
}) {
  const ref = useTilt<HTMLElement>();
  const accent = folder?.color ?? "#6B6B72";

  return (
    <article ref={ref} className="idea" style={{ ["--fc" as string]: accent }}>
      <div className="idea-top">
        <span className="tag tag-seg">{idea.segmentCode}</span>
        <span className="tag tag-ch">{CHANNEL_LABEL[idea.channel] ?? idea.channel}</span>
        {idea.priority === "viral" ? <span className="tag tag-viral">Вирусный</span> : null}
        {folder ? (
          <span
            className="tag"
            style={{ background: `${accent}2b`, color: accent }}
          >
            {folder.name}
          </span>
        ) : (
          <span className="tag tag-ch">Без папки</span>
        )}
      </div>

      <h2>{idea.title}</h2>
      {idea.hook ? <p className="body">{idea.hook}</p> : null}

      <div className="idea-foot">
        <span>{formatDate(idea.createdAt)}</span>
        <span className="idea-acts">
          <button
            className={idea.isFavorite ? "icon-btn on" : "icon-btn"}
            aria-label={idea.isFavorite ? "Убрать из избранного" : "В избранное"}
            aria-pressed={idea.isFavorite}
            onClick={() => {
              triggerHaptic("success");
              onFavorite(idea);
            }}
          >
            <IconHeart filled={idea.isFavorite} />
          </button>
          <button
            className="icon-btn accent"
            aria-label="Сделать материал"
            onClick={() => {
              triggerHaptic("navigation");
              onMakeMaterial(idea);
            }}
          >
            <IconWand />
          </button>
          <button className="icon-btn" aria-label="Скопировать" onClick={() => onCopy(idea)}>
            <IconCopy />
          </button>
          <button className="icon-btn" aria-label="Изменить" onClick={() => onEdit(idea)}>
            <IconPencil />
          </button>
          <button className="icon-btn" aria-label="В корзину" onClick={() => onDelete(idea)}>
            <IconTrash />
          </button>
        </span>
      </div>
    </article>
  );
}
