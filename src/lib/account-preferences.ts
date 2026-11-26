export type AccountPreferences = {
  preferredProvider: "gemini" | "grok" | "openrouter";
  language: "en" | "bn";
  autoRead: boolean;
};

export const defaultAccountPreferences: AccountPreferences = {
  preferredProvider: "openrouter",
  language: "en",
  autoRead: false,
};

const storageKey = "alif-ai-account-preferences";

export function readLocalAccountPreferences(): AccountPreferences {
  try {
    const saved = localStorage.getItem(storageKey);
    if (!saved) return defaultAccountPreferences;
    const value: unknown = JSON.parse(saved);
    if (!value || typeof value !== "object") return defaultAccountPreferences;
    const preferences = value as Partial<AccountPreferences>;
    return {
      preferredProvider: ["gemini", "grok", "openrouter"].includes(preferences.preferredProvider ?? "")
        ? preferences.preferredProvider as AccountPreferences["preferredProvider"]
        : defaultAccountPreferences.preferredProvider,
      language: preferences.language === "bn" ? "bn" : "en",
      autoRead: preferences.autoRead === true,
    };
  } catch {
    return defaultAccountPreferences;
  }
}

export function saveLocalAccountPreferences(preferences: AccountPreferences) {
  localStorage.setItem(storageKey, JSON.stringify(preferences));
}
