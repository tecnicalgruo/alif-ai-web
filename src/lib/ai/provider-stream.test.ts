import { describe, expect, it } from "vitest";
import { parseProviderEvent } from "./provider-stream";

describe("provider SSE event parsing", () => {
  it("extracts Gemini text chunks", () => {
    expect(parseProviderEvent("gemini", JSON.stringify({
      candidates: [{ content: { parts: [{ text: "বাংলা " }, { text: "উত্তর" }] } }],
    }))).toEqual({ text: "বাংলা উত্তর" });
  });

  it("extracts OpenAI-compatible text chunks", () => {
    expect(parseProviderEvent("grok", JSON.stringify({
      choices: [{ delta: { content: "Hello" } }],
    }))).toEqual({ text: "Hello" });
  });

  it("preserves provider errors and ignores stream terminators", () => {
    expect(parseProviderEvent("openrouter", JSON.stringify({ error: { message: "Rate limited" } }))).toEqual({ error: "Rate limited" });
    expect(parseProviderEvent("openrouter", "[DONE]")).toBeNull();
  });
});
