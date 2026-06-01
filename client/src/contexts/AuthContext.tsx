import {
  createContext,
  useCallback,
  useContext,
  useMemo,
} from "react";
import { trpc } from "@/lib/trpc";

/* ============================================================
   AuthContext — глобальное состояние юзера (email/имя/триал/токены).
   Источник истины: trpc.auth.me (читает JWT из HTTP-only cookie на
   каждый запрос). Стейт хранится в react-query, cookie ставит сервер
   на /register и /login. На клиенте никаких токенов руками не
   трогаем.
   ============================================================ */

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  plan: string;
  trialEndsAt: number;
  tokensRemaining: number;
};

type Ctx = {
  user: AuthUser | null;
  ready: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const utils = trpc.useUtils();
  const meQuery = trpc.auth.me.useQuery(undefined, {
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
  const logoutMutation = trpc.auth.logout.useMutation();

  const refresh = useCallback(async () => {
    await utils.auth.me.invalidate();
  }, [utils]);

  const signOut = useCallback(async () => {
    await logoutMutation.mutateAsync();
    await utils.auth.me.invalidate();
    /* Полная перезагрузка, чтобы сбросить весь react-query кэш и не
       показать чужие данные после смены пользователя. */
    window.location.href = "/signin";
  }, [logoutMutation, utils]);

  const value = useMemo<Ctx>(
    () => ({
      user: meQuery.data ?? null,
      ready: !meQuery.isLoading,
      refresh,
      signOut,
    }),
    [meQuery.data, meQuery.isLoading, refresh, signOut],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
