import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { AuthLayout } from "./SignUp";

/* /verify-email?token=... — обработчик ссылки из письма. Сразу шлёт
   auth.verifyEmail и показывает результат. Если юзер залогинен,
   контекст auth.me инвалидируется, чтобы баннер исчез. */
export default function VerifyEmail() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const verify = trpc.auth.verifyEmail.useMutation();
  const [phase, setPhase] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState("");
  const [alreadyVerified, setAlreadyVerified] = useState(false);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setPhase("error");
      setMessage("В ссылке нет токена.");
      return;
    }
    verify
      .mutateAsync({ token })
      .then((r) => {
        setPhase("ok");
        setAlreadyVerified(!!r.alreadyVerified);
        utils.auth.me.invalidate();
      })
      .catch((e) => {
        setPhase("error");
        setMessage(e instanceof Error ? e.message : "Не удалось подтвердить");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (phase === "loading") {
    return (
      <AuthLayout title="Подтверждаем email...">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            color: "var(--brand-platinum)",
            fontSize: 14,
            padding: "12px 0",
          }}
        >
          <Loader2 className="w-4 h-4 animate-spin" />
          Минутку...
        </div>
      </AuthLayout>
    );
  }

  if (phase === "ok") {
    return (
      <AuthLayout
        title={alreadyVerified ? "Email уже подтверждён" : "Готово!"}
        subtitle={
          alreadyVerified
            ? "Этот email был подтверждён ранее. Можно пользоваться сервисом."
            : "Спасибо. Аккаунт активирован — можно пользоваться без ограничений."
        }
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            color: "var(--brand-gold)",
            fontSize: 14,
            marginBottom: 18,
          }}
        >
          <CheckCircle2 className="w-5 h-5" />
          Подтверждение получено
        </div>
        <button
          onClick={() => navigate("/")}
          className="btn-gold"
          style={{ padding: "12px 22px", fontSize: 14 }}
        >
          На главную
        </button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Не получилось" subtitle={message}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          color: "#f87171",
          fontSize: 14,
          marginBottom: 18,
        }}
      >
        <AlertCircle className="w-5 h-5" />
        Ссылка недействительна или истекла
      </div>
      <div
        style={{
          display: "flex",
          gap: 8,
          fontSize: 13,
          color: "var(--muted-foreground)",
        }}
      >
        <Link href="/">
          <span style={{ color: "var(--brand-gold)", textDecoration: "underline", cursor: "pointer" }}>
            На главную
          </span>
        </Link>
        <span>—</span>
        <span>там можно запросить новое письмо.</span>
      </div>
    </AuthLayout>
  );
}
