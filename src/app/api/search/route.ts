import { NextRequest } from "next/server";
import { z } from "zod";

const schema = z.object({ query: z.string().trim().min(2).max(500), maxResults: z.number().int().min(1).max(10).default(5) });

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Invalid search request" }, { status: 400 });
  if (!process.env.WEB_SEARCH_API_KEY) {
    return Response.json({ error: "Web search is not configured", configured: false }, { status: 503 });
  }
  const upstream = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: process.env.WEB_SEARCH_API_KEY,
      query: parsed.data.query,
      max_results: parsed.data.maxResults,
      include_answer: true,
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!upstream.ok) {
    const detail = await upstream.text();
    return Response.json({ error: "Search provider request failed", status: upstream.status, detail: detail.slice(0, 300) }, { status: 502 });
  }

  return Response.json(await upstream.json());
}
