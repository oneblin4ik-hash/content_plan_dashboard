type IconProps = { size?: number; filled?: boolean };

const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function frame(size: number) {
  return { width: size, height: size, viewBox: "0 0 24 24", "aria-hidden": true } as const;
}

export function IconBulb({ size = 20 }: IconProps) {
  return (
    <svg {...frame(size)} {...base}>
      <path d="M9 18h6M10 22h4M12 2a7 7 0 00-4 12.7V17h8v-2.3A7 7 0 0012 2z" />
    </svg>
  );
}

export function IconFolder({ size = 20 }: IconProps) {
  return (
    <svg {...frame(size)} {...base}>
      <path d="M3 7a2 2 0 012-2h4l2 2.5h8a2 2 0 012 2V18a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
    </svg>
  );
}

export function IconHeart({ size = 20, filled = false }: IconProps) {
  return (
    <svg {...frame(size)} {...base} fill={filled ? "currentColor" : "none"}>
      <path d="M12 21s-7.5-4.7-9.3-9.2C1.3 8.3 3.2 5 6.6 5c2 0 3.5 1.1 4.4 2.4l1 1.4 1-1.4C13.9 6.1 15.4 5 17.4 5c3.4 0 5.3 3.3 3.9 6.8C19.5 16.3 12 21 12 21z" />
    </svg>
  );
}

export function IconSettings({ size = 20 }: IconProps) {
  return (
    <svg {...frame(size)} {...base}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-2.7 1.1V21a2 2 0 11-4 0v-.1a1.6 1.6 0 00-2.7-1.1l-.1.1a2 2 0 11-2.8-2.8l.1-.1A1.6 1.6 0 003 15a2 2 0 110-4h.1a1.6 1.6 0 001.5-2.5l-.1-.1a2 2 0 112.8-2.8l.1.1A1.6 1.6 0 0010 4.6V3a2 2 0 114 0v.1a1.6 1.6 0 002.7 1.1l.1-.1a2 2 0 112.8 2.8l-.1.1A1.6 1.6 0 0021 11a2 2 0 110 4h-1.6z" />
    </svg>
  );
}

export function IconSparkles({ size = 18 }: IconProps) {
  return (
    <svg {...frame(size)} {...base} strokeWidth={2.3}>
      <path d="M12 3l1.6 4.9L18.5 9.5l-4.9 1.6L12 16l-1.6-4.9L5.5 9.5l4.9-1.6L12 3z" />
      <path d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2z" />
    </svg>
  );
}

export function IconSearch({ size = 16 }: IconProps) {
  return (
    <svg {...frame(size)} {...base} strokeWidth={2.2}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}

export function IconSort({ size = 15 }: IconProps) {
  return (
    <svg {...frame(size)} {...base} strokeWidth={2.2}>
      <path d="M4 6h16M6 12h12M9 18h6" />
    </svg>
  );
}

export function IconPencil({ size = 16 }: IconProps) {
  return (
    <svg {...frame(size)} {...base}>
      <path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}

export function IconTrash({ size = 16 }: IconProps) {
  return (
    <svg {...frame(size)} {...base}>
      <path d="M4 6h16M10 11v6M14 11v6M6 6l1 13a2 2 0 002 2h6a2 2 0 002-2l1-13M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
    </svg>
  );
}

export function IconCopy({ size = 16 }: IconProps) {
  return (
    <svg {...frame(size)} {...base}>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15V5a2 2 0 012-2h10" />
    </svg>
  );
}

export function IconPlus({ size = 17 }: IconProps) {
  return (
    <svg {...frame(size)} {...base} strokeWidth={2.4}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconCheck({ size = 14 }: IconProps) {
  return (
    <svg {...frame(size)} {...base} strokeWidth={2.6}>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

export function IconDownload({ size = 17 }: IconProps) {
  return (
    <svg {...frame(size)} {...base} strokeWidth={2.2}>
      <path d="M12 3v13M7 11l5 5 5-5M4 20h16" />
    </svg>
  );
}

export function IconUpload({ size = 17 }: IconProps) {
  return (
    <svg {...frame(size)} {...base} strokeWidth={2.2}>
      <path d="M12 16V3M7 8l5-5 5 5M4 20h16" />
    </svg>
  );
}

export function IconSpinner({ size = 22 }: IconProps) {
  return (
    <svg {...frame(size)} {...base} className="spinner">
      <path d="M12 3a9 9 0 109 9" />
    </svg>
  );
}

export function IconAlert({ size = 15 }: IconProps) {
  return (
    <svg {...frame(size)} {...base} strokeWidth={2.2}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6M12 16.5v.01" />
    </svg>
  );
}

export function IconStar({ size = 26 }: IconProps) {
  return (
    <svg {...frame(size)} {...base}>
      <path d="M12 3l1.9 5.8H20l-4.9 3.6 1.9 5.8-5-3.6-5 3.6 1.9-5.8L4 8.8h6.1L12 3z" />
    </svg>
  );
}

export function IconBack({ size = 18 }: IconProps) {
  return (
    <svg {...frame(size)} {...base} strokeWidth={2.3}>
      <path d="M19 12H5M11 18l-6-6 6-6" />
    </svg>
  );
}

export function IconFilm({ size = 20 }: IconProps) {
  return (
    <svg {...frame(size)} {...base}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7 4v16M17 4v16M3 12h18M3 8h4M3 16h4M17 8h4M17 16h4" />
    </svg>
  );
}

export function IconMessage({ size = 20 }: IconProps) {
  return (
    <svg {...frame(size)} {...base}>
      <path d="M21 12a8 8 0 01-8 8H7l-4 3v-5.5A8 8 0 1121 12z" />
    </svg>
  );
}

export function IconWand({ size = 20 }: IconProps) {
  return (
    <svg {...frame(size)} {...base}>
      <path d="M4 20L16 8M14 4l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2zM20 12l.7 1.4 1.4.7-1.4.7-.7 1.4-.7-1.4-1.4-.7 1.4-.7.7-1.4z" />
    </svg>
  );
}

export function IconLayers({ size = 20 }: IconProps) {
  return (
    <svg {...frame(size)} {...base}>
      <path d="M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 17l9 5 9-5" />
    </svg>
  );
}
