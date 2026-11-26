import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getAuthenticatedAccount } from "@/lib/database/account";
import { getPrisma } from "@/lib/database/prisma";
import { consumeDistributedRateLimit, rateLimitHeaders, rateLimitResponse, rateLimitUnavailableResponse } from "@/lib/security/rate-limit";
import { z } from "zod";

const allowedTypes = new Set([
  "application/pdf",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const maximumFileSize = 4 * 1024 * 1024;
const maximumExtractedText = 100_000;
const uploadFormSchema = z.object({
  file: z.custom<File>((value) => typeof File !== "undefined" && value instanceof File),
  conversationId: z.string().max(100).optional(),
});

async function extractText(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  if (file.type === "text/plain") return buffer.toString("utf8").slice(0, maximumExtractedText);
  if (file.type === "application/pdf") {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const parsed = await parser.getText();
      return parsed.text.slice(0, maximumExtractedText);
    } finally {
      await parser.destroy();
    }
  }
  const mammoth = await import("mammoth");
  const parsed = await mammoth.extractRawText({ buffer });
  return parsed.value.slice(0, maximumExtractedText);
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return Response.json({ error: "Authentication required" }, { status: 401 });
  const prisma = getPrisma();
  if (!prisma) return Response.json({ error: "File storage requires a configured database." }, { status: 503 });

  try {
    const account = await getAuthenticatedAccount();
    if (!account) return Response.json({ error: "Authentication or database is unavailable." }, { status: 503 });
    const id = request.nextUrl.searchParams.get("id");
    if (id) {
      const file = await prisma.uploadedFile.findFirst({
        where: { id, userId: account.user.id },
        select: { id: true, name: true, mimeType: true, size: true, conversationId: true, extractedText: true, createdAt: true },
      });
      if (!file) return Response.json({ error: "File not found" }, { status: 404 });
      return Response.json({ file });
    }
    const files = await prisma.uploadedFile.findMany({
      where: { userId: account.user.id },
      select: { id: true, name: true, mimeType: true, size: true, conversationId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return Response.json({ files });
  } catch (error) {
    console.error("Could not load uploaded files:", error);
    return Response.json({ error: "Could not load uploaded files." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const rateLimit = await consumeDistributedRateLimit(request, "files", 8, 60_000);
  if (rateLimit.unavailable) return rateLimitUnavailableResponse();
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit.retryAfterSeconds);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Invalid multipart upload." }, { status: 400 });
  }
  const parsedForm = uploadFormSchema.safeParse({
    file: form.get("file"),
    conversationId: form.get("conversationId") ?? undefined,
  });
  if (!parsedForm.success) {
    return Response.json({ error: "A valid file and conversation id are required.", details: parsedForm.error.flatten() }, { status: 400 });
  }
  const { file, conversationId } = parsedForm.data;
  if (file.size > maximumFileSize) return Response.json({ error: "File exceeds the 4 MB serverless request limit" }, { status: 413 });
  if (!allowedTypes.has(file.type)) return Response.json({ error: "Only PDF, TXT, and DOCX files are allowed" }, { status: 415 });

  let text: string;
  try {
    text = await extractText(file);
  } catch (error) {
    console.error("Uploaded document text extraction failed:", error);
    return Response.json({ error: "Could not extract text from this document. Check that the file is valid." }, { status: 422 });
  }

  const session = await auth();
  const prisma = getPrisma();
  if (!session?.user?.email || !prisma) {
    return Response.json(
      { name: file.name, mimeType: file.type, size: file.size, text, stored: false },
      { headers: rateLimitHeaders(rateLimit.distributed, rateLimit.degraded) },
    );
  }

  try {
    const account = await getAuthenticatedAccount();
    if (!account) return Response.json({ error: "Authentication or database is unavailable." }, { status: 503 });
    if (conversationId) {
      const conversation = await prisma.conversation.findFirst({
        where: { id: conversationId, userId: account.user.id },
        select: { id: true },
      });
      if (!conversation) return Response.json({ error: "Conversation not found in your account." }, { status: 404 });
    }

    const savedFile = await prisma.uploadedFile.create({
      data: {
        userId: account.user.id,
        conversationId: conversationId || null,
        name: file.name.slice(0, 255),
        mimeType: file.type,
        size: file.size,
        storageKey: randomUUID(),
        extractedText: text,
      },
      select: { id: true, name: true, mimeType: true, size: true, conversationId: true, createdAt: true },
    });
    return Response.json(
      { name: file.name, mimeType: file.type, size: file.size, text, stored: true, file: savedFile },
      { headers: rateLimitHeaders(rateLimit.distributed, rateLimit.degraded) },
    );
  } catch (error) {
    console.error("Could not persist uploaded document:", error);
    return Response.json({ error: "Document extracted but could not be saved to your account." }, { status: 503 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return Response.json({ error: "Authentication required" }, { status: 401 });
  const prisma = getPrisma();
  if (!prisma) return Response.json({ error: "File storage requires a configured database." }, { status: 503 });
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return Response.json({ error: "File id is required." }, { status: 400 });

  try {
    const account = await getAuthenticatedAccount();
    if (!account) return Response.json({ error: "Authentication or database is unavailable." }, { status: 503 });
    const deleted = await prisma.uploadedFile.deleteMany({ where: { id, userId: account.user.id } });
    return deleted.count
      ? Response.json({ deleted: true })
      : Response.json({ error: "File not found" }, { status: 404 });
  } catch (error) {
    console.error("Could not delete uploaded document:", error);
    return Response.json({ error: "Could not delete uploaded document." }, { status: 503 });
  }
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return Response.json({ error: "Authentication required" }, { status: 401 });
  const prisma = getPrisma();
  if (!prisma) return Response.json({ error: "File storage requires a configured database." }, { status: 503 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON request" }, { status: 400 });
  }
  const parsed = z.object({
    fileId: z.string().min(1).max(100),
    conversationId: z.string().min(1).max(100),
  }).safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid file link", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const account = await getAuthenticatedAccount();
    if (!account) return Response.json({ error: "Authentication or database is unavailable." }, { status: 503 });
    const conversation = await prisma.conversation.findFirst({
      where: { id: parsed.data.conversationId, userId: account.user.id },
      select: { id: true },
    });
    if (!conversation) return Response.json({ error: "Conversation not found in your account." }, { status: 404 });
    const updated = await prisma.uploadedFile.updateMany({
      where: { id: parsed.data.fileId, userId: account.user.id },
      data: { conversationId: conversation.id },
    });
    if (!updated.count) return Response.json({ error: "File not found in your account." }, { status: 404 });
    return Response.json({ linked: true });
  } catch (error) {
    console.error("Could not link uploaded file to conversation:", error);
    return Response.json({ error: "Could not link uploaded file to conversation." }, { status: 503 });
  }
}
