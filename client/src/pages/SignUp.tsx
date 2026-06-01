import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Loader2, Mail, Lock, User, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/AuthContext";

/* ============================================================
   Регистрация. Email + пароль + имя + два чекбокса согласия:
   - на обработку персональных данных (ФЗ-152, 152-ФЗ РФ)
   - с пользовательским соглашением
   Оба обязательные. Сервер тоже проверяет (zod literal(true)).
   После успеха — cookie ставится бэкендом, AuthContext инвалидируется,
   редирект на /.
   ============================================================ */
export default function SignUp() {
  const [, navigate] = useLocation();
  const { refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [consentPersonalData, setConsentPersonalData] = useState(false);
  const [consentTerms, setConsentTerms] = useState(false);

  const register = trpc.auth.register.useMutation();
  const canSubmit =
    email.trim().length >= 5 &&
    password.length >= 8 &&
    consentPersonalData &&
    consentTerms &&
    !register.isPending;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    try {
      await register.mutateAsync({
        email: email.trim(),
        password,
        name: name.trim() || undefined,
        consentPersonalData: true,
        consentTerms: true,
      });
      await refresh();
      toast.success("Аккаунт создан. Триал 3 дня активирован.");
      navigate("/");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось зарегистрироваться");
    }
  };

  return (
    <AuthLayout
      title="Создай аккаунт"
      subtitle="3 дня пробного периода и 30 000 токенов для теста."
    >
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 14 }}>
        <AuthInput
          icon={<User className="w-4 h-4" />}
          placeholder="Имя или название бренда (опционально)"
          value={name}
          onChange={setName}
          autoComplete="name"
        />
        <AuthInput
          icon={<Mail className="w-4 h-4" />}
          placeholder="email"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          required
        />
        <AuthInput
          icon={<Lock className="w-4 h-4" />}
          placeholder="пароль (минимум 8 символов)"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          required
        />

        <ConsentCheckbox
          checked={consentPersonalData}
          onChange={setConsentPersonalData}
          label={
            <>
              Согласен на обработку моих{" "}
              <Link href="/legal/personal-data">
                <span style={legalLink}>персональных данных</span>
              </Link>{" "}
              в соответствии с 152-ФЗ
            </>
          }
        />
        <ConsentCheckbox
          checked={consentTerms}
          onChange={setConsentTerms}
          label={
            <>
              Принимаю{" "}
              <Link href="/legal/terms">
                <span style={legalLink}>пользовательское соглашение</span>
              </Link>{" "}
              и{" "}
              <Link href="/legal/privacy">
                <span style={legalLink}>политику конфиденциальности</span>
              </Link>
            </>
          }
        />

        <button
          type="submit"
          className="btn-gold"
          disabled={!canSubmit}
          style={{
            justifyContent: "center",
            padding: "14px 22px",
            fontSize: 15,
            marginTop: 6,
          }}
        >
          {register.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Создаём аккаунт...
            </>
          ) : (
            <>
              Зарегистрироваться <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>

        <div
          style={{
            textAlign: "center",
            fontSize: 13,
            color: "var(--muted-foreground)",
            marginTop: 8,
          }}
        >
          Уже есть аккаунт?{" "}
          <Link href="/signin">
            <span style={legalLink}>Войти</span>
          </Link>
        </div>
      </form>
    </AuthLayout>
  );
}

/* ─── мелкие визуальные хелперы (используются и в SignIn) ─── */

export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="min-h-screen"
      style={{
        background: "var(--background)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        className="bento-card"
        style={{ width: "100%", maxWidth: 460, padding: 32 }}
      >
        <div className="eyebrow" style={{ marginBottom: 8 }}>
          Content Studio
        </div>
        <h1
          style={{
            fontSize: 32,
            letterSpacing: "-0.6px",
            marginBottom: 8,
            lineHeight: 1.15,
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            className="text-platinum"
            style={{
              fontSize: 14,
              lineHeight: 1.5,
              marginBottom: 24,
            }}
          >
            {subtitle}
          </p>
        )}
        {children}
      </div>
    </div>
  );
}

export function AuthInput({
  icon,
  placeholder,
  value,
  onChange,
  type = "text",
  required,
  autoComplete,
}: {
  icon: React.ReactNode;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  autoComplete?: string;
}) {
  return (
    <label style={{ position: "relative" }}>
      <span
        style={{
          position: "absolute",
          left: 14,
          top: 14,
          color: "var(--muted-foreground)",
        }}
      >
        {icon}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        style={{
          width: "100%",
          height: 46,
          padding: "0 16px 0 42px",
          background: "var(--ink-3)",
          color: "#fff",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 12,
          fontSize: 14,
          fontFamily: "var(--font-body)",
        }}
      />
    </label>
  );
}

function ConsentCheckbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: React.ReactNode;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        cursor: "pointer",
        fontSize: 12,
        lineHeight: 1.5,
        color: "var(--brand-platinum)",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{
          width: 16,
          height: 16,
          marginTop: 2,
          accentColor: "var(--brand-gold)",
          flexShrink: 0,
          cursor: "pointer",
        }}
      />
      <span>{label}</span>
    </label>
  );
}

const legalLink: React.CSSProperties = {
  color: "var(--brand-gold)",
  textDecoration: "underline",
  cursor: "pointer",
};
