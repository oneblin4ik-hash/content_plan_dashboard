import { ENV } from "./env";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?: "audio/mpeg" | "audio/wav" | "application/pdf" | "audio/mp4" | "video/mp4" ;
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type ToolChoicePrimitive = "none" | "auto" | "required";
export type ToolChoiceByName = { name: string };
export type ToolChoiceExplicit = {
  type: "function";
  function: {
    name: string;
  };
};

export type ToolChoice =
  | ToolChoicePrimitive
  | ToolChoiceByName
  | ToolChoiceExplicit;

export type InvokeParams = {
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<TextContent | ImageContent | FileContent>;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type OutputSchema = JsonSchema;

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

const ensureArray = (
  value: MessageContent | MessageContent[]
): MessageContent[] => (Array.isArray(value) ? value : [value]);

const normalizeContentPart = (
  part: MessageContent
): TextContent | ImageContent | FileContent => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }

  if (part.type === "text") {
    return part;
  }

  if (part.type === "image_url") {
    return part;
  }

  if (part.type === "file_url") {
    return part;
  }

  throw new Error("Unsupported message content part");
};

const normalizeMessage = (message: Message) => {
  const { role, name, tool_call_id } = message;

  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content)
      .map(part => (typeof part === "string" ? part : JSON.stringify(part)))
      .join("\n");

    return {
      role,
      name,
      tool_call_id,
      content,
    };
  }

  const contentParts = ensureArray(message.content).map(normalizeContentPart);

  // If there's only text content, collapse to a single string for compatibility
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return {
      role,
      name,
      content: contentParts[0].text,
    };
  }

  return {
    role,
    name,
    content: contentParts,
  };
};

const normalizeToolChoice = (
  toolChoice: ToolChoice | undefined,
  tools: Tool[] | undefined
): "none" | "auto" | ToolChoiceExplicit | undefined => {
  if (!toolChoice) return undefined;

  if (toolChoice === "none" || toolChoice === "auto") {
    return toolChoice;
  }

  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error(
        "tool_choice 'required' was provided but no tools were configured"
      );
    }

    if (tools.length > 1) {
      throw new Error(
        "tool_choice 'required' needs a single tool or specify the tool name explicitly"
      );
    }

    return {
      type: "function",
      function: { name: tools[0].function.name },
    };
  }

  if ("name" in toolChoice) {
    return {
      type: "function",
      function: { name: toolChoice.name },
    };
  }

  return toolChoice;
};

type LLMRoute = {
  url: string;
  apiKey: string;
  model: string;
  /** Резервная модель, на которую переключаемся при стойких 429/503. */
  fallbackModel?: string;
  /** Gemini 3.x thinking-бюджет (none|low|medium|high), если задан. */
  reasoningEffort?: string;
  isForge?: boolean;
};

const resolveRoute = (): LLMRoute => {
  if (ENV.forgeApiKey) {
    const base =
      ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0
        ? ENV.forgeApiUrl.replace(/\/$/, "")
        : "https://forge.manus.im";
    return {
      url: `${base}/v1/chat/completions`,
      apiKey: ENV.forgeApiKey,
      model: "gemini-2.5-flash",
      isForge: true,
    };
  }
  if (ENV.geminiApiKey) {
    return {
      url: `${ENV.geminiApiUrl.replace(/\/$/, "")}/chat/completions`,
      apiKey: ENV.geminiApiKey,
      model: ENV.geminiModel,
      fallbackModel: ENV.geminiFallbackModel,
      reasoningEffort: ENV.geminiReasoningEffort || undefined,
    };
  }
  throw new Error(
    "LLM is not configured. Set BUILT_IN_FORGE_API_KEY or GEMINI_API_KEY."
  );
};

/** Транзиентные статусы Gemini/OpenAI: перегрузка и rate-limit. */
const TRANSIENT_STATUSES = new Set([429, 500, 502, 503, 504]);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ── Quota-кэш основной модели ─────────────────────────────────
   Когда дневная квота gemini-3.5-flash исчерпана (429 +
   RESOURCE_EXHAUSTED), нет смысла бить в неё каждым следующим
   запросом — это лишние ~300-600мс задержки и пустой subrequest.
   Ставим isolate-локальный флаг на 10 минут: пока он активен,
   invokeLLM начинает сразу с резервной модели. Через 10 минут
   снова пробуем основную — так после сброса квоты (или спада
   нагрузки) возврат на 3.5 происходит автоматически.

   Храним в globalThis, потому что модульный scope в Workers может
   пересоздаваться реже, чем хочется для чистоты, а точность тут
   не критична: кэш — оптимизация задержки, не источник истины. */
const QUOTA_BACKOFF_MS = 10 * 60 * 1000;

function isPrimaryQuotaExhausted(): boolean {
  const until = (globalThis as Record<string, unknown>)
    .__llm_quota_exhausted_until as number | undefined;
  return typeof until === "number" && Date.now() < until;
}

function markPrimaryQuotaExhausted(): void {
  (globalThis as Record<string, unknown>).__llm_quota_exhausted_until =
    Date.now() + QUOTA_BACKOFF_MS;
  console.warn(
    `[llm] primary model quota exhausted — переключаюсь на fallback на ${QUOTA_BACKOFF_MS / 60000} мин`,
  );
}


const normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema,
}: {
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
}):
  | { type: "json_schema"; json_schema: JsonSchema }
  | { type: "text" }
  | { type: "json_object" }
  | undefined => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (
      explicitFormat.type === "json_schema" &&
      !explicitFormat.json_schema?.schema
    ) {
      throw new Error(
        "responseFormat json_schema requires a defined schema object"
      );
    }
    return explicitFormat;
  }

  const schema = outputSchema || output_schema;
  if (!schema) return undefined;

  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }

  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...(typeof schema.strict === "boolean" ? { strict: schema.strict } : {}),
    },
  };
};

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  const route = resolveRoute();

  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format,
  } = params;

  const payload: Record<string, unknown> = {
    model: route.model,
    messages: messages.map(normalizeMessage),
  };

  if (tools && tools.length > 0) {
    payload.tools = tools;
  }

  const normalizedToolChoice = normalizeToolChoice(
    toolChoice || tool_choice,
    tools
  );
  if (normalizedToolChoice) {
    payload.tool_choice = normalizedToolChoice;
  }

  payload.max_tokens = 32768
  if (route.isForge) {
    payload.thinking = { budget_tokens: 128 };
  } else if (route.reasoningEffort) {
    // Gemini 3.x через OpenAI-compat: управляем глубиной thinking.
    payload.reasoning_effort = route.reasoningEffort;
  }

  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema,
  });

  if (normalizedResponseFormat) {
    payload.response_format = normalizedResponseFormat;
  }

  /* Новые preview-модели (gemini-3.5-flash) спайково отдают 429/503
     «high demand». Чтобы генерация не падала у пользователя:
       1) ретраим транзиентные ошибки с экспоненциальным backoff;
       2) если основная модель так и не ответила — один заход на
          резервную (gemini-2.5-flash), которая стабильна.
     На неретраебельных ошибках (400/401/404) падаем сразу.

     Если по недавнему запросу известно, что квота основной модели
     исчерпана (quota-кэш, TTL 10 мин) — не мучаем её, начинаем
     сразу с резервной. Приоритет 3.5 возвращается автоматически
     после истечения TTL. */
  const hasFallback =
    !!route.fallbackModel && route.fallbackModel !== route.model;
  const models =
    hasFallback && isPrimaryQuotaExhausted()
      ? [route.fallbackModel as string]
      : hasFallback
        ? [route.model, route.fallbackModel as string]
        : [route.model];

  let lastError = "";
  for (let mi = 0; mi < models.length; mi++) {
    const model = models[mi];
    const isLastModel = mi === models.length - 1;
    // На основной модели — больше попыток; на резервной — меньше,
    // чтобы суммарная задержка не упёрлась в таймаут Telegram-вебхука.
    const maxAttempts = isLastModel ? 2 : 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const response = await fetch(route.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${route.apiKey}`,
        },
        body: JSON.stringify({ ...payload, model }),
      });

      if (response.ok) {
        return (await response.json()) as InvokeResult;
      }

      const errorText = await response.text();
      lastError = `${response.status} ${response.statusText} – ${errorText}`;

      const transient = TRANSIENT_STATUSES.has(response.status);
      if (!transient) {
        // Постоянная ошибка (плохой запрос/ключ/модель) — нет смысла
        // ни ретраить, ни переключать модель.
        throw new Error(`LLM invoke failed: ${lastError}`);
      }

      // 429 с пометкой RESOURCE_EXHAUSTED — это daily quota free-tier'а
      // AI Studio (gemini-3.5-flash = 20 RPD). Ретраи внутри суток
      // бесполезны: только тратим время пользователя. Сразу переходим
      // к резервной модели и запоминаем в quota-кэше, чтобы следующие
      // запросы не бились в исчерпанную модель.
      const isQuotaExhausted =
        response.status === 429 && /RESOURCE_EXHAUSTED/i.test(errorText);
      if (isQuotaExhausted) {
        if (model === route.model && hasFallback) {
          markPrimaryQuotaExhausted();
        }
        break; // выходим из цикла попыток, идём к следующей модели
      }

      // Есть ещё попытки на этой модели — ждём и повторяем.
      if (attempt < maxAttempts) {
        await sleep(500 * 2 ** (attempt - 1)); // 0.5s, 1s
      }
    }
    // Модель исчерпала попытки — переходим к следующей (резервной).
  }

  throw new Error(
    `LLM invoke failed after retries (${models.join(" → ")}): ${lastError}`
  );
}
