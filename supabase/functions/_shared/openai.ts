// _shared/openai.ts — OpenAI API helper
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
if (!OPENAI_API_KEY) {
  console.error("⚠️ OPENAI_API_KEY secret is not set!");
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

async function callOpenAI(body: Record<string, unknown>): Promise<string> {
  if (!OPENAI_API_KEY) {
    throw new Error("OpenAI API key not configured. Set the OPENAI_API_KEY secret in Supabase.");
  }
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  const json = await res.json();
  if (!res.ok) {
    const msg = json?.error?.message || `HTTP ${res.status}`;
    // If key is invalid, surface a clear message
    if (res.status === 401) {
      throw new Error(`Invalid OpenAI API key. Please update the OPENAI_API_KEY secret with a valid key from https://platform.openai.com/api-keys`);
    }
    throw new Error(`OpenAI API error: ${res.status} ${msg}`);
  }

  return json.choices[0].message.content;
}

export async function chat(messages: ChatMessage[], options?: {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: "text" | "json_object";
}): Promise<string> {
  return callOpenAI({
    model: options?.model ?? "gpt-4o-mini",
    messages,
    temperature: options?.temperature ?? 0.3,
    max_tokens: options?.maxTokens ?? 2000,
    response_format: options?.responseFormat
      ? { type: options.responseFormat }
      : undefined,
  });
}

export async function chatWithVision(
  systemPrompt: string,
  imageBase64: string,
  mimeType: string,
): Promise<string> {
  return callOpenAI({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: `data:${mimeType};base64,${imageBase64}`, detail: "high" },
          },
        ],
      },
    ],
    temperature: 0.2,
    max_tokens: 3000,
  });
}
