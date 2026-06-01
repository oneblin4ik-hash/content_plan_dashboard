import { router } from "../server/_core/trpc";
import { systemRouter } from "../server/_core/systemRouter";
import { contentRouter } from "../server/routers/content";
import { telegramRouter } from "../server/routers/telegram";
import { syncRouter } from "../server/routers/sync";
import { trendsRouter } from "../server/routers/trends";
import { mediaRouter } from "../server/routers/media";
import { metricsRouter } from "../server/routers/metrics";
import { integrationsRouter } from "../server/routers/integrations";
import { topicsRouter } from "../server/routers/topics";
import { competitorsRouter } from "../server/routers/competitors";
import { authRouter } from "../server/routers/auth";
import { voiceRouter } from "../server/routers/voice";
import { adminRouter } from "../server/routers/admin";

export const appRouter = router({
  system: systemRouter,
  content: contentRouter,
  telegram: telegramRouter,
  sync: syncRouter,
  trends: trendsRouter,
  media: mediaRouter,
  metrics: metricsRouter,
  integrations: integrationsRouter,
  topics: topicsRouter,
  competitors: competitorsRouter,
  auth: authRouter,
  voice: voiceRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
