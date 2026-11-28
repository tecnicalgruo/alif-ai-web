import { z } from "zod";
import { loadIntegration, saveIntegration, type GmailIntegration } from "@/lib/integrations/vault";
import type { PrismaClient } from "@prisma/client";

const gmailMessageListSchema = z.object({
  messages: z.array(z.object({ id: z.string(), threadId: z.string().optional() })).default([]),
});

const gmailMessageSchema = z.object({
  id: z.string(),
  threadId: z.string().optional(),
  snippet: z.string().optional(),
  internalDate: z.string().optional(),
  payload: z.object({
    headers: z.array(z.object({ name: z.string(), value: z.string() })).optional(),
    body: z.object({ data: z.string().optional() }).optional(),
    parts: z.array(z.lazy(() => gmailPartSchema)).optional(),
  }).optional(),
});

type GmailPart = {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPart[];
};

const gmailPartSchema: z.ZodType<GmailPart> = z.lazy(() => z.object({
  mimeType: z.string().optional(),
  body: z.object({ data: z.string().optional() }).optional(),
  parts: z.array(gmailPartSchema).optional(),
}));

const tokenResponseSchema = z.object({
  access_token: z.string().min(20),
  expires_in: z.number().positive(),
  refresh_token: z.string().optional(),
});

async function getValidIntegration(prisma: PrismaClient, userId: string): Promise<GmailIntegration> {
  const integration = await loadIntegration(prisma, userId, "gmail");
  if (!integration) throw new Error("Connect Gmail before using its tools.");
  if (integration.expiresAt > Date.now() + 60_000) return integration;
  if (!integration.refreshToken) throw new Error("Gmail access expired. Disconnect and reconnect Gmail.");

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Gmail OAuth is not configured on the server.");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: integration.refreshToken,
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("Could not refresh Gmail access. Reconnect Gmail.");
  const tokenData: unknown = await response.json();
  const parsed = tokenResponseSchema.safeParse(tokenData);
  if (!parsed.success) throw new Error("Google returned an invalid token refresh response.");

  return saveIntegration(prisma, userId, "gmail", {
    ...integration,
    accessToken: parsed.data.access_token,
    refreshToken: parsed.data.refresh_token ?? integration.refreshToken,
    expiresAt: Date.now() + parsed.data.expires_in * 1000,
  });
}

async function gmailFetch(prisma: PrismaClient, userId: string, path: string, init?: RequestInit) {
  const integration = await getValidIntegration(prisma, userId);
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${integration.accessToken}`,
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error("Gmail access expired or was revoked. Reconnect Gmail.");
    throw new Error(`Gmail API request failed (${response.status}).`);
  }
  return response;
}

export async function searchGmail(prisma: PrismaClient, userId: string, query: string, maxResults: number) {
  const params = new URLSearchParams({ q: query, maxResults: String(maxResults) });
  const listRaw: unknown = await (await gmailFetch(prisma, userId, `messages?${params}`)).json();
  const list = gmailMessageListSchema.safeParse(listRaw);
  if (!list.success) throw new Error("Gmail returned an invalid message list.");

  const messages = await Promise.all(list.data.messages.map(async ({ id }) => {
    const raw: unknown = await (await gmailFetch(prisma, userId, `messages/${encodeURIComponent(id)}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`)).json();
    const parsed = gmailMessageSchema.safeParse(raw);
    if (!parsed.success) throw new Error("Gmail returned an invalid message.");
    const headers = parsed.data.payload?.headers ?? [];
    const header = (name: string) => headers.find((item) => item.name.toLowerCase() === name.toLowerCase())?.value ?? "";
    return {
      id: parsed.data.id,
      threadId: parsed.data.threadId,
      from: header("From"),
      subject: header("Subject"),
      date: header("Date"),
      snippet: parsed.data.snippet ?? "",
    };
  }));
  return messages;
}

function extractText(parts: GmailPart[], maximumLength: number): string {
  let text = "";
  for (const part of parts) {
    if (part.mimeType === "text/plain" && part.body?.data) {
      text += Buffer.from(part.body.data, "base64url").toString("utf8");
    }
    if (part.parts?.length) text += extractText(part.parts, maximumLength - text.length);
    if (text.length >= maximumLength) break;
  }
  return text.slice(0, maximumLength);
}

export async function readGmailMessage(prisma: PrismaClient, userId: string, messageId: string) {
  if (!/^[a-zA-Z0-9_-]{1,200}$/.test(messageId)) throw new Error("Invalid Gmail message id.");
  const raw: unknown = await (await gmailFetch(prisma, userId, `messages/${encodeURIComponent(messageId)}?format=full`)).json();
  const parsed = gmailMessageSchema.safeParse(raw);
  if (!parsed.success) throw new Error("Gmail returned an invalid message.");
  const headers = parsed.data.payload?.headers ?? [];
  const header = (name: string) => headers.find((item) => item.name.toLowerCase() === name.toLowerCase())?.value ?? "";
  const payload = parsed.data.payload;
  const body = payload?.parts?.length
    ? extractText(payload.parts, 12_000)
    : payload?.body?.data
      ? Buffer.from(payload.body.data, "base64url").toString("utf8").slice(0, 12_000)
      : "";
  return {
    id: parsed.data.id,
    from: header("From"),
    to: header("To"),
    subject: header("Subject"),
    date: header("Date"),
    body,
  };
}

export async function sendGmailMessage(
  prisma: PrismaClient,
  userId: string,
  recipient: string,
  subject: string,
  text: string,
) {
  if (/[\r\n]/.test(recipient) || /[\r\n]/.test(subject)) throw new Error("Invalid email recipient or subject.");
  const integration = await getValidIntegration(prisma, userId);
  const mime = [
    `To: ${recipient}`,
    `From: ${integration.email}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    text,
  ].join("\r\n");
  const encoded = Buffer.from(mime, "utf8").toString("base64url");
  const raw: unknown = await (await gmailFetch(prisma, userId, "messages/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ raw: encoded }),
  })).json();
  const parsed = z.object({ id: z.string(), threadId: z.string().optional() }).safeParse(raw);
  if (!parsed.success) throw new Error("Gmail did not confirm the sent message.");
  return { messageId: parsed.data.id, threadId: parsed.data.threadId, to: recipient, subject };
}
