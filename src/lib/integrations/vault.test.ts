import { afterEach, describe, expect, it, vi } from "vitest";
import { decryptIntegrationData, encryptIntegrationData } from "./vault";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("integration credential encryption", () => {
  it("round-trips JSON using the configured encryption secret", () => {
    vi.stubEnv("INTEGRATION_ENCRYPTION_KEY", "test-encryption-key-with-at-least-32-characters");
    const value = { accessToken: "private-token", enabled: true };

    expect(decryptIntegrationData(encryptIntegrationData(value))).toEqual(value);
  });

  it("rejects modified ciphertext", () => {
    vi.stubEnv("INTEGRATION_ENCRYPTION_KEY", "test-encryption-key-with-at-least-32-characters");
    const encrypted = encryptIntegrationData({ accessToken: "private-token" });
    const parts = encrypted.split(".");
    parts[3] = `${parts[3].startsWith("A") ? "B" : "A"}${parts[3].slice(1)}`;

    expect(() => decryptIntegrationData(parts.join("."))).toThrow();
  });

  it("requires a server encryption secret", () => {
    vi.stubEnv("INTEGRATION_ENCRYPTION_KEY", "");
    vi.stubEnv("AUTH_SECRET", "");

    expect(() => encryptIntegrationData({ accessToken: "private-token" })).toThrow(/Set INTEGRATION_ENCRYPTION_KEY/);
  });
});
