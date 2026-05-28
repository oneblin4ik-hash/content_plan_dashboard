import { Link, useLocation } from "wouter";
import { BarChart3, BookOpen, Sparkles, Calendar, Library, KeyRound, TrendingUp, Image as ImageIcon, Link2 } from "lucide-react";

/* Главная нав-полоса — только то, чем пользуются каждый день.
   Аналитика, интеграции и sync уходят в правый кластер «утилит»,
   чтобы основная навигация не растягивалась на восемь пунктов. */
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

function renderItem(it: Item, location: string, iconOnly = false) {
  const active = location === it.href;
  const Icon = it.icon;
  return (
    <li key={it.href}>
      <Link href={it.href}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: iconOnly ? "8px 10px" : "8px 14px",
            borderRadius: 9999,
            fontFamily: "var(--font-body)",
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: "-0.1px",
            color: active ? "var(--brand-gold)" : "var(--brand-platinum)",
            background: active ? "rgba(212,168,67,0.12)" : "transparent",
            transition: "color .2s, background .2s",
          }}
          title={iconOnly ? it.label : undefined}
        >
          <Icon className="w-4 h-4" />
          <span className={iconOnly ? "hidden lg:inline" : "hidden md:inline"}>
            {it.label}
          </span>
        </span>
      </Link>
    </li>
  );
}

export default function Navigation() {
  const [location] = useLocation();

  return (
    <nav
      className="frosted sticky top-0 z-40"
      style={{
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: "12px 0",
      }}
    >
      <div className="container flex items-center gap-6">
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
          {primary.map((it) => renderItem(it, location))}
        </ul>

        <ul
          className="flex items-center"
          style={{ listStyle: "none", gap: 2, margin: 0, padding: 0 }}
        >
          {utility.map((it) => renderItem(it, location, true))}
        </ul>
      </div>
    </nav>
  );
}
