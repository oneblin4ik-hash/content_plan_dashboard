import { Link, useLocation } from "wouter";
import {
  BarChart3,
  BookOpen,
  Sparkles,
  Calendar,
  KeyRound,
  TrendingUp,
  Link2,
  Layers,
  LogOut,
  MessageCircle,
  CreditCard,
  Crown,
  MessageSquare,
  Microscope,
  Bookmark,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

/* ============================================================
   Sidebar (desktop). Левая вертикальная навигация шириной 240px,
   sticky на 100vh. Логотип сверху, primary nav, разделитель,
   utility nav, в самом низу — блок юзера (триал-бейдж, email,
   logout).

   На mobile/планшете не отображается (см. CSS media query) —
   там используется горизонтальный strip из Navigation.tsx.

   Поведение: при role=admin добавляется пункт «Админ» в utility;
   на лендинге ("/" для незалогиненного) sidebar не рендерится
   вообще (логика в Shell в App.tsx).
   ============================================================ */

type Item = { href: string; label: string; icon: LucideIcon };

const primary: Item[] = [
  { href: "/dashboard", label: "Идеи", icon: BookOpen },
  { href: "/templates", label: "Шаблоны", icon: Bookmark },
  { href: "/assistant", label: "Помощник", icon: MessageSquare },
  { href: "/generator", label: "Студия", icon: Sparkles },
  { href: "/carousel", label: "Карусели", icon: Layers },
  { href: "/plan", label: "План", icon: Calendar },
  { href: "/analytics", label: "Аналитика", icon: BarChart3 },
];

const utility: Item[] = [
  { href: "/trends", label: "Тренды", icon: TrendingUp },
  { href: "/analyze", label: "Разбор поста", icon: Microscope },
  { href: "/integrations", label: "Интеграции", icon: Link2 },
  { href: "/voice", label: "Голос", icon: MessageCircle },
  { href: "/pricing", label: "Тариф", icon: CreditCard },
  { href: "/settings", label: "Настройки", icon: KeyRound },
];

function isActive(href: string, location: string): boolean {
  if (href === "/plan") {
    return (
      location === "/plan" ||
      location === "/calendar" ||
      location === "/library"
    );
  }
  return location === href;
}

function SidebarLink({ item, active }: { item: Item; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link href={item.href}>
      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "10px 14px",
          borderRadius: 10,
          fontFamily: "var(--font-body)",
          fontSize: 14,
          fontWeight: 600,
          color: active ? "var(--brand-gold)" : "var(--brand-platinum)",
          background: active ? "rgba(212,168,67,0.12)" : "transparent",
          cursor: "pointer",
          transition: "background 0.15s, color 0.15s",
        }}
        onMouseEnter={(e) => {
          if (!active)
            e.currentTarget.style.background = "rgba(255,255,255,0.04)";
        }}
        onMouseLeave={(e) => {
          if (!active) e.currentTarget.style.background = "transparent";
        }}
      >
        <Icon className="w-4 h-4" style={{ flexShrink: 0 }} />
        <span>{item.label}</span>
      </span>
    </Link>
  );
}

export default function Sidebar() {
  const [location] = useLocation();
  const { user, signOut } = useAuth();

  const utilityForUser =
    user?.role === "admin"
      ? [{ href: "/admin", label: "Админ", icon: Crown }, ...utility]
      : utility;

  const trialDaysLeft = user
    ? Math.max(
        0,
        Math.ceil((user.trialEndsAt - Date.now()) / (24 * 60 * 60 * 1000)),
      )
    : 0;
  const trialActive = user?.plan === "trial" && trialDaysLeft > 0;

  return (
    <aside
      className="cs-sidebar"
      style={{
        width: 240,
        flexShrink: 0,
        height: "100vh",
        position: "sticky",
        top: 0,
        background: "var(--background)",
        borderRight: "1px solid rgba(255,255,255,0.06)",
        display: "flex",
        flexDirection: "column",
        padding: "20px 14px 16px",
        gap: 16,
      }}
    >
      <Link href="/">
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 20,
            letterSpacing: "-0.3px",
            color: "#fff",
            cursor: "pointer",
            padding: "0 6px",
            whiteSpace: "nowrap",
          }}
        >
          Content Studio
          <span style={{ color: "var(--brand-gold)" }}>.</span>
        </span>
      </Link>

      <nav
        aria-label="primary"
        style={{ display: "flex", flexDirection: "column", gap: 2 }}
      >
        {primary.map((it) => (
          <SidebarLink key={it.href} item={it} active={isActive(it.href, location)} />
        ))}
      </nav>

      <div
        style={{
          height: 1,
          background: "rgba(255,255,255,0.06)",
          margin: "0 6px",
        }}
      />

      <nav
        aria-label="utility"
        style={{ display: "flex", flexDirection: "column", gap: 2 }}
      >
        {utilityForUser.map((it) => (
          <SidebarLink key={it.href} item={it} active={isActive(it.href, location)} />
        ))}
      </nav>

      {/* Растягивающийся спейсер — чтобы юзер-блок прилип ко дну. */}
      <div style={{ flex: 1 }} />

      {user && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            padding: "12px 8px 4px",
            borderTop: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {trialActive && (
            <Link href="/pricing">
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  alignSelf: "flex-start",
                  padding: "4px 10px",
                  borderRadius: 9999,
                  background: "rgba(212,168,67,0.14)",
                  color: "var(--brand-gold)",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 0.6,
                  textTransform: "uppercase",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                Триал · {trialDaysLeft} {ruDays(trialDaysLeft)}
              </span>
            </Link>
          )}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              minWidth: 0,
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 9999,
                background: "rgba(212,168,67,0.16)",
                color: "var(--brand-gold)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {(user.name || user.email).slice(0, 1).toUpperCase()}
            </div>
            <div
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: 12,
                color: "var(--brand-platinum)",
                lineHeight: 1.2,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={user.email}
            >
              {user.name || user.email}
            </div>
            <button
              onClick={signOut}
              title="Выйти"
              style={{
                width: 28,
                height: 28,
                background: "transparent",
                border: 0,
                color: "var(--muted-foreground)",
                cursor: "pointer",
                borderRadius: 9999,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}

function ruDays(n: number): string {
  const m = n % 10;
  const m100 = n % 100;
  if (m === 1 && m100 !== 11) return "день";
  if ([2, 3, 4].includes(m) && ![12, 13, 14].includes(m100)) return "дня";
  return "дней";
}
