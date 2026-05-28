import { publicProcedure, router } from "../server/_core/trpc";
import { systemRouter } from "../server/_core/systemRouter";
import { contentRouter } from "../server/routers/content";
import { telegramRouter } from "../server/routers/telegram";
import { syncRouter } from "../server/routers/sync";
import { trendsRouter } from "../server/routers/trends";
import { mediaRouter } from "../server/routers/media";
import { metricsRouter } from "../server/routers/metrics";
import { integrationsRouter } from "../server/routers/integrations";

export const appRouter = router({
  system: systemRouter,
  content: contentRouter,
  telegram: telegramRouter,
  sync: syncRouter,
  trends: trendsRouter,
  media: mediaRouter,
  metrics: metricsRouter,
  integrations: integrationsRouter,
  auth: router({
    me: publicProcedure.query(() => null),
    logout: publicProcedure.mutation(() => ({ success: true } as const)),
  }),
});

export type AppRouter = typeof appRouter;
