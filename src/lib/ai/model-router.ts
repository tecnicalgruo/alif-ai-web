export type ProviderId = "gemini" | "grok" | "openrouter";

export const providerCatalog = {
  gemini: { name: "Google Gemini", model: "gemini-3.8-flash", key: "GEMINI_API_KEY" },
  grok: { name: "xAI Grok", model: "grok-4-fast-non-reasoning", key: "XAI_API_KEY" },
  openrouter: { name: "OpenRouter", model: "openai/gpt-4o-mini", key: "OPENROUTER_API_KEY" },
} as const;

export function getConfiguredProviders() {
  return (Object.keys(providerCatalog) as ProviderId[]).filter((provider) =>
    Boolean(process.env[providerCatalog[provider].key]),
  );
}

export function getProviderFallbackOrder(preferred: ProviderId, configured: ProviderId[]) {
  return configured.includes(preferred)
    ? [preferred, ...configured.filter((provider) => provider !== preferred)]
    : configured;
}
