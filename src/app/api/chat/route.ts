import { NextRequest } from "next/server";
import { providerCatalog, type ProviderId } from "@/lib/ai/model-router";
import { parseProviderEvent } from "@/lib/ai/provider-stream";
import { consumeRateLimit, rateLimitResponse } from "@/lib/security/rate-limit";
import { chatRequestSchema } from "@/lib/validation";

const streamHeaders = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  "X-Accel-Buffering": "no",
};

function sseError(message: string) {
  return new Response(`data: ${JSON.stringify({ error: message })}\n\n`, {
    headers: streamHeaders,
  });
}

function normalizeStream(upstream: Response, provider: ProviderId) {
  if (!upstream.body) throw new Error("The provider returned no response stream.");

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            buffer += decoder.decode();
            if (buffer.trim()) emitLine(buffer, controller);
            controller.close();
            return;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() ?? "";

          for (const line of lines) emitLine(line, controller);
          if (controller.desiredSize !== null && controller.desiredSize <= 0) return;
        }
      } catch {
        if (controller.desiredSize === null) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "The provider stream was interrupted. Please try again." })}\n\n`));
        controller.close();
      }
    },
    async cancel(reason) {
      await reader.cancel(reason);
    },
  });

  function emitLine(line: string, controller: ReadableStreamDefaultController<Uint8Array>) {
    if (!line.startsWith("data:")) return;
    const data = line.slice(5).trim();
    if (!data || data === "[DONE]") return;
    const event = parseProviderEvent(provider, data);
    if (event?.error) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: event.error })}\n\n`));
    } else if (event?.text) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: event.text })}\n\n`));
    }
  }
}

export async function POST(request: NextRequest) {
  const rateLimit = consumeRateLimit(request, "chat", 20, 60_000);
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit.retryAfterSeconds);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON request" }, { status: 400 });
  }

  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid chat request", details: parsed.error.flatten() }, { status: 400 });
  }

  const { messages, provider: requestedProvider, model } = parsed.data;
  const provider: ProviderId = requestedProvider
    ?? (["gemini", "grok", "openrouter"] as ProviderId[])
      .find((id) => Boolean(process.env[providerCatalog[id].key]))
    ?? "gemini";
  const key = process.env[providerCatalog[provider].key];

  if (!key) {
    return sseError(`${providerCatalog[provider].name} is not configured. Add ${providerCatalog[provider].key} to Vercel environment variables.`);
  }

  try {
    const upstream = provider === "gemini"
      ? await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model ?? providerCatalog.gemini.model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(key)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: messages.map((message) => ({
                role: message.role === "assistant" ? "model" : "user",
                parts: [{ text: message.content }],
              })),
            }),
            signal: AbortSignal.any([request.signal, AbortSignal.timeout(90_000)]),
          },
        )
      : await fetch(`${provider === "grok" ? "https://api.x.ai/v1" : "https://openrouter.ai/api/v1"}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`,
            ...(provider === "openrouter" ? {
              "HTTP-Referer": process.env.APP_URL ?? "https://alif-ai-web.vercel.app",
              "X-Title": "ALIF AI",
            } : {}),
          },
          body: JSON.stringify({ model: model ?? providerCatalog[provider].model, messages, stream: true }),
          signal: AbortSignal.any([request.signal, AbortSignal.timeout(90_000)]),
        });

    if (!upstream.ok) {
      const detail = await upstream.text();
      return sseError(`Provider request failed (${upstream.status}). ${detail.slice(0, 400)}`);
    }

    return new Response(normalizeStream(upstream, provider), { headers: streamHeaders });
  } catch {
    return sseError(`Could not connect to ${providerCatalog[provider].name}. Check the model key and try again.`);
  }
}
