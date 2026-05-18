import { publicProcedure, router } from "../server/_core/trpc";
import { systemRouter } from "../server/_core/systemRouter";
import { contentRouter } from "../server/routers/content";
import { telegramRouter } from "../server/routers/telegram";
import { syncRouter } from "../server/routers/sync";

export const appRouter = router({
  system: systemRouter,
  content: contentRouter,
  telegram: telegramRouter,
  sync: syncRouter,
  auth: router({
    me: publicProcedure.query(() => null),
    logout: publicProcedure.mutation(() => ({ success: true } as const)),
  }),
});

export type AppRouter = typeof appRouter;
