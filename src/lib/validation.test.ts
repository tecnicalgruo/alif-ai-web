import { describe, expect, it } from "vitest";
import { chatRequestSchema, conversationSaveSchema } from "./validation";

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

  it("accepts a bounded conversation record", () => {
    expect(conversationSaveSchema.safeParse({
      title: "বাংলা chat",
      messages: [{ role: "user", content: "হ্যালো", model: "gemini-3.8-flash" }],
    }).success).toBe(true);
  });

  it("rejects oversized conversation payloads", () => {
    expect(conversationSaveSchema.safeParse({
      title: "Chat",
      messages: Array.from({ length: 101 }, () => ({ role: "user", content: "message" })),
    }).success).toBe(false);
  });
});
