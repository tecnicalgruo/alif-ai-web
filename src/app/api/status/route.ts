import { NextResponse } from "next/server";
import { getConfiguredProviders, providerCatalog } from "@/lib/ai/model-router";

export async function GET() {
  const configured = getConfiguredProviders();
  return NextResponse.json({
    providers: (Object.keys(providerCatalog) as (keyof typeof providerCatalog)[]).map((id) => ({
      id,
      name: providerCatalog[id].name,
      model: providerCatalog[id].model,
      configured: configured.includes(id),
    })),
    searchConfigured: Boolean(process.env.WEB_SEARCH_API_KEY),
  });
}
