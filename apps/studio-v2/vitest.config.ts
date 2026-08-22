import { defineConfig } from "vitest/config";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { fileURLToPath } from "node:url";

const migrations = await readD1Migrations(
  fileURLToPath(new URL("./db/migrations", import.meta.url)),
);

export default defineConfig({
  plugins: [
    cloudflareTest({
      // Tests exercise the worker against a real local D1, not a stub.
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        compatibilityFlags: ["nodejs_compat"],
        bindings: {
          STUDIO_PASSPHRASE: "test-pass",
          AUTH_SECRET: "test-secret",
          DAILY_GENERATION_LIMIT: "3",
          TEST_MIGRATIONS: migrations,
        },
      },
    }),
  ],
  resolve: {
    alias: {
      "@shared": fileURLToPath(new URL("./shared", import.meta.url)),
      "@db": fileURLToPath(new URL("./db", import.meta.url)),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    globalSetup: ["./tests/global-setup.ts"],
  },
});
