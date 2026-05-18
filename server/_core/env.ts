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
};
