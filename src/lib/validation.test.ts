import { describe, expect, it } from "vitest";
import { chatRequestSchema } from "./validation";

describe("chat validation", () => {
  it("accepts a valid Bengali chat request", () => {
    expect(chatRequestSchema.safeParse({
      messages: [{ role: "user", content: "হ্যালো" }],
      provider: "gemini",
      mode: "assistant",
    }).success).toBe(true);
  });

  it("rejects empty messages", () => {
    expect(chatRequestSchema.safeParse({ messages: [{ role: "user", content: "" }] }).success).toBe(false);
  });
});
