import type { ProviderId } from "./model-router";

export function parseProviderEvent(provider: ProviderId, data: string) {
  if (!data || data === "[DONE]") return null;

  const json: unknown = JSON.parse(data);
  if (!json || typeof json !== "object") return null;

  const payload = json as {
    error?: { message?: string } | string;
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    choices?: Array<{ delta?: { content?: string | Array<{ text?: string }> } }>;
  };

  if (payload.error) {
    const message = typeof payload.error === "string" ? payload.error : payload.error.message;
    return { error: message || "The provider returned an error." };
  }

  if (provider === "gemini") {
    const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("");
    return text ? { text } : null;
  }

  const content = payload.choices?.[0]?.delta?.content;
  const text = typeof content === "string"
    ? content
    : content?.map((part) => part.text ?? "").join("");
  return text ? { text } : null;
}
