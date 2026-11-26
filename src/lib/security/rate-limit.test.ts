import { describe, expect, it } from "vitest";
import { consumeRateLimit } from "./rate-limit";

describe("request rate limit", () => {
  it("limits a caller within a fixed window and permits it after reset", () => {
    const store = new Map<string, { count: number; resetAt: number }>();
    const request = new Request("https://example.test/api/chat", {
      headers: { "x-vercel-forwarded-for": "192.0.2.10" },
    });

    expect(consumeRateLimit(request, "chat", 2, 60_000, 1_000, store).allowed).toBe(true);
    expect(consumeRateLimit(request, "chat", 2, 60_000, 2_000, store).allowed).toBe(true);
    expect(consumeRateLimit(request, "chat", 2, 60_000, 3_000, store)).toEqual({
      allowed: false,
      retryAfterSeconds: 58,
    });
    expect(consumeRateLimit(request, "chat", 2, 60_000, 61_000, store).allowed).toBe(true);
  });

  it("uses the last forwarded address and keeps scopes separate", () => {
    const store = new Map<string, { count: number; resetAt: number }>();
    const request = new Request("https://example.test/api/search", {
      headers: { "x-forwarded-for": "198.51.100.1, 198.51.100.9" },
    });

    consumeRateLimit(request, "chat", 1, 60_000, 1_000, store);
    expect(consumeRateLimit(request, "search", 1, 60_000, 1_000, store).allowed).toBe(true);
    expect([...store.keys()]).toContain("chat:198.51.100.9");
  });
});
