import { useState } from "react";
import { Mail, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/AuthContext";

/* Баннер «подтверди email». Показывается под навигацией, пока юзер
   не подтвердил email. Хранит «закрыто» в sessionStorage, чтобы не
   мозолил глаза в рамках одной сессии, но возвращался после
   перезагрузки — это давит, но не агрессивно. */
const DISMISS_KEY = "cs.verify_email_dismissed";

export default function VerifyEmailBanner() {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem(DISMISS_KEY) === "1",
  );
  const resend = trpc.auth.resendVerification.useMutation({
    onSuccess: () => toast.success("Письмо отправлено повторно"),
    onError: (e) => toast.error(e.message),
  });

  if (!user || user.emailVerified || dismissed) return null;

  return (
    <div
      style={{
        background:
          "linear-gradient(180deg, rgba(212,168,67,0.16), rgba(212,168,67,0.06))",
        borderBottom: "1px solid rgba(212,168,67,0.24)",
        padding: "10px 0",
      }}
    >
      <div
        className="container"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          fontSize: 13,
          color: "var(--brand-platinum)",
        }}
      >
        <Mail
          className="w-4 h-4"
          style={{ color: "var(--brand-gold)", flexShrink: 0 }}
        />
        <div style={{ flex: 1 }}>
          Подтверди email{" "}
          <span style={{ color: "#fff", fontWeight: 600 }}>{user.email}</span>{" "}
          — мы отправили ссылку на почту.
        </div>
        <button
          onClick={() => resend.mutate()}
          disabled={resend.isPending}
          style={{
            padding: "6px 14px",
            background: "rgba(212,168,67,0.18)",
            color: "var(--brand-gold)",
            border: "1px solid rgba(212,168,67,0.4)",
            borderRadius: 9999,
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {resend.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Отправить заново
        </button>
        <button
          onClick={() => {
            sessionStorage.setItem(DISMISS_KEY, "1");
            setDismissed(true);
          }}
          title="Скрыть до конца сессии"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 28,
            height: 28,
            background: "transparent",
            border: 0,
            color: "var(--muted-foreground)",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
