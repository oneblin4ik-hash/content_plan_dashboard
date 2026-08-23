/**
 * Legacy серверный appRouter — для manus dev-сервера (server/_core/index.ts).
 * На Cloudflare Worker используется worker/router.ts. Содержание
 * идентично, чтобы оба пути собирались.
 */
export { appRouter, type AppRouter } from "../worker/router";
