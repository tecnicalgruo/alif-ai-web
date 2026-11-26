import { describe, expect, it } from "vitest";
import { getProviderFallbackOrder } from "./model-router";

describe("provider fallback order", () => {
  it("tries the selected configured provider first", () => {
    expect(getProviderFallbackOrder("gemini", ["openrouter", "gemini", "grok"]))
      .toEqual(["gemini", "openrouter", "grok"]);
  });

  it("uses configured providers when the preferred provider is unavailable", () => {
    expect(getProviderFallbackOrder("openrouter", ["gemini", "grok"]))
      .toEqual(["gemini", "grok"]);
  });
});
