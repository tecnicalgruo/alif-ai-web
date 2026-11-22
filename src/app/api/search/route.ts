import { NextRequest } from "next/server";
import { z } from "zod";

const schema = z.object({ query: z.string().trim().min(2).max(500), maxResults: z.number().int().min(1).max(10).default(5) });

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Invalid search request" }, { status: 400 });
  if (!process.env.WEB_SEARCH_API_KEY) {
    return Response.json({ error: "Web search is not configured", configured: false }, { status: 503 });
  }
  // The provider call is intentionally isolated until a provider is selected.
  return Response.json({ error: "Search provider not implemented", configured: true }, { status: 501 });
}
