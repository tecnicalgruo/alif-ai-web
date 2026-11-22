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
  try {
    if (provider === "gemini") {
    const selectedModel = model ?? providerCatalog.gemini.model;
    const contents = messages.map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
    }));
    upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(selectedModel)}:generateContent?key=${encodeURIComponent(key)}`,
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
        ...(provider === "openrouter" ? { "HTTP-Referer": process.env.APP_URL ?? "https://alif-ai-web.vercel.app", "X-Title": "ALIF AI" } : {}),
      },
      body: JSON.stringify({ model: selectedModel, messages, stream: false }),
      signal: AbortSignal.timeout(90000),
    });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Provider connection failed";
    return sseError(`Could not connect to ${providerCatalog[provider].name}: ${message}`);
  }

  if (!upstream.ok) {
    const detail = await upstream.text();
    return sseError(`Provider request failed (${upstream.status}). ${detail.slice(0, 500)}`);
  }

  let text = "";
  try {
    const json = await upstream.json();
    if (provider === "gemini") {
    text = json.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? "").join("") ?? "";
    } else {
    text = json.choices?.[0]?.message?.content ?? "";
    }
  } catch (error) {
    return sseError(error instanceof Error ? error.message : "Could not parse provider response");
  }

  if (!text) return sseError("The provider returned an empty response.");

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
    controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" },
  });
}
