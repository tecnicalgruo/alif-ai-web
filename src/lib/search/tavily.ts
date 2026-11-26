import { z } from "zod";

const tavilyResponseSchema = z.object({
  answer: z.string().optional(),
  results: z.array(z.object({
    title: z.string(),
    url: z.string().url(),
    content: z.string().optional(),
  })).max(10),
});

export async function searchTavily(query: string, maxResults: number, signal?: AbortSignal) {
  const apiKey = process.env.WEB_SEARCH_API_KEY;
  if (!apiKey) throw new Error("Web search is not configured.");

  const upstream = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: maxResults,
      include_answer: true,
    }),
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(30_000)])
      : AbortSignal.timeout(30_000),
  });
  if (!upstream.ok) throw new Error(`Search provider failed (${upstream.status}).`);

  const data: unknown = await upstream.json();
  const parsed = tavilyResponseSchema.safeParse(data);
  if (!parsed.success) throw new Error("Search provider returned an invalid response.");
  return parsed.data;
}
