import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { LoaderCircle, LockKeyhole } from "lucide-react";
import ContentStudioApp from "./pages/ContentStudioApp";

export default function App() {
  const { user, loading } = useAuth();

  if (loading) return <div className="auth-screen"><LoaderCircle className="spin" size={28} /><span>Открываю твою студию…</span></div>;
  if (!user) return <div className="auth-screen"><LockKeyhole size={28} /><h1>Content Studio</h1><p>Это закрытая рабочая система. Войди через свой аккаунт Manus, чтобы продолжить.</p><button className="button-primary" onClick={() => { window.location.href = getLoginUrl(); }}>Войти в студию</button></div>;
  if (user.role !== "admin") return <div className="auth-screen"><LockKeyhole size={28} /><h1>Доступ закрыт</h1><p>Эта версия Content Studio доступна только владельцу проекта.</p></div>;
  return <ContentStudioApp userName={user.name || "Эдуард Серболин"} />;
}
