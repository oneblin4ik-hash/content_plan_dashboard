import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Loader2, Mail, Lock, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/AuthContext";
import { AuthLayout, AuthInput } from "./SignUp";

export default function SignIn() {
  const [, navigate] = useLocation();
  const { refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const login = trpc.auth.login.useMutation();
  const canSubmit =
    email.trim().length >= 5 && password.length >= 1 && !login.isPending;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    try {
      await login.mutateAsync({ email: email.trim(), password });
      await refresh();
      navigate("/");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось войти");
    }
  };

  return (
    <AuthLayout title="Войти" subtitle="С возвращением.">
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
        <AuthInput
          icon={<Lock className="w-4 h-4" />}
          placeholder="пароль"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          required
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
          {login.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Входим...
            </>
          ) : (
            <>
              Войти <ArrowRight className="w-4 h-4" />
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
          Ещё нет аккаунта?{" "}
          <Link href="/signup">
            <span
              style={{
                color: "var(--brand-gold)",
                textDecoration: "underline",
                cursor: "pointer",
              }}
            >
              Зарегистрироваться
            </span>
          </Link>
        </div>
      </form>
    </AuthLayout>
  );
}
