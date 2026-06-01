/**
 * tRPC контекст для Cloudflare Worker (multi-user).
 *
 * Юзер кладётся в ctx из JWT, прочитанного из HTTP-only cookie.
 * Старая реализация (sdk.authenticateRequest через express + MySQL)
 * не применима — заменена.
 *
 * Тип AuthUser совпадает по форме с тем, что требует protectedProcedure
 * (см. server/_core/trpc.ts): поле role нужно для будущих admin-фич.
 */

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  plan: string;
  trialEndsAt: number;
  tokensRemaining: number;
  role: "user" | "admin";
};

export type TrpcContext = {
  /* Раньше тут были express req/res. На Worker не используются —
     оставлены unknown, чтобы старые роутеры не падали по types. */
  req: unknown;
  res: unknown;
  user: AuthUser | null;
  /* Cookies, которые tRPC adapter должен добавить в исходящий Response
     (для login/logout). Заполняется auth-роутером через push. */
  setCookies: string[];
};

/* Legacy createContext для manus dev-сервера (server/_core/index.ts).
   На Worker не используется — там собственная inline-реализация в
   worker/index.ts. */
export async function createContext(): Promise<TrpcContext> {
  return { req: null, res: null, user: null, setCookies: [] };
}
