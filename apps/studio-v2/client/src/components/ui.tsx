import type { ReactNode } from "react";
import { IconAlert, IconCheck, IconSpinner } from "./icons";

/* ---------------------------------- button -------------------------------- */

type ButtonProps = {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "quiet" | "danger";
  full?: boolean;
  disabled?: boolean;
  loading?: boolean;
  type?: "button" | "submit";
  ariaLabel?: string;
  style?: React.CSSProperties;
};

export function Button({
  children,
  onClick,
  variant = "primary",
  full = false,
  disabled = false,
  loading = false,
  type = "button",
  ariaLabel,
  style,
}: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      aria-label={ariaLabel}
      style={style}
      className={`btn btn-${variant}${full ? " btn-full" : ""}`}
    >
      {variant === "primary" ? <i className="gloss" /> : null}
      <span className="btn-label">
        {loading ? <IconSpinner size={17} /> : null}
        {children}
      </span>
    </button>
  );
}

/* ---------------------------------- toast --------------------------------- */

export function Toast({ kind, children }: { kind: "ok" | "error"; children: ReactNode }) {
  return (
    <div className={kind === "error" ? "toast error" : "toast"} role="status">
      <i>{kind === "error" ? <IconAlert /> : <IconCheck size={15} />}</i>
      <span>{children}</span>
    </div>
  );
}

/* -------------------------------- empty state ------------------------------ */

export function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="ic">{icon}</div>
      <h2>{title}</h2>
      <p>{text}</p>
      {action}
    </div>
  );
}

/* ---------------------------------- sheet --------------------------------- */

export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="sheet-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-grab" />
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

/* -------------------------------- skeletons ------------------------------- */

export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="skeleton" />
      ))}
    </>
  );
}

/* ------------------------------- folder colors ----------------------------- */

/** Crimson-family swatches, so a new folder cannot break the palette. */
export const FOLDER_COLORS = [
  "#FF525A",
  "#F4363D",
  "#D8232A",
  "#B4151C",
  "#9E1319",
  "#D4A843",
  "#8A8A90",
] as const;
