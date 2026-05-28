import { Link, useLocation } from "wouter";
import {
  BarChart3, BookOpen, Sparkles, Calendar, Library, KeyRound,
  TrendingUp, Image as ImageIcon, Link2,
} from "lucide-react";

/* Главная нав-полоса.
   Desktop: логотип слева, primary по центру, utility справа.
   iPhone: логотип сверху, ниже горизонтальный скролл-стрип со всеми
   разделами (primary + utility в одном ряду — на телефоне нет смысла
   делить, проще все в одну ленту). Размеры тапов ≥ 40×40. */
const primary = [
  { href: "/", label: "План", icon: BookOpen },
  { href: "/generator", label: "Студия", icon: Sparkles },
  { href: "/trends", label: "Тренды", icon: TrendingUp },
  { href: "/media", label: "Медиа", icon: ImageIcon },
  { href: "/library", label: "Библиотека", icon: Library },
  { href: "/calendar", label: "Календарь", icon: Calendar },
];

const utility = [
  { href: "/analytics", label: "Аналитика", icon: BarChart3 },
  { href: "/integrations", label: "Интеграции", icon: Link2 },
  { href: "/settings", label: "Sync", icon: KeyRound },
];

type Item = { href: string; label: string; icon: typeof BookOpen };

function NavChip({
  item,
  active,
  iconOnly,
}: {
  item: Item;
  active: boolean;
  iconOnly?: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link href={item.href}>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          minHeight: 40,
          padding: iconOnly ? "8px 12px" : "8px 14px",
          borderRadius: 9999,
          fontFamily: "var(--font-body)",
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: "-0.1px",
          color: active ? "var(--brand-gold)" : "var(--brand-platinum)",
          background: active ? "rgba(212,168,67,0.12)" : "transparent",
          transition: "color .2s, background .2s",
          whiteSpace: "nowrap",
        }}
        title={iconOnly ? item.label : undefined}
      >
        <Icon className="w-4 h-4" />
        <span className={iconOnly ? "hidden lg:inline" : "hidden sm:inline"}>
          {item.label}
        </span>
      </span>
    </Link>
  );
}

export default function Navigation() {
  const [location] = useLocation();
  const all = [...primary, ...utility];

  return (
    <nav
      className="frosted sticky top-0 z-40"
      style={{
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        paddingTop: "max(10px, env(safe-area-inset-top))",
        paddingBottom: 10,
      }}
    >
      {/* Desktop / tablet: одна полоса. */}
      <div className="container hidden md:flex items-center gap-6">
        <Link href="/">
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: 20,
              letterSpacing: "-0.3px",
              color: "#fff",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Content Studio<span style={{ color: "var(--brand-gold)" }}>.</span>{" "}
            <span style={{ color: "var(--brand-platinum)", fontWeight: 400 }}>
              Mr. Serbolin
            </span>
          </span>
        </Link>
        <ul
          className="flex flex-1 items-center justify-center"
          style={{ listStyle: "none", gap: 4, margin: 0, padding: 0 }}
        >
          {primary.map((it) => (
            <li key={it.href}>
              <NavChip item={it} active={location === it.href} />
            </li>
          ))}
        </ul>
        <ul
          className="flex items-center"
          style={{ listStyle: "none", gap: 2, margin: 0, padding: 0 }}
        >
          {utility.map((it) => (
            <li key={it.href}>
              <NavChip item={it} active={location === it.href} iconOnly />
            </li>
          ))}
        </ul>
      </div>

      {/* iPhone: компактный заголовок + горизонтальный скролл-стрип. */}
      <div className="container md:hidden" style={{ paddingBottom: 0 }}>
        <Link href="/">
          <span
            style={{
              display: "block",
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: 16,
              letterSpacing: "-0.3px",
              color: "#fff",
              marginBottom: 8,
            }}
          >
            Content Studio
            <span style={{ color: "var(--brand-gold)" }}>.</span>
          </span>
        </Link>
        <ul
          className="scroll-strip flex items-center"
          style={{ listStyle: "none", gap: 4, margin: 0, padding: "0 12px" }}
        >
          {all.map((it) => (
            <li key={it.href}>
              <NavChip item={it} active={location === it.href} />
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
