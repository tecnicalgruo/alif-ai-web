export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  model?: string;
};

export type ConversationRecord = {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: string;
};

const storageKey = "alif-ai-conversations";
const activeKey = "alif-ai-active-conversation";
const legacyKey = "alif-ai-history";

function validMessages(value: unknown): value is ChatMessage[] {
  return Array.isArray(value) && value.every((message) =>
    message &&
    (message.role === "user" || message.role === "assistant") &&
    typeof message.content === "string",
  );
}

export function readLocalConversations(): ConversationRecord[] {
  const saved = localStorage.getItem(storageKey);
  if (saved) {
    const parsed: unknown = JSON.parse(saved);
    if (!Array.isArray(parsed)) throw new Error("Saved conversation data is invalid.");
    const valid = parsed.every((conversation) =>
      conversation &&
      typeof conversation.id === "string" &&
      typeof conversation.title === "string" &&
      typeof conversation.updatedAt === "string" &&
      validMessages(conversation.messages),
    );
    if (!valid) throw new Error("Saved conversation data is invalid.");
    return parsed as ConversationRecord[];
  }

  const legacy = localStorage.getItem(legacyKey);
  if (!legacy) return [];
  const parsedLegacy: unknown = JSON.parse(legacy);
  if (!Array.isArray(parsedLegacy)) throw new Error("Saved conversation data is invalid.");
  if (!validMessages(parsedLegacy)) throw new Error("Saved conversation data is invalid.");
  const messages = parsedLegacy;
  const record: ConversationRecord = {
    id: crypto.randomUUID(),
    title: messages.find((message) => message.role === "user")?.content.slice(0, 60) || "Previous conversation",
    messages,
    updatedAt: new Date().toISOString(),
  };
  writeLocalConversations([record]);
  localStorage.removeItem(legacyKey);
  return [record];
}

export function writeLocalConversations(conversations: ConversationRecord[]) {
  localStorage.setItem(storageKey, JSON.stringify(conversations));
}

export function saveLocalConversation(conversation: ConversationRecord) {
  const conversations = readLocalConversations();
  const updated = [
    conversation,
    ...conversations.filter((item) => item.id !== conversation.id),
  ].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  writeLocalConversations(updated);
  localStorage.setItem(activeKey, conversation.id);
  return updated;
}

export function getActiveConversationId() {
  return localStorage.getItem(activeKey);
}

export function setActiveConversationId(id: string) {
  if (id) localStorage.setItem(activeKey, id);
  else localStorage.removeItem(activeKey);
}

export function clearLocalConversations() {
  localStorage.removeItem(storageKey);
  localStorage.removeItem(legacyKey);
  localStorage.removeItem(activeKey);
}
