import { useState } from "react";
import { Link } from "wouter";
import { Loader2, Mail, ArrowRight, CheckCircle2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { AuthLayout, AuthInput } from "./SignUp";

/* /forgot-password — форма «забыл пароль». После отправки всегда
   показываем единое сообщение «если email есть, мы отправили письмо»
   независимо от существования юзера, чтобы не палить, какие email
   зарегистрированы. */
export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const forgot = trpc.auth.forgotPassword.useMutation();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim().length < 5 || forgot.isPending) return;
    await forgot.mutateAsync({ email: email.trim() });
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <AuthLayout
        title="Проверь почту"
        subtitle={`Если аккаунт с email ${email} существует, мы отправили ссылку для сброса пароля. Ссылка действует 1 час.`}
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
          Письмо в пути
        </div>
        <Link href="/signin">
          <span
            style={{
              color: "var(--brand-gold)",
              textDecoration: "underline",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            ← Вернуться ко входу
          </span>
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Забыл пароль?"
      subtitle="Введи email — пришлём ссылку для сброса."
    >
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 14 }}>
        <AuthInput
          icon={<Mail className="w-4 h-4" />}
          placeholder="email"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          required
        />
        <button
          type="submit"
          className="btn-gold"
          disabled={forgot.isPending}
          style={{
            justifyContent: "center",
            padding: "14px 22px",
            fontSize: 15,
            marginTop: 6,
          }}
        >
          {forgot.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Отправляем...
            </>
          ) : (
            <>
              Отправить ссылку <ArrowRight className="w-4 h-4" />
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
          Вспомнил?{" "}
          <Link href="/signin">
            <span
              style={{
                color: "var(--brand-gold)",
                textDecoration: "underline",
                cursor: "pointer",
              }}
            >
              Войти
            </span>
          </Link>
        </div>
      </form>
    </AuthLayout>
  );
}
