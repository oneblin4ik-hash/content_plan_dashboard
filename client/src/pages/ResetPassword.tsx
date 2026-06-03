import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Loader2, Lock, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/AuthContext";
import { AuthLayout, AuthInput } from "./SignUp";

/* /reset-password?token=... — обработчик ссылки сброса. Один экран:
   ввод нового пароля → submit → серверный resetPassword проверяет
   токен, обновляет пароль и сразу логинит юзера (cookie ставится).
   После — redirect на главную. */
export default function ResetPassword() {
  const [, navigate] = useLocation();
  const { refresh } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const reset = trpc.auth.resetPassword.useMutation();

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("token");
    setToken(t);
  }, []);

  const passwordsMatch = password.length >= 8 && password === confirm;
  const canSubmit = !!token && passwordsMatch && !reset.isPending;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !token) return;
    try {
      await reset.mutateAsync({ token, password });
      await refresh();
      toast.success("Пароль обновлён. Ты залогинен.");
      navigate("/dashboard");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось сбросить пароль");
    }
  };

  if (token === null) {
    /* Ещё не прочитали URL — короткий тик. */
    return null;
  }
  if (!token) {
    return (
      <AuthLayout
        title="Нет токена"
        subtitle="В ссылке нет токена сброса. Открой ссылку из письма заново."
      >
        <div />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Новый пароль" subtitle="Минимум 8 символов.">
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 14 }}>
        <AuthInput
          icon={<Lock className="w-4 h-4" />}
          placeholder="новый пароль"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          required
        />
        <AuthInput
          icon={<Lock className="w-4 h-4" />}
          placeholder="ещё раз — для подтверждения"
          type="password"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          required
        />
        {confirm.length > 0 && password !== confirm && (
          <div style={{ fontSize: 12, color: "#f87171" }}>
            Пароли не совпадают
          </div>
        )}
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
          {reset.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Сохраняем...
            </>
          ) : (
            <>
              Установить пароль <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </AuthLayout>
  );
}
