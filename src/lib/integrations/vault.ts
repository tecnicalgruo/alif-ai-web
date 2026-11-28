import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { z, type ZodType } from "zod";
import type { PrismaClient } from "@prisma/client";

const githubIntegrationSchema = z.object({
  accessToken: z.string().min(20).max(500),
  login: z.string().min(1).max(100),
});

const supabaseIntegrationSchema = z.object({
  projectUrl: z.string().url(),
  publishableKey: z.string().min(20).max(1000),
  allowedTables: z.array(z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/)).min(1).max(50),
});

const gmailIntegrationSchema = z.object({
  accessToken: z.string().min(20),
  refreshToken: z.string().min(20).optional(),
  expiresAt: z.number().int().positive(),
  email: z.string().email(),
});

export type GithubIntegration = z.infer<typeof githubIntegrationSchema>;
export type SupabaseIntegration = z.infer<typeof supabaseIntegrationSchema>;
export type GmailIntegration = z.infer<typeof gmailIntegrationSchema>;
export type IntegrationId = "github" | "supabase" | "gmail";

type IntegrationData = {
  github: GithubIntegration;
  supabase: SupabaseIntegration;
  gmail: GmailIntegration;
};

const integrationSchemas: { [K in IntegrationId]: ZodType<IntegrationData[K]> } = {
  github: githubIntegrationSchema,
  supabase: supabaseIntegrationSchema,
  gmail: gmailIntegrationSchema,
};

function encryptionKey() {
  const secret = process.env.INTEGRATION_ENCRYPTION_KEY ?? process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("Set INTEGRATION_ENCRYPTION_KEY or a 32-character AUTH_SECRET to protect integration credentials.");
  }
  return createHash("sha256").update(`alif-ai-integrations:v1:${secret}`).digest();
}

export function encryptIntegrationData(value: unknown) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptIntegrationData(value: string) {
  const [version, encodedIv, encodedTag, encodedData] = value.split(".");
  if (version !== "v1" || !encodedIv || !encodedTag || !encodedData) {
    throw new Error("Stored integration credentials have an unsupported format.");
  }
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(encodedIv, "base64url"));
  decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(encodedData, "base64url")),
    decipher.final(),
  ]).toString("utf8");
  return JSON.parse(plaintext) as unknown;
}

export function saveIntegration(
  prisma: PrismaClient,
  userId: string,
  integration: "github",
  value: GithubIntegration,
): Promise<GithubIntegration>;
export function saveIntegration(
  prisma: PrismaClient,
  userId: string,
  integration: "supabase",
  value: SupabaseIntegration,
): Promise<SupabaseIntegration>;
export function saveIntegration(
  prisma: PrismaClient,
  userId: string,
  integration: "gmail",
  value: GmailIntegration,
): Promise<GmailIntegration>;
export async function saveIntegration(
  prisma: PrismaClient,
  userId: string,
  integration: IntegrationId,
  value: unknown,
) {
  const parsed = integrationSchemas[integration].safeParse(value);
  if (!parsed.success) throw new Error(`Invalid ${integration} integration credentials.`);
  await prisma.userPreference.upsert({
    where: { userId_key: { userId, key: `integration:${integration}` } },
    create: {
      userId,
      key: `integration:${integration}`,
      value: encryptIntegrationData(parsed.data),
    },
    update: { value: encryptIntegrationData(parsed.data) },
  });
  return parsed.data;
}

export function loadIntegration(
  prisma: PrismaClient,
  userId: string,
  integration: "github",
): Promise<GithubIntegration | null>;
export function loadIntegration(
  prisma: PrismaClient,
  userId: string,
  integration: "supabase",
): Promise<SupabaseIntegration | null>;
export function loadIntegration(
  prisma: PrismaClient,
  userId: string,
  integration: "gmail",
): Promise<GmailIntegration | null>;
export async function loadIntegration(
  prisma: PrismaClient,
  userId: string,
  integration: IntegrationId,
) {
  const stored = await prisma.userPreference.findUnique({
    where: { userId_key: { userId, key: `integration:${integration}` } },
    select: { value: true },
  });
  if (!stored) return null;

  try {
    const decrypted = decryptIntegrationData(stored.value);
    const parsed = integrationSchemas[integration].safeParse(decrypted);
    if (!parsed.success) {
      console.error(`Stored ${integration} integration credentials failed validation.`);
      return null;
    }
    return parsed.data;
  } catch (error) {
    console.error(`Could not decrypt ${integration} integration credentials:`, error);
    throw new Error(`Could not decrypt ${integration} integration credentials. Check the integration encryption secret.`);
  }
}

export async function removeIntegration(prisma: PrismaClient, userId: string, integration: IntegrationId) {
  await prisma.userPreference.deleteMany({
    where: { userId, key: `integration:${integration}` },
  });
}
