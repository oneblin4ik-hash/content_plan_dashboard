import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";

export const contentRouter = router({
  generatePost: publicProcedure
    .input(
      z.object({
        title: z.string().min(5, "Заголовок должен быть минимум 5 символов"),
        tone: z.enum(["expert", "friend", "provocative"]).default("expert"),
        platform: z.enum(["telegram", "instagram"]).default("telegram"),
      })
    )
    .mutation(async ({ input }) => {
      const systemPrompt = `Ты профессиональный фитнес-тренер и блогер Эдуард Серболин. 
      Твой стиль: ${input.tone === "expert" ? "экспертный, авторитетный, с научным обоснованием" : input.tone === "friend" ? "дружеский, понимающий, эмпатичный" : "провокационный, вызывающий, триггерящий на эмоциях"}.
      Пиши без воды, канцеляризмов и клише. Используй инфостиль с драйвом.
      Для ${input.platform === "telegram" ? "Telegram" : "Instagram"}.`;

      const userPrompt = `Напиши полный готовый пост на основе заголовка: "${input.title}"
      
      Структура:
      1. Хук (первые 2-3 строки, цепляющие внимание)
      2. Основной контент (3-5 параграфов, максимум полезной информации)
      3. Call-to-Action (призыв к действию)
      
      Требования:
      - Объем: ${input.platform === "telegram" ? "500-800 слов" : "200-300 слов"}
      - Используй эмодзи умеренно (не более 3-4)
      - Добавь триггеры и боли целевой аудитории (девушки, которые хотят похудеть)
      - Заканчивай вопросом для engagement`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });

      const content = response.choices[0]?.message.content;
      if (!content) {
        throw new Error("Не удалось сгенерировать пост");
      }

      return {
        post: content,
        title: input.title,
        platform: input.platform,
        tone: input.tone,
      };
    }),

  generateReelsScript: publicProcedure
    .input(
      z.object({
        title: z.string().min(5, "Заголовок должен быть минимум 5 символов"),
        duration: z.enum(["15-30s", "30-60s"]).default("15-30s"),
      })
    )
    .mutation(async ({ input }) => {
      const systemPrompt = `Ты профессиональный фитнес-тренер Эдуард Серболин, создающий вирусные Reels для Instagram.
      Твой архетип: справедливый друг-эксперт, который понимает девушек и на их стороне.
      Тон: умеренно жёсткий, харизматичный, цепляющий на эмоциях и триггерах.`;

      const userPrompt = `Напиши полный сценарий для Reels на основе заголовка: "${input.title}"
      
      Структура сценария:
      1. ХУКА (0-3 сек): Самая цепляющая фраза, вызывающая боль или интерес
      2. ТЕЛО (3-${input.duration === "15-30s" ? "25" : "50"} сек): Основной контент, разоблачение мифа или совет
      3. ТРИГГЕР (${input.duration === "15-30s" ? "25-28" : "50-58"} сек): Эмоциональный пик, вызывающий действие
      4. CTA (последние 2-3 сек): Призыв к действию (подписка, лайк, комментарий, ссылка)
      
      Требования:
      - Язык: русский, простой и понятный
      - Тема: социальная несправедливость по отношению к женщинам в фитнесе
      - Вирусность: используй контраст, парадокс, провокацию
      - Визуальные подсказки: добавь в скобки [описание кадра] для видеографа
      
      Формат ответа:
      **ХУК:** [текст]
      **ТЕЛО:** [текст с временными метками]
      **ТРИГГЕР:** [текст]
      **CTA:** [текст]
      **ВИЗУАЛЬНЫЕ ПОДСКАЗКИ:** [описание кадров]`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });

      const content = response.choices[0]?.message.content;
      if (!content) {
        throw new Error("Не удалось сгенерировать сценарий");
      }

      return {
        script: content,
        title: input.title,
        duration: input.duration,
      };
    }),

  generateFullContent: publicProcedure
    .input(
      z.object({
        title: z.string().min(5),
        includePost: z.boolean().default(true),
        includeReelsScript: z.boolean().default(true),
      })
    )
    .mutation(async ({ input }) => {
      const results: Record<string, unknown> = { title: input.title };

      if (input.includePost) {
        const postResult = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `Ты профессиональный фитнес-тренер Эдуард Серболин. 
              Пиши без воды, канцеляризмов и клише. Используй инфостиль с драйвом.`,
            },
            {
              role: "user",
              content: `Напиши полный готовый пост для Telegram на основе: "${input.title}"
              
              Структура:
              1. Хук (2-3 строки)
              2. Основной контент (3-5 параграфов)
              3. CTA
              
              Объем: 500-800 слов. Используй эмодзи умеренно.`,
            },
          ],
        });

        results.post = postResult.choices[0]?.message.content || "";
      }

      if (input.includeReelsScript) {
        const reelsResult = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `Ты создаёшь вирусные Reels. Архетип: справедливый друг-эксперт.
              Тон: умеренно жёсткий, харизматичный, цепляющий.`,
            },
            {
              role: "user",
              content: `Напиши сценарий Reels (15-30 сек) на основе: "${input.title}"
              
              Формат:
              **ХУК:** [текст]
              **ТЕЛО:** [текст]
              **ТРИГГЕР:** [текст]
              **CTA:** [текст]
              **ВИЗУАЛЬНЫЕ ПОДСКАЗКИ:** [описание]`,
            },
          ],
        });

        results.reelsScript = reelsResult.choices[0]?.message.content || "";
      }

      return results;
    }),
});
