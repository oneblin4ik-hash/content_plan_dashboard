export type Env = {
  DB: D1Database;
  ASSETS: Fetcher;
  /** Secrets — set with `wrangler secret put`, never committed. */
  STUDIO_PASSPHRASE?: string;
  AUTH_SECRET?: string;
  GEMINI_API_KEY?: string;
  DEEPSEEK_API_KEY?: string;
  OPENAI_API_KEY?: string;
  /** Vars from wrangler.jsonc. */
  LLM_PROVIDER?: string;
  LLM_MODEL?: string;
  DAILY_GENERATION_LIMIT?: string;
};

export function dailyLimit(env: Env): number {
  const parsed = Number.parseInt(env.DAILY_GENERATION_LIMIT ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 20;
}
