import { NextRequest } from "next/server";
import { z } from "zod";
import { consumeDistributedRateLimit, rateLimitHeaders, rateLimitResponse, rateLimitUnavailableResponse } from "@/lib/security/rate-limit";
import { searchTavily } from "@/lib/search/tavily";

const schema = z.object({ query: z.string().trim().min(2).max(500), maxResults: z.number().int().min(1).max(10).default(5) });

export async function POST(request: NextRequest) {
  const rateLimit = await consumeDistributedRateLimit(request, "search", 10, 60_000);
  if (rateLimit.unavailable) return rateLimitUnavailableResponse();
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit.retryAfterSeconds);

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON request" }, { status: 400 });
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: "Invalid search request", details: parsed.error.flatten() }, { status: 400 });
    }
    if (!process.env.WEB_SEARCH_API_KEY) {
      return Response.json({ error: "Web search is not configured", configured: false }, { status: 503 });
    }
    const result = await searchTavily(parsed.data.query, parsed.data.maxResults, request.signal);
    return Response.json(result, { headers: rateLimitHeaders(rateLimit.distributed, rateLimit.degraded) });
  } catch (error) {
    console.error("Search request failed:", error);
    return Response.json({
      error: "Search request could not be completed",
      detail: error instanceof Error ? error.message : "Unexpected search runtime error",
    }, { status: 502 });
  }
}
