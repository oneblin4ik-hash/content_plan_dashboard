import { LlmError } from "./index";

type Config = {
  apiKey: string | undefined;
  baseUrl: string;
  model: string;
  label: string;
};

/** DeepSeek and OpenAI share the same chat-completions contract. */
export async function callOpenAiCompatible(
  config: Config,
  system: string,
  user: string,
): Promise<string> {
  if (!config.apiKey) {
    throw new LlmError(`Ключ ${config.label} не настроен. Добавьте секрет и попробуйте снова.`);
  }

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (response.status === 429) {
    throw new LlmError(`${config.label}: лимит запросов исчерпан. Подождите и попробуйте снова.`);
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new LlmError(`${config.label} ответил ошибкой ${response.status}. ${detail.slice(0, 180)}`.trim());
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = payload.choices?.[0]?.message?.content ?? "";
  if (!text.trim()) throw new LlmError(`${config.label} вернул пустой ответ.`);
  return text;
}
