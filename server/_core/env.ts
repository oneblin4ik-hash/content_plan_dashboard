export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  // Optional direct Gemini fallback. If GEMINI_API_KEY is set and there is no
  // Forge key, the LLM layer calls Gemini's OpenAI-compatible endpoint
  // directly. Useful for Cloudflare / DIY deployments.
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  geminiApiUrl:
    process.env.GEMINI_API_URL ??
    "https://generativelanguage.googleapis.com/v1beta/openai",
  // Primary content model. Default = Gemini 3.5 Flash (заметно выше качество
  // постов/сценариев, чем 2.5). Переопределяется через GEMINI_MODEL.
  geminiModel: process.env.GEMINI_MODEL ?? "gemini-3.5-flash",
  // Резервная модель на случай 429/503 (новые preview-модели спайково
  // перегружены). 2.5-flash стабильна и всё ещё хороша.
  geminiFallbackModel: process.env.GEMINI_FALLBACK_MODEL ?? "gemini-2.5-flash",
  // Опциональный thinking-бюджет для Gemini 3.x через OpenAI-compat
  // (none|low|medium|high). Пусто = динамический thinking = макс. качество.
  geminiReasoningEffort: process.env.GEMINI_REASONING_EFFORT ?? "",
};
