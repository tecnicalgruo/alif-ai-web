import { NextRequest } from "next/server";
import { chatRequestSchema } from "@/lib/validation";
import { providerCatalog, type ProviderId } from "@/lib/ai/model-router";

function sseError(message: string) {
  return new Response(`data: ${JSON.stringify({ error: message })}\n\n`, {
    status: 200,
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
  });
}

export async function POST(request: NextRequest) {
  const parsed = chatRequestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Invalid chat request", details: parsed.error.flatten() }, { status: 400 });
  }

  const { messages, provider: requestedProvider, model } = parsed.data;
  const provider: ProviderId = requestedProvider ?? (["gemini", "grok", "openrouter"] as ProviderId[])
    .find((id) => Boolean(process.env[providerCatalog[id].key])) ?? "gemini";
  const key = process.env[providerCatalog[provider].key];
  if (!key) return sseError(`${providerCatalog[provider].name} is not configured. Add ${providerCatalog[provider].key} to .env.local.`);

  let upstream: Response;
  if (provider === "gemini") {
    const selectedModel = model ?? providerCatalog.gemini.model;
    const contents = messages.map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
    }));
    upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(selectedModel)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents }),
        signal: AbortSignal.timeout(90000),
      },
    );
  } else {
    const baseUrl = provider === "grok" ? "https://api.x.ai/v1" : "https://openrouter.ai/api/v1";
    const selectedModel = model ?? providerCatalog[provider].model;
    upstream = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        ...(provider === "openrouter" ? { "HTTP-Referer": process.env.APP_URL ?? "http://localhost:3000", "X-Title": "ALIF AI" } : {}),
      },
      body: JSON.stringify({ model: selectedModel, messages, stream: true }),
      signal: AbortSignal.timeout(90000),
    });
  }

  if (!upstream.ok) {
    const detail = await upstream.text();
    return sseError(`Provider request failed (${upstream.status}). ${detail.slice(0, 500)}`);
  }
  if (!upstream.body) return sseError("The provider returned no response stream.");

  const stream = new ReadableStream({
    async start(controller) {
      const decoder = new TextDecoder();
      const reader = upstream.body!.getReader();
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            const data = line.slice(5).trim();
            if (!data || data === "[DONE]") continue;
            try {
              const json = JSON.parse(data);
              let text = "";
              if (provider === "gemini") text = json.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
              else text = json.choices?.[0]?.delta?.content ?? "";
              if (text) controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ text })}\n\n`));
            } catch {
              // Ignore malformed provider chunks.
            }
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Streaming connection failed";
        controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ error: message })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" },
  });
}
