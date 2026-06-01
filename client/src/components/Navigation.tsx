import { Link, useLocation } from "wouter";
import {
  BarChart3, BookOpen, Sparkles, Calendar, Library, KeyRound,
  TrendingUp, Image as ImageIcon, Link2, Layers, LogOut, MessageCircle, CreditCard,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

/* Главная нав-полоса.
   Desktop: логотип слева, primary по центру (воронка создания контента),
   utility справа иконками. iPhone: логотип сверху, ниже горизонтальный
   скролл-стрип со всеми разделами. Размеры тапов ≥ 40×40.

   Порядок primary = реальный путь пользователя:
   Идеи (витрина тем) → Студия (генерация) → План (расписание+архив,
   объединённый раздел с табами) → Аналитика (что сработало).
   Реже используемое (тренды, медиа, интеграции, настройки) — в utility. */
const primary = [
  { href: "/", label: "Идеи", icon: BookOpen },
  { href: "/generator", label: "Студия", icon: Sparkles },
  { href: "/carousel", label: "Карусели", icon: Layers },
  { href: "/plan", label: "План", icon: Calendar },
  { href: "/analytics", label: "Аналитика", icon: BarChart3 },
];

const utility = [
  { href: "/trends", label: "Тренды", icon: TrendingUp },
  { href: "/media", label: "Медиа", icon: ImageIcon },
  { href: "/integrations", label: "Интеграции", icon: Link2 },
  { href: "/voice", label: "Голос", icon: MessageCircle },
  { href: "/pricing", label: "Тариф", icon: CreditCard },
  { href: "/settings", label: "Настройки", icon: KeyRound },
];

type Item = { href: string; label: string; icon: typeof BookOpen };

/* /plan — обёртка над Календарём и Архивом; ему «принадлежат» и
   старые маршруты /calendar и /library (оставлены для закладок). */
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
  const { user, signOut } = useAuth();
  const all = [...primary, ...utility];

  const trialDaysLeft = user
    ? Math.max(
        0,
        Math.ceil((user.trialEndsAt - Date.now()) / (24 * 60 * 60 * 1000)),
      )
    : 0;
  const trialActive = user?.plan === "trial" && trialDaysLeft > 0;

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
            Content Studio<span style={{ color: "var(--brand-gold)" }}>.</span>
          </span>
        </Link>
        <ul
          className="flex flex-1 items-center justify-center"
          style={{ listStyle: "none", gap: 4, margin: 0, padding: 0 }}
        >
          {primary.map((it) => (
            <li key={it.href}>
              <NavChip item={it} active={isActive(it.href, location)} />
            </li>
          ))}
        </ul>
        <ul
          className="flex items-center"
          style={{ listStyle: "none", gap: 2, margin: 0, padding: 0 }}
        >
          {trialActive && (
            <li>
              <Link href="/pricing">
                <span style={trialBadgeStyle} title="Триал-статус">
                  Триал · {trialDaysLeft} {ruDays(trialDaysLeft)}
                </span>
              </Link>
            </li>
          )}
          {utility.map((it) => (
            <li key={it.href}>
              <NavChip item={it} active={isActive(it.href, location)} iconOnly />
            </li>
          ))}
          {user && (
            <li>
              <button
                onClick={signOut}
                title={`Выйти (${user.email})`}
                style={iconBtnStyle}
              >
                <LogOut className="w-4 h-4" />
              </button>
            </li>
          )}
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
              <NavChip item={it} active={isActive(it.href, location)} />
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

const trialBadgeStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "5px 12px",
  borderRadius: 9999,
  background: "rgba(212,168,67,0.14)",
  color: "var(--brand-gold)",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 0.6,
  textTransform: "uppercase",
  cursor: "pointer",
  marginRight: 6,
  whiteSpace: "nowrap",
};

const iconBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 36,
  height: 36,
  borderRadius: 9999,
  background: "transparent",
  border: 0,
  color: "var(--brand-platinum)",
  cursor: "pointer",
  marginLeft: 4,
};

function ruDays(n: number): string {
  const m = n % 10;
  const m100 = n % 100;
  if (m === 1 && m100 !== 11) return "день";
  if ([2, 3, 4].includes(m) && ![12, 13, 14].includes(m100)) return "дня";
  return "дней";
}
