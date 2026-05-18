# Cloudflare deployment — Content Studio (Mr. Serbolin)

This document describes how to move the project off the Manus runtime and host
the database on Cloudflare D1 (and, optionally, the worker on Cloudflare
Workers). The application's current home — `https://contentdash-ekouexxn.manus.space/` —
is a Manus deployment and is updated through the Manus platform, not this repo.

## 1. Database — Cloudflare D1

Schema lives in `drizzle/schema.d1.ts` (separate from the MySQL `schema.ts`).

```bash
# Create the D1 database
npx wrangler d1 create content-studio
# → copy the database_id it prints

# Generate SQL from the D1 schema (after adding drizzle.d1.config.ts)
npx drizzle-kit generate --config=drizzle.d1.config.ts

# Apply migrations
npx wrangler d1 migrations apply content-studio
```

A minimal `wrangler.toml`:

```toml
name = "content-studio"
main = "dist/index.js"
compatibility_date = "2026-01-01"

[[d1_databases]]
binding   = "DB"
database_name = "content-studio"
database_id   = "<paste-here>"

[vars]
# put non-secret config here. Use `wrangler secret put` for secrets.
```

Set secrets:

```bash
wrangler secret put BUILT_IN_FORGE_API_KEY     # used by server/_core/llm.ts
wrangler secret put GEMINI_API_KEY             # optional direct Gemini fallback
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put TELEGRAM_CHAT_ID
```

## 2. LLM — Gemini 2.5 Flash

`server/_core/llm.ts` already calls **Gemini 2.5 Flash** through the Forge
OpenAI-compatible proxy (`https://forge.manus.im/v1/chat/completions`,
`model: "gemini-2.5-flash"`). On Cloudflare you have two options:

- **Keep Forge** if you have a Forge API key — set `BUILT_IN_FORGE_API_KEY`.
- **Direct Gemini** — set `GEMINI_API_KEY` and switch the URL to
  `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`
  (Gemini's OpenAI-compatible endpoint). The request payload is identical;
  just swap the host and auth header in `resolveApiUrl` / `assertApiKey`.

A free DeepSeek alternative also works through its OpenAI-compatible endpoint
at `https://api.deepseek.com/v1/chat/completions` with model `deepseek-chat`.

## 3. Frontend

The Vite/React frontend is static and can be hosted as Cloudflare Pages or as
the Worker's static assets. Build:

```bash
pnpm install
pnpm build      # produces dist/ with both client and server bundles
```

Point Pages at the `dist/` (client) and Workers at `dist/index.js` (server).

## 4. What `https://contentdash-ekouexxn.manus.space/` is

That URL is a snapshot deployment of an earlier build hosted on Manus's own
infrastructure. Pushing to this repo does not automatically update it — that
deployment is republished from the Manus platform. To update the public URL,
either republish through Manus or replace it with the Cloudflare URL once the
steps above are complete.
