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
    mime_type?: "audio/mpeg" | "audio/wav" | "application/pdf" | "audio/mp4" | "video/mp4";
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

export type ToolChoice = ToolChoicePrimitive | ToolChoiceByName | ToolChoiceExplicit;

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

type GeminiPart =
  | { text: string }
  | {
      inlineData: {
        mimeType: string;
        data: string;
      };
    };

type GeminiContent = {
  role: "user" | "model";
  parts: GeminiPart[];
};

type GeminiSystemInstruction = {
  parts: GeminiPart[];
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      role?: string;
      parts?: Array<{
        text?: string;
      }>;
    };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
};

const ensureArray = (value: MessageContent | MessageContent[]): MessageContent[] =>
  Array.isArray(value) ? value : [value];

const normalizeContentPart = (part: MessageContent): TextContent | ImageContent | FileContent => {
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
      .map((part) => (typeof part === "string" ? part : JSON.stringify(part)))
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

const extractBase64Image = (url: string): { mimeType: string; data: string } => {
  const dataUrlMatch = url.match(/^data:(.+?);base64,(.+)$/);
  if (dataUrlMatch) {
    return {
      mimeType: dataUrlMatch[1],
      data: dataUrlMatch[2],
    };
  }

  const base64Match = url.match(/^base64,(.+)$/);
  if (base64Match) {
    return {
      mimeType: "image/jpeg",
      data: base64Match[1],
    };
  }

  return {
    mimeType: "image/jpeg",
    data: url,
  };
};

const normalizeGeminiParts = (content: MessageContent | MessageContent[]): GeminiPart[] => {
  const parts = ensureArray(content).map(normalizeContentPart);

  return parts.map((part) => {
    if (part.type === "text") {
      return { text: part.text };
    }

    if (part.type === "image_url") {
      const { mimeType, data } = extractBase64Image(part.image_url.url);
      return {
        inlineData: {
          mimeType,
          data,
        },
      };
    }

    throw new Error("Unsupported Gemini content part");
  });
};

const normalizeGeminiMessage = (message: Message): GeminiContent => {
  const role = message.role === "assistant" ? "model" : "user";
  return {
    role,
    parts: normalizeGeminiParts(message.content),
  };
};

const splitGeminiMessages = (
  messages: Message[],
): { systemInstruction?: GeminiSystemInstruction; contents: GeminiContent[] } => {
  const systemParts: GeminiPart[] = [];
  const contents: GeminiContent[] = [];

  for (const message of messages) {
    if (message.role === "system") {
      systemParts.push(...normalizeGeminiParts(message.content));
      continue;
    }

    if (message.role === "tool" || message.role === "function") {
      const serialized = ensureArray(message.content)
        .map((part) => (typeof part === "string" ? part : JSON.stringify(part)))
        .join("\n");
      contents.push({
        role: "user",
        parts: [{ text: serialized }],
      });
      continue;
    }

    contents.push(normalizeGeminiMessage(message));
  }

  return {
    systemInstruction: systemParts.length > 0 ? { parts: systemParts } : undefined,
    contents,
  };
};

const normalizeToolChoice = (
  toolChoice: ToolChoice | undefined,
  tools: Tool[] | undefined,
): "none" | "auto" | ToolChoiceExplicit | undefined => {
  if (!toolChoice) return undefined;

  if (toolChoice === "none" || toolChoice === "auto") {
    return toolChoice;
  }

  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error("tool_choice 'required' was provided but no tools were configured");
    }

    if (tools.length > 1) {
      throw new Error(
        "tool_choice 'required' needs a single tool or specify the tool name explicitly",
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

const resolveApiUrl = () =>
  ENV.geminiApiUrl && ENV.geminiApiUrl.trim().length > 0
    ? ENV.geminiApiUrl.trim()
    : "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

const assertApiKey = () => {
  if (!ENV.geminiApiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
};

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
    if (explicitFormat.type === "json_schema" && !explicitFormat.json_schema?.schema) {
      throw new Error("responseFormat json_schema requires a defined schema object");
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
  assertApiKey();

  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format,
    maxTokens,
    max_tokens,
  } = params;

  const { systemInstruction, contents } = splitGeminiMessages(messages);
  const resolvedMaxTokens = maxTokens ?? max_tokens ?? 32768;

  const payload: Record<string, unknown> = {
    contents,
    generationConfig: {
      maxOutputTokens: resolvedMaxTokens,
    },
  };

  if (systemInstruction) {
    payload.systemInstruction = systemInstruction;
  }

  if (tools && tools.length > 0) {
    payload.tools = [
      {
        functionDeclarations: tools.map((tool) => ({
          name: tool.function.name,
          description: tool.function.description,
          parameters: tool.function.parameters,
        })),
      },
    ];
  }

  const normalizedToolChoice = normalizeToolChoice(toolChoice || tool_choice, tools);
  if (normalizedToolChoice) {
    if (normalizedToolChoice === "none" || normalizedToolChoice === "auto") {
      payload.toolConfig = {
        functionCallingConfig: {
          mode: normalizedToolChoice === "none" ? "NONE" : "AUTO",
        },
      };
    } else {
      payload.toolConfig = {
        functionCallingConfig: {
          mode: "ANY",
          allowedFunctionNames: [normalizedToolChoice.function.name],
        },
      };
    }
  }

  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema,
  });

  if (normalizedResponseFormat) {
    payload.generationConfig = {
      ...(payload.generationConfig as Record<string, unknown>),
      responseMimeType:
        normalizedResponseFormat.type === "text" ? "text/plain" : "application/json",
    };

    if (normalizedResponseFormat.type === "json_schema") {
      (payload.generationConfig as Record<string, unknown>).responseSchema =
        normalizedResponseFormat.json_schema.schema;
    }
  }

  const response = await fetch(resolveApiUrl(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": ENV.geminiApiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM invoke failed: ${response.status} ${response.statusText} – ${errorText}`);
  }

  const data = (await response.json()) as GeminiResponse;
  const created = Math.floor(Date.now() / 1000);
  const choices =
    data.candidates?.map((candidate, index) => {
      const textContent =
        candidate.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
      return {
        index,
        message: {
          role: "assistant" as Role,
          content: textContent,
        },
        finish_reason: candidate.finishReason ?? null,
      };
    }) ?? [];

  return {
    id: `gemini-${created}`,
    created,
    model: "gemini-2.0-flash",
    choices,
    usage: data.usageMetadata
      ? {
          prompt_tokens: data.usageMetadata.promptTokenCount ?? 0,
          completion_tokens: data.usageMetadata.candidatesTokenCount ?? 0,
          total_tokens: data.usageMetadata.totalTokenCount ?? 0,
        }
      : undefined,
  };
}
